import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BRAND   = new THREE.Color(0xFF9B7A);
const INFO    = new THREE.Color(0x38BDF8);

const container = document.getElementById('hand-viz');
const canvas    = document.getElementById('hand3d');
const label     = document.getElementById('hand-label');
if (!container || !canvas) throw new Error('hand-viz elements missing');

/* ── Scene ──────────────────────────────────────────────────────── */
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0.05, 0.52);
camera.lookAt(0, 0.01, 0);

const renderer = new THREE.WebGLRenderer({
  canvas, alpha: true, antialias: true, powerPreference: 'low-power'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

function resize(){
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
resize();
addEventListener('resize', resize);

/* ── Lighting ───────────────────────────────────────────────────── */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(2, 3, 2);
scene.add(dirLight);
const rimLight = new THREE.DirectionalLight(0xFF8F66, 0.25);
rimLight.position.set(-2, 1, -1);
scene.add(rimLight);
const glowLight = new THREE.PointLight(0xFF8F66, 0, 0.8);
glowLight.position.set(0, 0.05, 0.05);
scene.add(glowLight);

/* ── Group ──────────────────────────────────────────────────────── */
const handGroup = new THREE.Group();
scene.add(handGroup);

/* ── Morph state ────────────────────────────────────────────────── */
let morph = 0, morphTarget = 0, cycleTimer = 0;
const MORPH_DUR = 2.0, CYCLE = 8.0;

/*
 * Strategy: TWO meshes per hand part.
 * 1. Original SkinnedMesh — solid rendering with skin material (untouched)
 * 2. Baked+simplified clone — wireframe rendering with white material
 *
 * The model is a SkinnedMesh with bones. Bone transforms happen in the vertex
 * shader, so EdgesGeometry/WireframeGeometry on the raw geometry give the wrong
 * shape (bind pose, not posed). Fix: bake bone transforms into vertex positions
 * via applyBoneTransform(), then decimate with SimplifyModifier to ~20% of
 * original vertex count. The resulting mesh is a regular (non-skinned) Mesh
 * added as a child of the SkinnedMesh, so it inherits the correct world transform.
 */
const meshEntries = []; /* {mesh, wireMesh} */

/* ── Load model ─────────────────────────────────────────────────── */
const loader = new GLTFLoader();
let modelLoaded = false;

function tryLoad(url){
  loader.load(url, onModel, undefined, (err) => {
    if(url === '/assets/models/hand.glb'){
      console.warn('.glb not found, trying .gltf…');
      tryLoad('/assets/models/hand.gltf');
    } else {
      console.warn('Hand model failed, showing SVG fallback:', err);
      showFallback();
    }
  });
}

function onModel(gltf){
  const model = gltf.scene;

  /* Auto-scale and center */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 0.3 / maxDim;
  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));

  /* Ensure bone matrices are computed before baking */
  model.updateMatrixWorld(true);

  /* Collect meshes first (don't modify tree during traverse) */
  const meshes = [];
  model.traverse(child => { if (child.isMesh) meshes.push(child); });

  const simplifier = new SimplifyModifier();
  meshes.forEach(child => {
    const mat = child.material;
    mat.transparent = true;
    mat.opacity = 1.0;
    mat.side = THREE.DoubleSide;

    /* Step 1: Bake bone transforms into vertex positions */
    const srcPos = child.geometry.attributes.position;
    const skinned = child.isSkinnedMesh && child.skeleton;
    if (skinned) child.skeleton.update();
    const newPos = new Float32Array(srcPos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < srcPos.count; i++) {
      v.fromBufferAttribute(srcPos, i);
      if (skinned) child.applyBoneTransform(i, v);
      newPos[i*3] = v.x; newPos[i*3+1] = v.y; newPos[i*3+2] = v.z;
    }

    /* Step 2: Position-only geometry → weld duplicate vertices */
    let wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    if (child.geometry.index) wireGeo.setIndex(child.geometry.index.clone());
    wireGeo = mergeVertices(wireGeo, 1e-3);

    /* Step 3: Uniform decimation — remove ~50% of verts */
    try {
      const vCount = wireGeo.attributes.position.count;
      const target = Math.floor(vCount * 0.50);
      if (target > 20) wireGeo = simplifier.modify(wireGeo, target);
    } catch(e) {
      console.warn('Simplify failed, using welded geometry', e);
    }

    /* Step 4: Wireframe clone as child (inherits world transform).
       depthWrite:false so the solid mesh's depth buffer doesn't
       occlude wireframe lines during crossfade. */
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.visible = false;
    child.add(wireMesh);

    meshEntries.push({ mesh: child, wireMesh });
  });

  handGroup.add(model);
  modelLoaded = true;
}
tryLoad('/assets/models/hand.glb');

function showFallback(){
  canvas.style.display = 'none';
  if(label) label.style.display = 'none';
  const fb = document.createElement('div');
  fb.className = 'hand-viz-fallback';
  fb.innerHTML = `<svg viewBox="0 0 280 280" fill="none">
    <line class="lm-line" x1="140" y1="260" x2="140" y2="190"/>
    <line class="lm-line" x1="140" y1="190" x2="100" y2="170"/>
    <line class="lm-line" x1="140" y1="190" x2="140" y2="155"/>
    <line class="lm-line" x1="140" y1="190" x2="175" y2="165"/>
    <line class="lm-line" x1="140" y1="190" x2="200" y2="180"/>
    <line class="lm-line" x1="140" y1="220" x2="90" y2="210"/>
    <line class="lm-line" x1="90" y1="210" x2="65" y2="185"/>
    <line class="lm-line" x1="65" y1="185" x2="50" y2="160"/>
    <line class="lm-line" x1="100" y1="170" x2="80" y2="120"/>
    <line class="lm-line" x1="80" y1="120" x2="70" y2="80"/>
    <line class="lm-line" x1="70" y1="80" x2="65" y2="45"/>
    <line class="lm-line" x1="140" y1="155" x2="138" y2="100"/>
    <line class="lm-line" x1="138" y1="100" x2="136" y2="60"/>
    <line class="lm-line" x1="136" y1="60" x2="134" y2="28"/>
    <line class="lm-line" x1="175" y1="165" x2="188" y2="110"/>
    <line class="lm-line" x1="188" y1="110" x2="196" y2="72"/>
    <line class="lm-line" x1="196" y1="72" x2="200" y2="42"/>
    <line class="lm-line" x1="200" y1="180" x2="220" y2="135"/>
    <line class="lm-line" x1="220" y1="135" x2="232" y2="105"/>
    <line class="lm-line" x1="232" y1="105" x2="240" y2="80"/>
    <circle class="lm-tip" cx="50" cy="160" r="5"/>
    <circle class="lm-tip" cx="65" cy="45" r="5"/>
    <circle class="lm-tip" cx="134" cy="28" r="5"/>
    <circle class="lm-tip" cx="200" cy="42" r="5"/>
    <circle class="lm-tip" cx="240" cy="80" r="5"/>
  </svg>`;
  container.appendChild(fb);
}

/* ── Animate ────────────────────────────────────────────────────── */
let lastTime = performance.now() / 1000;

function animate(){
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastTime, 0.1);
  lastTime = now;

  if(!modelLoaded){ renderer.render(scene, camera); return; }

  /* Full slow rotation */
  if(!REDUCED) handGroup.rotation.y += 0.003 * dt * 60;

  /* Morph cycle */
  cycleTimer += dt;
  if(cycleTimer > CYCLE){ cycleTimer = 0; morphTarget = 1 - morphTarget; }

  const speed = dt / MORPH_DUR;
  if(morph < morphTarget) morph = Math.min(morph + speed, 1);
  else if(morph > morphTarget) morph = Math.max(morph - speed, 0);

  const t = morph * morph * (3 - 2 * morph); /* smoothstep easing */

  /* ── Crossfade: solid SkinnedMesh ↔ simplified wireframe clone ── */
  /* Solid fades out over morph 0→0.55, wireframe fades in over 0.35→1 */
  const solidAlpha = morph < 0.55 ? 1.0 - morph / 0.55 : 0.0;
  const wireAlpha  = morph > 0.35 ? (morph - 0.35) / 0.65 : 0.0;

  meshEntries.forEach(({mesh, wireMesh}) => {
    mesh.material.opacity = solidAlpha;
    /* Stop writing depth when solid is invisible — otherwise its
       depth buffer occludes wireframe lines behind the surface. */
    mesh.material.depthWrite = solidAlpha > 0.01;
    if (wireMesh) {
      wireMesh.visible = wireAlpha > 0.005;
      wireMesh.material.opacity = wireAlpha;
    }
  });

  /* Lighting morph */
  dirLight.intensity  = 0.9 - t * 0.5;
  rimLight.intensity  = 0.25 + t * 0.5;
  glowLight.intensity = t * 1.8;
  ambientLight.intensity = 0.6 - t * 0.25;

  /* Label. `t` is the local morph alpha in this scope, so the translator is
     reached through window (i18n.js is a classic script; this file is a module). */
  if(label){
    const tr = s => (window.t ? window.t(s) : s);
    if(morph < 0.01){
      label.textContent = tr('anatomical');
      label.classList.remove('digital');
    } else if(morph > 0.99){
      label.textContent = tr('digitalized');
      label.classList.add('digital');
    } else {
      label.textContent = tr('morphing\u2026');
      label.classList.toggle('digital', morph > 0.5);
    }
    label.style.opacity = (morph > 0.02 && morph < 0.98) ? '0.5' : '0.7';
  }

  renderer.render(scene, camera);
}
animate();
