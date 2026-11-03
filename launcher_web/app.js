/* ── SVG Icon library: Phosphor Icons (MIT, phosphoricons.com), filled glyphs
   on a 256 grid. Regular weight; the small marks (check, x, arrows, chevron)
   use bold so they hold at 10-16 px. Source and licence: assets/README.md ── */
const I = {
  hand: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M56,76a60,60,0,0,1,120,0,8,8,0,0,1-16,0,44,44,0,0,0-88,0,8,8,0,1,1-16,0Zm140,44a27.9,27.9,0,0,0-13.36,3.39A28,28,0,0,0,144,106.7V76a28,28,0,0,0-56,0v80l-3.82-6.13a28,28,0,0,0-48.41,28.17l29.32,50A8,8,0,1,0,78.89,220L49.6,170a12,12,0,1,1,20.78-12l.14.23,18.68,30A8,8,0,0,0,104,184V76a12,12,0,0,1,24,0v68a8,8,0,1,0,16,0V132a12,12,0,0,1,24,0v20a8,8,0,0,0,16,0v-4a12,12,0,0,1,24,0v36c0,21.61-7.1,36.3-7.16,36.42a8,8,0,0,0,3.58,10.73A7.9,7.9,0,0,0,208,232a8,8,0,0,0,7.16-4.42c.37-.73,8.85-18,8.85-43.58V148A28,28,0,0,0,196,120Z"/></svg>',
  spiral: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M248,144a8,8,0,0,1-16,0,96.11,96.11,0,0,0-96-96,88.1,88.1,0,0,0-88,88,80.09,80.09,0,0,0,80,80,72.08,72.08,0,0,0,72-72,64.07,64.07,0,0,0-64-64,56.06,56.06,0,0,0-56,56,48.05,48.05,0,0,0,48,48,40,40,0,0,0,40-40,32,32,0,0,0-32-32,24,24,0,0,0-24,24,16,16,0,0,0,16,16,8,8,0,0,0,8-8,8,8,0,0,1,0-16,16,16,0,0,1,16,16,24,24,0,0,1-24,24,32,32,0,0,1-32-32,40,40,0,0,1,40-40,48.05,48.05,0,0,1,48,48,56.06,56.06,0,0,1-56,56,64.07,64.07,0,0,1-64-64,72.08,72.08,0,0,1,72-72,80.09,80.09,0,0,1,80,80,88.1,88.1,0,0,1-88,88,96.11,96.11,0,0,1-96-96A104.11,104.11,0,0,1,136,32,112.12,112.12,0,0,1,248,144Z"/></svg>',
  broadcast: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Zm73.71,7.14a80,80,0,0,1-14.08,22.2,8,8,0,0,1-11.92-10.67,63.95,63.95,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67,80.08,80.08,0,0,1,14.08,84.47ZM69,103.09a64,64,0,0,0,11.26,67.58,8,8,0,0,1-11.92,10.67,79.93,79.93,0,0,1,0-106.67A8,8,0,1,1,80.29,85.34,63.77,63.77,0,0,0,69,103.09ZM248,128a119.58,119.58,0,0,1-34.29,84,8,8,0,1,1-11.42-11.2,103.9,103.9,0,0,0,0-145.56A8,8,0,1,1,213.71,44,119.58,119.58,0,0,1,248,128ZM53.71,200.78A8,8,0,1,1,42.29,212a119.87,119.87,0,0,1,0-168,8,8,0,1,1,11.42,11.2,103.9,103.9,0,0,0,0,145.56Z"/></svg>',
  mic: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/></svg>',
  voice: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"/></svg>',
  eye: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>',
  wave: '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M239.24,131.4c-22,46.8-41.4,68.6-61.2,68.6-25.1,0-40.73-33.32-57.28-68.6C107.7,103.56,92.9,72,78,72c-16.4,0-36.31,37.21-46.72,59.4a8,8,0,0,1-14.48-6.8C38.71,77.8,58.16,56,78,56c25.1,0,40.73,33.32,57.28,68.6C148.3,152.44,163.1,184,178,184c16.4,0,36.31-37.21,46.72-59.4a8,8,0,0,1,14.48,6.8Z"/></svg>',
  walk: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M152,80a32,32,0,1,0-32-32A32,32,0,0,0,152,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,32Zm64,112a8,8,0,0,1-8,8c-35.31,0-52.95-17.81-67.12-32.12-2.74-2.77-5.36-5.4-8-7.84l-13.43,30.88,37.2,26.57A8,8,0,0,1,160,176v56a8,8,0,0,1-16,0V180.12l-31.07-22.2L79.34,235.19A8,8,0,0,1,72,240a7.84,7.84,0,0,1-3.19-.67,8,8,0,0,1-4.15-10.52l54.08-124.37c-9.31-1.65-20.92,1.2-34.7,8.58a163.88,163.88,0,0,0-30.57,21.77,8,8,0,0,1-10.95-11.66c2.5-2.35,61.69-57.23,98.72-25.08,3.83,3.32,7.48,7,11,10.57C166.19,122.7,179.36,136,208,136A8,8,0,0,1,216,144Z"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,160H56V56H200V200Z"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/></svg>',
  arrowLeft: '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>',
  arrowRight: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"/></svg>',
  clock: '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>',
  beaker: '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M221.69,199.77,160,96.92V40h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23ZM110.86,103.25A7.93,7.93,0,0,0,112,99.14V40h32V99.14a7.93,7.93,0,0,0,1.14,4.11L183.36,167c-12,2.37-29.07,1.37-51.75-10.11-15.91-8.05-31.05-12.32-45.22-12.81ZM48,208l28.54-47.58c14.25-1.74,30.31,1.85,47.82,10.72,19,9.61,35,12.88,48,12.88a69.89,69.89,0,0,0,19.55-2.7L208,208Z"/></svg>',
  home: '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg>',
  up: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z"/></svg>',
  minus: '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z"/></svg>',
  scale: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M239.43,133l-32-80h0a8,8,0,0,0-9.16-4.84L136,62V40a8,8,0,0,0-16,0V65.58L54.26,80.19A8,8,0,0,0,48.57,85h0v.06L16.57,165a7.92,7.92,0,0,0-.57,3c0,23.31,24.54,32,40,32s40-8.69,40-32a7.92,7.92,0,0,0-.57-3L66.92,93.77,120,82V208H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16H136V78.42L187,67.1,160.57,133a7.92,7.92,0,0,0-.57,3c0,23.31,24.54,32,40,32s40-8.69,40-32A7.92,7.92,0,0,0,239.43,133ZM56,184c-7.53,0-22.76-3.61-23.93-14.64L56,109.54l23.93,59.82C78.76,180.39,63.53,184,56,184Zm144-32c-7.53,0-22.76-3.61-23.93-14.64L200,77.54l23.93,59.82C222.76,148.39,207.53,152,200,152Z"/></svg>',
  code: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z"/></svg>',
  lock: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"/></svg>',
  layers: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z"/></svg>',
  shield: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/></svg>',
  camera: '<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor"><path d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z"/></svg>',
  person: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>',
  image: '<svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>',
  chevron: '<svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor"><path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"/></svg>',
  refresh: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>',
  stream: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z"/></svg>',
};

const TOOLS = [
  { key:"iiv", title:"Finger Tapping Test", file:"finger_tapping.py",
    video:"/assets/videos/finger-tapping.mp4" },
  { key:"spiral", title:"Spiral Tracing Test", file:"spiral_test.py",
    video:"/assets/videos/spiral-test.mp4" },
  { key:"oculomotor", title:"Eye Movement Test", file:"oculomotor_test.py",
    // This clip is a capture of the test UI, which already dims its own camera
    // feed; the idle veil on top of that leaves it unreadable. Play it bright.
    video:"/assets/videos/eye-movement.mp4", dimPreview:false },
  { key:"ddk", title:"Speech Test", file:"speech_test.py",
    video:"/assets/videos/speech.mp4" },
  { key:"tremor", title:"Hand Tremor Test", file:"tremor_test.py",
    // A supporting check, not a screening result (the way paced tapping sits
    // beside Big & Fast): docs/tests/TREMOR_RESTRUCTURE_PLAN.md §2.
    video:"/assets/videos/tremor.mp4" },
  { key:"gait", title:"Walking Test", file:"gait_test.py",
    // No preview clip yet, and the seated tier has not run live: say so
    // plainly rather than stand a drawing in for a recording.
    wip:true },
  { key:"tracking", title:"Hand Tracking / UDP", file:"hand_tracking.py",
    video:"/assets/videos/hand-tracking.mp4" },
];

const RESEARCH = [
  { icon:"clock", title:"Motor \u2014 rhythm and movement",
    text:"Finger tapping measures how much the gaps between taps vary. That variability is higher in neurodegenerative groups than in controls. Spiral tracing adds how closely the fingertip follows a line, with speed variation and smoothness (SPARC) as readings.",
    cite:"Roalf et al. (2018) \u00b7 Wang et al. (2025) \u00b7 PMC11496774" },
  { icon:"eye", title:"Oculomotor \u2014 inhibitory control",
    text:"The anti-saccade error rate counts how often the eyes are pulled toward a target you were told to look away from. Meta-analysis puts the effect separating Alzheimer's groups from controls at SMD 1.59.",
    cite:"Opwonya et al. (2022) \u00b7 Crawford et al. (2005) \u00b7 PMC9090874" },
  { icon:"mic", title:"Speech \u2014 articulatory rhythm",
    text:"Repeating pa-ta-ka as fast and evenly as possible is the speech counterpart of finger tapping, scored the same way: how much the gaps between syllables vary. Language measures such as word-finding pauses are planned next.",
    cite:"Li et al., TapTalk (2024) \u00b7 docs/tests/SPEECH_TEST_PLAN.md" },
  { icon:"wave", title:"Tremor and spiral \u2014 steadiness",
    text:"Spiral tracing gives two scores: how closely the fingertip follows the line, and how much it shakes. The tremor test is a supporting check. Shaking can raise the tapping and spiral numbers, so it looks for it with both hands held still for three short holds.",
    cite:"MDS-UPDRS 3.17 \u00b7 Williams (2021) \u00b7 docs/tests/SPIRAL_TEST_PLAN.md" },
];

/* ── "Why This" page data (differentiation) ──────────────────────────
   Source of truth: docs/research/README.md (TAS Test framing),
   docs/research/01-webcam-hand-motor.md (finger-tapping vs TapTalk table),
   docs/overview/ROADMAP.md §1 & §7. Keep claims honest — the validation row
   deliberately shows where TAS Test is ahead. */
const WHY_PILLARS = [
  { icon:"code", title:"Open source",
    text:"Every script is on GitHub, including the scoring code." },
  { icon:"lock", title:"Runs locally",
    text:"Nothing leaves the machine. The hub serves on 127.0.0.1 and results stay on disk." },
  { icon:"layers", title:"Three domains, one system",
    text:"Hand-motor, oculomotor and speech tests in the same session, written to the same results format." },
  { icon:"shield", title:"Thresholds shown as provisional",
    text:"Each metric links the paper it came from, and bands not yet fitted to data are labelled as such." },
];

// Cell states → status token + word. Word is always shown next to the icon so
// meaning never rides on colour alone (UI_STYLE_GUIDE §2.4).
const CMP_STATES = {
  yes:     { icon:"check", word:"Yes",     cls:"st-yes" },
  no:      { icon:"x",     word:"No",      cls:"st-no" },
  partial: { icon:"minus", word:"Partial", cls:"st-partial" },
  planned: { icon:"clock", word:"Planned", cls:"st-planned" },
  notyet:  { icon:"clock", word:"Not yet", cls:"st-planned" },
};
const CMP_COLS = ["This suite", "Consumer apps", "TAS Test (research)"];
const WHY_MATRIX = [
  { cap:"Motor biomarkers (tapping, spiral)",      cells:["yes","no","yes"] },
  { cap:"Oculomotor anti-saccade",                 cells:["yes","no","no"] },
  { cap:"Speech tasks",                            cells:["partial","no","yes"] },
  { cap:"Camera-only, no wearable needed",         cells:["yes","yes","yes"] },
  { cap:"Open-source / inspectable",               cells:["yes","no","no"] },
  { cap:"Fully local, no data upload",             cells:["yes","no","no"] },
  { cap:"Longitudinal self-tracking",              cells:["yes","partial","yes"] },
  { cap:"Literature-cited metrics shown in-app",   cells:["yes","no","partial"] },
  // Partial: tapping checked on HUBU-FIS (Parkinson's, UPDRS), not yet on cognitive decline.
  { cap:"Validated on patient cohorts",            cells:["partial","no","yes"] },
  { cap:"Wearable co-contraction twin",            cells:["planned","no","no"] },
];

let currentRunning = {};
let cardsBuilt = false;
let carousel = null;
// A language switch rebuilds the cards, so initCarousel runs again; its
// window-level listeners are torn down with this rather than stacking up.
let carouselAbort = null;
let whyBuilt = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Inject SVG icons into detail pages + research cards ─────────── */
function renderStaticBits(){
  // Detail page icons
  const map = {iiv:"hand", spiral:"spiral", oculomotor:"eye", ddk:"mic", tremor:"wave", gait:"walk", tracking:"broadcast"};
  for(const [k,v] of Object.entries(map)){
    const el = document.getElementById("detail-icon-"+k);
    if(el) el.innerHTML = I[v];
  }
  // Back buttons
  document.querySelectorAll(".detail-back").forEach(b=>{
    b.innerHTML = I.arrowLeft + " " + t("Back to Dashboard");
  });
  // Placeholder frames for illustrations not drawn yet
  document.querySelectorAll(".art-slot .slot-ico").forEach(el => el.innerHTML = I.image);
  // Analysis header icon
  const ai = document.getElementById("analysis-icon");
  if(ai) ai.innerHTML = I.chart;
  // Why-this header icon
  const wi = document.getElementById("why-icon");
  if(wi) wi.innerHTML = I.scale;
  // About-me header icon
  const bi = document.getElementById("about-icon");
  if(bi) bi.innerHTML = I.person;
  // Research cards
  const rc = document.getElementById("research-cards");
  if(rc) rc.innerHTML = RESEARCH.map(r => `<div class="r-card">
    <div class="r-content">
      <h4>${I[r.icon]} ${t(r.title)}</h4>
      <p>${t(r.text)}</p>
      <div class="r-cite">${t(r.cite)}</div>
    </div>
    <div class="r-peel">
      <div class="peel-layer peel-l1"></div>
      <div class="peel-layer peel-l2"></div>
      <div class="peel-layer peel-l3"></div>
      <div class="peel-layer peel-cover">
        <div class="peel-face">${I[r.icon]}<span>${t(r.title)}</span></div>
      </div>
    </div>
  </div>`).join("");
}
renderStaticBits();

/* ── Page navigation ─────────────────────────────────────────────── */
function showPage(id){
  // The report panel belongs to the Analysis page; leaving it open over
  // another page would be a dialog with nothing behind it.
  // Resolve the target before deactivating anything: an unknown id used to
  // clear every page and then throw inside the callback, leaving the app blank
  // with no way back.
  const next = document.getElementById("page-"+id);
  if(!next) return;
  window.closeReport?.();
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  // The frame gap lets the fade-in play. rAF is suspended while the tab is
  // hidden, so activate straight away there — otherwise every page stays off
  // and the dashboard is blank until it returns to the foreground.
  const activate = ()=>{
    next.classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  if(document.hidden) activate(); else requestAnimationFrame(activate);
  document.querySelectorAll(".nav-link").forEach(n =>
    n.classList.toggle("active", n.dataset.page===id));
  // A drop-down trigger carries the marker for whichever of its pages is on.
  document.querySelectorAll(".nav-group").forEach(g =>
    g.querySelector(".nav-trigger").classList.toggle(
      "active", !!g.querySelector(".nav-link.active")));
  if(TOOLS.find(tool=>tool.key===id)) renderDetailActions(id);
  if(id==="analysis") loadAnalysis();
  if(id==="why") renderWhy();
  // dev.js owns a ~100 ms poll; it must only run while its page is on screen.
  if(id==="dev") window.startDev?.(); else window.stopDev?.();
  // remote.js owns a 10 s poll; same rule as dev.js.
  if(id==="remote") window.startRemote?.(); else window.stopRemote?.();
}
document.querySelectorAll(".nav-link").forEach(n =>
  n.addEventListener("click", ()=> showPage(n.dataset.page)));

/* ── Nav drop-downs ──────────────────────────────────────────────── */
const navGroups = Array.from(document.querySelectorAll(".nav-group"));
function openNavGroup(g, open){
  g.classList.toggle("open", open);
  g.querySelector(".nav-trigger").setAttribute("aria-expanded", open ? "true" : "false");
}
function closeNavMenus(except){
  navGroups.forEach(g => { if(g!==except) openNavGroup(g, false); });
}
navGroups.forEach(g => {
  const trigger = g.querySelector(".nav-trigger");
  // Hover opens it (mouse only — a touch tap has no hover to leave, so it
  // would open and never close). A short close delay survives the gap
  // between the trigger and the menu below it and moving diagonally onto
  // the menu itself, rather than snapping shut mid-move.
  let closeTimer = null;
  const hoverOpen = () => {
    if(!matchMedia("(hover: hover)").matches) return;
    clearTimeout(closeTimer);
    closeNavMenus(g);
    openNavGroup(g, true);
  };
  const hoverClose = () => {
    if(!matchMedia("(hover: hover)").matches) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(()=> openNavGroup(g, false), 150);
  };
  g.addEventListener("mouseenter", hoverOpen);
  g.addEventListener("mouseleave", hoverClose);
  trigger.addEventListener("click", e => {
    // Without this the document handler below would close it again in the
    // same click. Still needed for touch/keyboard, which get no hover.
    e.stopPropagation();
    const open = !g.classList.contains("open");
    closeNavMenus(g);
    openNavGroup(g, open);
  });
});
// A pick inside the menu bubbles here too, so choosing a page also closes it.
document.addEventListener("click", ()=> closeNavMenus());
document.addEventListener("keydown", e => { if(e.key==="Escape") closeNavMenus(); });

/* ── Card rendering (build once, update surgically) ──────────────── */
const cardsEl = document.getElementById("cards");

function buildCards(){
  cardsEl.innerHTML = "";
  // `tool`, not `t` — `t` is the translator (i18n.js).
  TOOLS.forEach((tool,i) => {
    const on = !!currentRunning[tool.key];
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-key", tool.key);
    card.setAttribute("data-index", i);
    const title = t(tool.title);
    card.innerHTML = `
      <div class="card-glow"></div>
      <div class="card-body">
        <h3>${title}</h3>
        <div class="live-badge ${on?"on":""}"><span class="live-pulse"></span>${t("Running — check the camera window")}</div>
        <div class="an-badge" role="status"><span class="an-pulse"></span><span data-an-text></span></div>
        <div class="card-video${tool.video?" has-video":""}${tool.dimPreview===false?" no-veil":""}">${tool.video?`<video muted loop autoplay playsinline disablepictureinpicture preload="auto" src="${tool.video}"></video>`:tool.wip?`<div class="card-wip">${I.walk}<span>${t("Work in progress")}</span></div>`:(tool.art||"")}</div>
        <div class="card-actions">
          <button class="btn btn-primary" data-go="${tool.key}" ${on?"disabled":""} aria-label="${t("Launch {name}",{name:title})}">${on?t("Running..."):I.play+" "+t("Launch")}</button>
          <button class="btn btn-danger" data-stop="${tool.key}" ${on?"":"disabled"} aria-label="${t("Stop {name}",{name:title})}">${I.stop} ${t("Stop")}</button>
          <button class="card-more" data-detail="${tool.key}" aria-label="${t("View details for {name}",{name:title})}">${t("Details")} ${I.arrowRight}</button>
        </div>
      </div>`;
    card.addEventListener("mousemove", e=>{
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX-r.left)/r.width*100)+"%");
      card.style.setProperty("--my", ((e.clientY-r.top)/r.height*100)+"%");
    });
    cardsEl.appendChild(card);
  });
  // Card actions only fire on the centered card; on a side card any click
  // recenters that card instead (see initCarousel).
  const guard = (card, run) => e => {
    e.stopPropagation();
    if(carousel && carousel.dragged()) return;                // ignore a drag that ended on a button
    if(carousel && !carousel.isActive(card)){ carousel.goTo(+card.dataset.index); return; }
    run(e);
  };
  cardsEl.querySelectorAll("[data-go]").forEach(b =>
    b.onclick = guard(b.closest(".card"), e => { addRipple(b,e); act("launch", b.dataset.go); }));
  cardsEl.querySelectorAll("[data-stop]").forEach(b =>
    b.onclick = guard(b.closest(".card"), () => act("stop", b.dataset.stop)));
  cardsEl.querySelectorAll("[data-detail]").forEach(s =>
    s.onclick = guard(s.closest(".card"), () => showPage(s.dataset.detail)));
  cardsBuilt = true;
  initCarousel();
}

/* ── 3D coverflow carousel controller ────────────────────────────────
   Cards ride an infinite wrap-around ring: one faces forward (active,
   fully interactive), neighbours angle inward and dim. Auto-advances every
   ~4 s; drag / arrows / wheel / dots / click-a-side-card rotate manually and
   pause the auto-spin until the user idles. Under reduced-motion we bail out
   and let CSS render a flat, fully-interactive fallback grid. */
function initCarousel(){
  const wrap = document.getElementById("carousel");
  const stage = cardsEl;
  const dotsEl = document.getElementById("carousel-dots");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  if(!wrap) return;
  if(carouselAbort) carouselAbort.abort();
  carouselAbort = new AbortController();
  const sig = {signal: carouselAbort.signal};
  prevBtn.innerHTML = I.arrowLeft;
  nextBtn.innerHTML = I.arrowRight;

  const cards = Array.from(stage.querySelectorAll(".card"));
  const count = cards.length;
  if(!count) return;

  if(reducedMotion){ carousel = null; return; } // CSS flat fallback

  let active = 0, autoTimer = null, idleTimer = null;
  const AUTO_MS = 4000, IDLE_MS = 5000;

  dotsEl.innerHTML = "";
  const dots = cards.map((c,i) => {
    const d = document.createElement("button");
    d.className = "carousel-dot";
    d.setAttribute("role","tab");
    d.setAttribute("aria-label", TOOLS[i] ? t(TOOLS[i].title) : t("Tool {n}",{n:i+1}));
    d.onclick = () => { poke(); goTo(i); };
    dotsEl.appendChild(d);
    return d;
  });

  function signedDist(i){
    let d = i - active;
    if(d >  count/2) d -= count;
    if(d < -count/2) d += count;
    return d;
  }
  function layout(){
    const GAP = wrap.clientWidth < 640 ? 150 : 250;
    cards.forEach((card,i) => {
      const d = signedDist(i), ad = Math.abs(d), isActive = d === 0;
      const scale = isActive ? 1 : Math.max(.7, 1 - ad*.12);
      const op = ad > 2 ? 0 : (isActive ? 1 : .55);
      card.style.transform =
        `translateX(-50%) translateX(${d*GAP}px) translateZ(${-ad*220}px) `+
        `rotateY(${d*-34}deg) scale(${scale}) `+
        // Hover growth (styles.css): the translate cancels the upward half of
        // the scale, so the card grows down and out, never into the header.
        `translateY(calc((var(--hover-scale,1) - 1) * 50%)) scale(var(--hover-scale,1))`;
      card.style.opacity = op;
      card.style.filter = isActive ? "none" : "brightness(.6)";
      card.style.zIndex = String(100 - ad);
      card.style.pointerEvents = ad > 2 ? "none" : "auto";
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-hidden", isActive ? "false" : "true");
      card.querySelectorAll("button").forEach(b =>
        isActive ? b.removeAttribute("tabindex") : b.setAttribute("tabindex","-1"));
    });
    dots.forEach((dot,i) => {
      const on = i === active;
      dot.classList.toggle("on", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function goTo(i){ active = ((i % count) + count) % count; layout(); }
  function go(dir){ goTo(active + dir); }

  function startAuto(){ stopAuto(); autoTimer = setInterval(() => go(1), AUTO_MS); }
  function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } }
  function poke(){ stopAuto(); clearTimeout(idleTimer); idleTimer = setTimeout(startAuto, IDLE_MS); }

  prevBtn.onclick = () => { poke(); go(-1); };
  nextBtn.onclick = () => { poke(); go(1); };

  wrap.addEventListener("keydown", e => {
    if(e.key === "ArrowLeft"){ poke(); go(-1); e.preventDefault(); }
    else if(e.key === "ArrowRight"){ poke(); go(1); e.preventDefault(); }
  });

  let wheelLock = false;
  wrap.addEventListener("wheel", e => {
    const amt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if(!amt) return;
    e.preventDefault(); poke();
    if(wheelLock) return;
    wheelLock = true; go(amt > 0 ? 1 : -1);
    setTimeout(() => wheelLock = false, 350);
  }, {passive:false});

  // Drag vs click: a press that moves < SLOP px stays a click; a drag past STEP
  // px advances the ring by at most ONE card per gesture (the `stepped` guard).
  // Move/up listen on window so a drag that leaves the stage still tracks; the
  // recenter rides the native click event so 3D-transformed cards hit-test right.
  const SLOP = 8, STEP = 60;
  let downX = null, downY = null, moved = false, stepped = false;
  stage.addEventListener("pointerdown", e => {
    if(e.button !== 0) return;
    downX = e.clientX; downY = e.clientY; moved = false; stepped = false;
    poke();
  });
  window.addEventListener("pointermove", e => {
    if(downX === null) return;
    if(Math.abs(e.clientX - downX) > SLOP || Math.abs(e.clientY - downY) > SLOP) moved = true;
    if(!stepped){
      const dx = e.clientX - downX;
      if(Math.abs(dx) > STEP){ go(dx > 0 ? -1 : 1); stepped = true; }  // one card max
    }
  }, sig);
  window.addEventListener("pointerup", () => { downX = downY = null; }, sig);
  // Click a non-active card's body to bring it forward. Buttons handle their own
  // clicks via the guard in buildCards; a drag (moved) suppresses the recenter.
  stage.addEventListener("click", e => {
    if(moved) return;
    const card = e.target.closest(".card");
    if(card && !card.classList.contains("is-active")){ poke(); goTo(+card.dataset.index); }
  });

  wrap.addEventListener("mouseenter", stopAuto);
  wrap.addEventListener("mouseleave", () => { if(downX === null) startAuto(); });
  window.addEventListener("resize", layout, sig);

  layout();
  startAuto();

  carousel = {
    isActive: card => card.classList.contains("is-active"),
    dragged: () => moved,
    goTo: i => { poke(); goTo(i); },
  };
}

function updateCardStates(running){
  currentRunning = running || {};
  TOOLS.forEach(tool => {
    const card = cardsEl.querySelector(`[data-key="${tool.key}"]`);
    if(!card) return;
    const on = !!running[tool.key];
    card.querySelector(".live-badge").classList.toggle("on", on);
    const goBtn = card.querySelector("[data-go]");
    goBtn.disabled = on;
    goBtn.innerHTML = on ? t("Running...") : I.play + " " + t("Launch");
    card.querySelector("[data-stop]").disabled = !on;
  });
  TOOLS.forEach(tool => renderDetailActions(tool.key));
  applyAnalysing();
}

/* ── Background analyses ──────────────────────────────────────────────
   The tremor test hands its last minute of measuring to a worker process
   and closes, so the camera is free (core/pending.py). /api/status lists
   those jobs under `analysing`; they are not "running" and block nothing.
   A job's end is a state ("done"/"failed"), kept by the hub for a while,
   and that is the moment its session lands in results/ — so that, not the
   test closing, is when the readings refetch and the assign card appears. */
let anJobs = [];
let anSeen = null;          // id -> state at the last poll; null until the first

function anText(job){
  if(job.state === "failed") return t("Couldn't measure the results");
  const pct = Math.round((job.progress || 0) * 100);
  return t("Measuring results… {pct}%", {pct});
}

function applyAnalysing(){
  const byTool = {};
  // newest job per tool: a failure is only shown while nothing newer runs
  anJobs.forEach(j => { if(j.state !== "done") byTool[j.tool] = j; });
  // Analysis page: a line per job still measuring, since its session is not
  // in the list until it is saved
  const bar = document.getElementById("analysis-pending");
  if(bar){
    const lines = Object.values(byTool).map(j => {
      const tool = TOOLS.find(x => x.key === j.tool);
      return `<span class="an-pulse"></span><b>${esc(t(tool ? tool.title : j.tool))}</b> ${esc(anText(j))}`;
    });
    bar.hidden = !lines.length;
    const html = lines.join("<br>");
    if(bar.innerHTML !== html) bar.innerHTML = html;
  }
  TOOLS.forEach(tool => {
    const job = byTool[tool.key];
    const show = !!job && !currentRunning[tool.key];
    const card = cardsEl && cardsEl.querySelector(`[data-key="${tool.key}"]`);
    const badge = card && card.querySelector(".an-badge");
    if(badge){
      badge.classList.toggle("on", show);
      badge.classList.toggle("failed", show && job.state === "failed");
      const txt = show ? anText(job) : "";
      const el = badge.querySelector("[data-an-text]");
      if(el.textContent !== txt) el.textContent = txt;
    }
    const note = document.querySelector(`#${tool.key}-actions [data-act-note]`);
    if(note){
      note.hidden = !show;
      note.classList.toggle("failed", show && job.state === "failed");
      const txt = show ? anText(job) : "";
      if(note.textContent !== txt) note.textContent = txt;
    }
  });
}

function renderAnalysing(list){
  anJobs = Array.isArray(list) ? list : [];
  const now = {};
  anJobs.forEach(j => { now[j.id] = j.state; });
  if(anSeen){
    const active = st => st === "queued" || st === "running";
    let landed = false;
    Object.entries(anSeen).forEach(([id, was]) => {
      if(!active(was)) return;
      const is = now[id];
      if(is === "failed"){
        // the reason is technical (it is in the job's worker.log); the
        // badge stays up for ten minutes so the failure is not missed
        toast(t("Couldn't measure the tremor results"), "fail");
      } else if(!active(is)){
        landed = true;        // "done", or gone before we saw it end
      }
    });
    if(landed){
      toast(t("Tremor results are ready"), "ok");
      if(window.afterRun) window.afterRun();
      else loadVitals(true);
    }
  }
  anSeen = now;
  applyAnalysing();
}

/* Built once, then only the two buttons are touched. This runs on every 3 s
   status poll, and it used to rewrite the whole row — which deleted the camera
   chip in it, so an open popover (or a native <select> dropdown inside one)
   vanished mid-choice every few seconds. Who is being tested is the navbar's
   switcher (profiles.js); the Launch button names them, since that is where
   the eye is at the moment it matters. */
function renderDetailActions(key){
  const el = document.getElementById(key+"-actions");
  if(!el) return;
  if(!el.querySelector("[data-act-go]")){
    el.innerHTML = `
      <button class="btn btn-primary" data-act-go onclick="act('launch','${key}')"></button>
      <button class="btn btn-danger" data-act-stop onclick="act('stop','${key}')"></button>
      <span class="cam-slot" data-cam></span>
      <span class="act-note" data-act-note role="status" hidden></span>`;
  }
  const on = !!currentRunning[key];
  const go = el.querySelector("[data-act-go]");
  const stop = el.querySelector("[data-act-stop]");
  go.disabled = on;
  const who = window.activeProfile?.() || {};
  const label = !who.name ? t("Launch Test")
    : window.isGroupProfile?.(who) ? t("Launch in {name}", {name: who.name})
    : t("Launch for {name}", {name: who.name});
  go.setAttribute("aria-label", label);
  go.innerHTML = on ? t("Running...")
    : I.play + " " + esc(label) + (who.name && window.profileAvatar ? " " + window.profileAvatar(who, "xs") : "");
  stop.disabled = !on;
  stop.setAttribute("aria-label", t("Stop test"));
  stop.innerHTML = I.stop + " " + t("Stop");
  renderCamChips();
  window.renderProfileChips?.();      // profiles.js loads after this file
}
// profiles.js calls this whenever who is being tested changes.
window.refreshLaunchButtons = () => TOOLS.forEach(tool => renderDetailActions(tool.key));

/* ── Camera-source chip ───────────────────────────────────────────────
   The tools used to stop at a console prompt asking for a camera; the
   choice is made here instead and travels to the spawned process as an
   env var (launcher.py `_tool_env`). A small chip that reads as status —
   "which camera will be used" — and folds open into a list of the cameras
   actually plugged in. One click on a row saves it: there is no Save
   button, because a picker that forgets your choice when you click away
   is a picker people think is broken. One shared setting rendered into
   every `[data-cam]` slot: the dashboard section head and each test
   page's action row. */
let camState = {mode:"webcam", index:0, url:"", name:"", label:"Webcam 0", mirror:null};
// Cameras plugged in, by name, in index order (GET /api/cameras, from
// core/camera_list.py). null until first asked. `camListed` is false when the
// OS could not be asked, which must not read as "nothing is plugged in".
let camList = null;
let camListed = false;

const esc = s => String(s??"").replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function camChipText(){
  return camState.mode === "stream" ? t("Phone / IP stream")
       : camState.name || t("Webcam {n}", {n: camState.index});
}

// The saved camera is known by name and the list says it is not plugged in.
function camMissing(){
  return camState.mode !== "stream" && !!camState.name && camListed
      && Array.isArray(camList) && !camList.some(c => c.name === camState.name);
}

// camState.mirror is true / false / null (never checked), from core/orientation.py
function mirrorVal(){
  return camState.mirror === true ? "on" : camState.mirror === false ? "off" : "auto";
}

function buildCamChip(root){
  const missing = camMissing();
  const tip = t("Camera the tests will use")
    + (camState.mode === "stream" && camState.url ? " — " + camState.url : "")
    + (missing ? " — " + t("not plugged in") : "");
  const seg = [["auto", "Auto"], ["on", "Mirrored"], ["off", "Normal"]];
  root.innerHTML = `
    <button class="cam-chip${missing?" cam-warn":""}" type="button" aria-expanded="false"
            aria-haspopup="dialog" title="${esc(tip)}">
      ${I.camera}<span class="cam-chip-text">${esc(camChipText())}</span>
      ${missing ? '<span class="cam-dot" aria-hidden="true"></span>' : ""}${I.chevron}
    </button>
    <div class="cam-pop" role="dialog" aria-label="${t("Camera")}" hidden>
      <div class="cam-head">
        <span class="cam-pop-title">${t("Camera")}</span>
        <button class="cam-refresh" type="button" title="${t("Look for cameras again")}"
                aria-label="${t("Look for cameras again")}">${I.refresh}</button>
      </div>
      <div class="cam-list" role="radiogroup" aria-label="${t("Camera")}"></div>
      <div class="cam-url-row" hidden>
        <input class="cam-url" type="url" placeholder="http://192.168.1.5:8080/video"
               value="${esc(camState.url||"")}" aria-label="${t("Stream URL")}">
        <button class="cam-connect btn-mini" type="button">${t("Use")}</button>
      </div>
      <div class="cam-sec" title="${esc(t("Some cameras send a mirrored picture. The hand tests check each camera once and correct it."))}">
        <span class="cam-lbl">${t("Picture")}</span>
        <div class="cam-seg" role="radiogroup" aria-label="${t("Mirrored picture")}">
          ${seg.map(([v, label]) => `<button type="button" role="radio" data-mirror="${v}"
              aria-checked="${mirrorVal()===v}">${t(label)}</button>`).join("")}
        </div>
      </div>
      <div class="cam-note" hidden></div>
    </div>`;

  root.querySelector(".cam-chip").addEventListener("click", e => {
    e.stopPropagation();
    toggleCam(root, !root.classList.contains("open"));
  });
  root.querySelector(".cam-refresh").addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.classList.add("spin");
    await loadCamList();
    btn.classList.remove("spin");
    if(root.classList.contains("open")) fillCamList(root);
    renderCamChips();                              // the chip's missing dot too
  });
  root.querySelector(".cam-list").addEventListener("click", e => {
    if(e.target.closest(".cam-use")){
      const n = parseInt(root.querySelector(".cam-idx").value, 10) || 0;
      saveCam(root, {mode:"webcam", index:n, name:"", url:camState.url}, true);
      return;
    }
    const item = e.target.closest(".cam-item");
    if(!item || item.disabled) return;
    if(item.dataset.kind === "stream"){
      showCamUrl(root, true);
      // A stream already saved is one click like a camera; a new one needs its URL.
      if(camState.url) saveCam(root, {mode:"stream", url:camState.url, index:camState.index, name:camState.name}, true);
      return;
    }
    saveCam(root, {mode:"webcam", index:+item.dataset.index,
                   name:item.dataset.name || "", url:camState.url}, true);
  });
  root.querySelector(".cam-connect").addEventListener("click", () => saveStream(root));
  root.querySelector(".cam-seg").addEventListener("click", e => {
    const b = e.target.closest("[data-mirror]");
    if(!b || b.getAttribute("aria-checked") === "true") return;
    // Only sent when touched, so switching camera never copies the old
    // camera's answer onto the new one.
    saveCam(root, {mode:camState.mode, index:camState.index, url:camState.url,
                   name:camState.name, mirror:b.dataset.mirror}, false);
  });
  root.addEventListener("click", e => e.stopPropagation());
  root.addEventListener("keydown", e => {
    if(e.key === "Escape"){ toggleCam(root, false); root.querySelector(".cam-chip").focus(); return; }
    if(e.key === "Enter" && e.target.classList.contains("cam-url")){ e.preventDefault(); saveStream(root); return; }
    if(e.key === "Enter" && e.target.classList.contains("cam-idx")){
      e.preventDefault(); root.querySelector(".cam-use")?.click(); return;
    }
    // Arrow keys walk the list, as in any radio group.
    if((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.closest(".cam-list")){
      const items = [...root.querySelectorAll(".cam-item:not([disabled])")];
      const i = items.indexOf(e.target.closest(".cam-item"));
      if(i < 0) return;
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    }
  });
}

function renderCamChips(){
  // Signature covers the setting *and* its rendered text, so a language
  // switch rebuilds but the 3 s status poll does not churn the DOM.
  const sig = [camState.mode, camState.index, camState.url||"", camState.name||"",
               mirrorVal(), camChipText(), camMissing()].join("|");
  document.querySelectorAll("[data-cam]").forEach(root => {
    // Never rebuild a chip that is open — it would close under the pointer.
    if(root.classList.contains("open") || root.dataset.camSig === sig) return;
    buildCamChip(root);
    root.dataset.camSig = sig;
  });
}

function toggleCam(root, open){
  if(open) closeCamChips();                       // one open at a time
  root.classList.toggle("open", open);
  root.querySelector(".cam-pop").hidden = !open;
  root.querySelector(".cam-chip").setAttribute("aria-expanded", String(open));
  if(!open){
    renderCamChips();                             // catch up on anything the poll skipped
    return;
  }
  // The URL field only shows for a stream, or once "Phone / IP stream" is clicked.
  root.querySelector(".cam-url-row").hidden = true;
  fillCamList(root);                              // last known list, instantly
  camRunningNote(root);
  const focusCurrent = () => (root.querySelector(".cam-item[aria-checked='true']")
                             || root.querySelector(".cam-item"))?.focus();
  focusCurrent();
  // Re-listed on every open, so a camera plugged in since the last look appears.
  loadCamList().then(() => {
    if(!root.classList.contains("open")) return;
    const had = document.activeElement?.closest?.(".cam-list");
    fillCamList(root);
    if(had) focusCurrent();
  });
}

async function loadCamList(){
  try{
    const r = await fetch("/api/cameras");
    const data = await r.json();
    camList = Array.isArray(data.cameras) ? data.cameras : [];
    // An older hub sends no `listed`; a non-empty list proves it listed.
    camListed = data.listed === true || camList.length > 0;
  }catch(e){ camList = camList || []; }
}

function fillCamList(root){
  const list = root.querySelector(".cam-list");
  const cams = camList || [];
  const stream = camState.mode === "stream";
  const rows = cams.map(c => ({index:c.index, name:c.name, virtual:!!c.virtual}));
  // The saved camera is unplugged: keep it listed rather than silently
  // showing a different one as the choice.
  if(!stream && camState.name && camList && !cams.some(c => c.name === camState.name))
    rows.push({index:camState.index, name:camState.name, gone:true});
  // Prefer the saved name (its index may have shifted), then the index.
  const hit = stream ? null
    : (camState.name ? rows.find(r => r.name === camState.name && r.index === camState.index)
                       || rows.find(r => r.name === camState.name)
                     : rows.find(r => r.index === camState.index));
  const item = (attrs, body, on, extra="") => `<button type="button" role="radio"
      class="cam-item${extra}" aria-checked="${on}" ${attrs}>${body}
      <span class="cam-tick" aria-hidden="true">${on ? I.check : ""}</span></button>`;
  let html = rows.map(r => item(
    `data-kind="webcam" data-index="${r.index}" data-name="${esc(r.name)}" ${r.gone?"disabled":""}`,
    `<span class="cam-ic">${I.camera}</span>
     <span class="cam-nm">${esc(r.name)}</span>
     ${r.gone ? `<span class="cam-tag cam-tag-warn">${t("not plugged in")}</span>` : ""}
     ${r.virtual ? `<span class="cam-tag" title="${esc(t("Listed by DirectShow only. Usually a virtual camera, such as OBS."))}">${t("virtual")}</span>` : ""}`,
    r === hit, r.gone ? " cam-gone" : "")).join("");
  if(!rows.length){
    // No names to show: say why, and keep a plain number as the way through.
    html += `<div class="cam-empty">${camList === null ? t("Looking for cameras...")
      : camListed ? t("No cameras found. Plug one in, then refresh.")
      : t("Camera names are not available here. Choose by number.")}</div>`;
    if(camList !== null) html += `<div class="cam-idx-row">
        <span>${t("Camera number")}</span>
        <input class="cam-idx" type="number" min="0" max="9" step="1"
               value="${camState.index}" aria-label="${t("Camera number")}">
        <button type="button" class="cam-use btn-mini">${t("Use")}</button>
      </div>`;
  }
  html += item('data-kind="stream"',
    `<span class="cam-ic">${I.stream}</span>
     <span class="cam-nm">${t("Phone / IP stream")}</span>
     ${camState.url ? `<span class="cam-sub">${esc(camState.url)}</span>` : ""}`,
    stream, " cam-item-stream");
  list.innerHTML = html;
  showCamUrl(root, stream || !root.querySelector(".cam-url-row").hidden);
}

function showCamUrl(root, on){
  const row = root.querySelector(".cam-url-row");
  const wasHidden = row.hidden;
  row.hidden = !on;
  if(on && wasHidden && !camState.url) root.querySelector(".cam-url").focus();
}

// Changing camera mid-run is allowed but only reaches the next launch; say so
// only when it applies, rather than printing it under every choice.
function camRunningNote(root){
  const note = root.querySelector(".cam-note");
  const tool = TOOLS.find(tool => currentRunning[tool.key]);
  note.hidden = !tool;
  if(tool) note.textContent = t("{test} is running. A change here applies to its next launch.",
                                {test: t(tool.title)});
}

function closeCamChips(){
  document.querySelectorAll("[data-cam].open").forEach(r => toggleCam(r, false));
}
document.addEventListener("click", closeCamChips);
document.addEventListener("keydown", e => { if(e.key === "Escape") closeCamChips(); });

function saveStream(root){
  const url = root.querySelector(".cam-url").value.trim();
  saveCam(root, {mode:"stream", url, index:camState.index, name:camState.name}, true);
}

async function saveCam(root, camera, close){
  if(root.classList.contains("busy")) return;
  root.classList.add("busy");
  try{
    const r = await fetch("/api/camera", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({camera})
    });
    const data = await r.json();
    toast(tMsg(data.message) || t(data.ok?"Done":"Failed"), data.ok?"ok":"fail");
    if(!data.ok){                                 // leave it open to be fixed
      if(camera.mode === "stream") root.querySelector(".cam-url")?.focus();
      return;
    }
    camState = data.camera;
    if(close){
      toggleCam(root, false);
      root.querySelector(".cam-chip")?.focus();
    } else {
      // Stays open (the Picture switch): refresh its contents in place.
      root.querySelectorAll("[data-mirror]").forEach(b =>
        b.setAttribute("aria-checked", String(b.dataset.mirror === mirrorVal())));
      fillCamList(root);
    }
    renderCamChips();
  }catch(e){ toast(t("Request failed"),"fail"); }
  finally{ root.classList.remove("busy"); }
}

// Asked once up front so the chip can show a saved camera that is unplugged
// before anyone opens it.
loadCamList().then(renderCamChips);

/* ── "Why This" page render (build once) ─────────────────────────── */
function renderWhy(){
  if(whyBuilt) return;

  const pillars = document.getElementById("why-pillars");
  if(pillars) pillars.innerHTML = WHY_PILLARS.map(p => `<div class="pillar">
    <div class="pillar-ic">${I[p.icon]}</div>
    <h4>${t(p.title)}</h4><p>${t(p.text)}</p></div>`).join("");

  const legend = document.getElementById("why-legend");
  if(legend) legend.innerHTML = ["yes","partial","planned","no"].map(k => {
    const s = CMP_STATES[k];
    return `<span class="cmp-key ${s.cls}">${I[s.icon]}${t(s.word)}</span>`;
  }).join("");

  const matrix = document.getElementById("why-matrix");
  if(matrix){
    const head = `<tr><th scope="col" class="cmp-cap-h">${t("Capability")}</th>${
      CMP_COLS.map((c,i) => `<th scope="col"${i===0?' class="cmp-own"':''}>${t(c)}</th>`).join("")}</tr>`;
    const rows = WHY_MATRIX.map(r => `<tr><th scope="row">${t(r.cap)}</th>${
      r.cells.map((state,i) => {
        const s = CMP_STATES[state], w = t(s.word);
        return `<td${i===0?' class="cmp-own"':''}>
          <span class="cmp-cell ${s.cls}" aria-label="${w}" title="${w}">
            ${I[s.icon]}<span>${w}</span></span></td>`;
      }).join("")}</tr>`).join("");
    matrix.innerHTML = `<table class="cmp"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  }

  renderLiveDemo();
  whyBuilt = true;
}

/* ── Ripple effect ───────────────────────────────────────────────── */
function addRipple(btn, e){
  const r = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const size = Math.max(r.width, r.height);
  ripple.style.width = ripple.style.height = size+"px";
  ripple.style.left = (e.clientX-r.left-size/2)+"px";
  ripple.style.top = (e.clientY-r.top-size/2)+"px";
  btn.appendChild(ripple);
  setTimeout(()=>ripple.remove(), 500);
}

/* ── Status pills ────────────────────────────────────────────────── */
const statusEl = document.getElementById("status-row");
let wasRunning = false;

/* Signature-guarded, like renderCamChips(): the 3 s poll must not churn the
   DOM, but the row still has to follow the payload. It used to be built once
   behind a `statusBuilt` latch, and on the published dashboard the first
   /api/status answer is the connector's canned offline one (static-api.js) —
   fetched before the hub probe resolves. The pills then read "null / Missing"
   for the rest of the session, including after a hub connected. */
function renderStatus(s){
  const sig = [s.python, s.model_present, s.face_model_present,
               s.opencv, s.mediapipe, getLang()].join("|");
  if(statusEl.dataset.sig !== sig){
    let html = "";
    html += pill(s.python == null ? null : true, "Python", s.python);
    html += pill(s.model_present, t("Hand model"));
    html += pill(s.face_model_present, t("Face model"));
    html += pill(s.opencv, "OpenCV");
    html += pill(s.mediapipe, "MediaPipe");
    statusEl.innerHTML = html;
    statusEl.dataset.sig = sig;
  }
  if(s.camera){
    camState = s.camera;
    renderCamChips();
  }
  // Same rail as the camera: the chip follows the poll rather than needing an
  // endpoint of its own. `profile` is a snapshot, so an absent one is {}.
  window.setActiveProfile?.(s.profile || {});
  if(!cardsBuilt){
    currentRunning = s.running || {};
    buildCards();
  } else {
    updateCardStates(s.running);
  }
  // A test that just stopped has written its session to results/; refetch so
  // the readings strip shows it without a reload.
  const busy = Object.values(s.running || {}).some(Boolean);
  if(wasRunning && !busy){
    // The session it just wrote is the one the assign card offers to move, so
    // profiles.js does the refetch and calls renderVitals() when it lands.
    if(window.afterRun) window.afterRun();
    else loadVitals(true);
  }
  wasRunning = busy;
  renderAnalysing(s.analysing);
}

/* `ok` is tri-state: null means "not known yet" — a hub that has not answered
   is not the same thing as a missing dependency, and a green dot beside the
   literal `null` was the worst of both readings. The light carries the state;
   only Python shows a value (its version), and the state stays in the tooltip. */
function pill(ok, label, value){
  const cls = ok == null ? "unknown" : (ok ? "ok" : "bad");
  const state = t(ok == null ? "Unknown" : (ok ? "Ready" : "Missing"));
  const shown = value === undefined ? "" : `<span>${value == null || value === "" ? "&#8212;" : value}</span>`;
  return `<div class="s-pill" title="${label}: ${state}"><span class="s-dot ${cls}" aria-hidden="true"></span><b>${label}</b>${shown}</div>`;
}

/* ── Toast ────────────────────────────────────────────────────────── */
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg, type){
  const icons = {ok:I.check, fail:I.x, info:I.info};
  toastEl.innerHTML = `<span class="toast-icon">${icons[type]||icons.info}</span> ${msg}`;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove("show"), 2800);
}

/* ── API ──────────────────────────────────────────────────────────── */
async function refresh(){
  try{
    const r = await fetch("/api/status");
    renderStatus(await r.json());
  }catch(e){}
}

/* The hub state changed under us (static-api.js). Everything cached from the
   previous state has to go: `analysisSessions` holds the canned empty list
   while offline, and keeping it would leave the readings strip blank after a
   pairing. */
window.rehydrate = function(){
  analysisSessions = null;
  refresh();
  window.reloadProfiles?.();          // the roster came from the old hub too
  loadCamList().then(renderCamChips); // and so did the camera list
  loadVitals(true);
  const page = document.getElementById("page-analysis");
  if(page && page.classList.contains("active")) loadAnalysis();
};

async function act(kind, key, profileId){
  // Launching with nobody chosen, while there are people to choose from, is
  // how runs end up filed under nobody. Ask first (profiles.js); the pick
  // then rides in the launch request itself.
  if(kind === "launch" && profileId === undefined && window.needsProfilePick?.()){
    const tool = TOOLS.find(x => x.key === key);
    window.pickThenLaunch(tool ? t(tool.title) : "", id => act(kind, key, id));
    return;
  }
  try{
    const body = {test:key, lang:getLang()};
    if(profileId !== undefined) body.profile_id = profileId;
    const r = await fetch("/api/"+kind, {
      method:"POST", headers:{"Content-Type":"application/json"},
      // The language rides along so a switch made a moment ago cannot lose
      // the race against the /api/lang POST that persists it.
      body: JSON.stringify(body)
    });
    const data = await r.json();
    // Server text is English; tMsg maps the known strings (i18n.zh.js).
    toast(tMsg(data.message) || t(data.ok?"Done":"Failed"), data.ok?"ok":"fail");
    if(data.running) updateCardStates(data.running);
    setTimeout(refresh, 400);
  }catch(e){ toast(t("Request failed"),"fail"); }
}

/* ── Scroll reveal ───────────────────────────────────────────────── */
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting) e.target.classList.add("visible");
  });
}, {threshold:.15});
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));

/* ── Longitudinal Analysis ───────────────────────────────────────────
   Reads /api/sessions and charts each test's headline metric over time.
   Reference bands are provisional (mirrors the detail-page copy). Colours
   are the shared status tokens; the chart line is a neutral accent so it
   reads over every band. Status is never colour-alone — dots carry a hover
   label, the readout names the band, and a legend maps colour → word. */

const TREND = {
  finger_tapping: {
    label:"Finger Tapping", icon:"hand", page:"iiv",
    headline:{ key:"cv_pct", name:"Rhythm variability", unit:"%", lowerBetter:true,
      bands:[{max:15,status:"ok"},{max:25,status:"warn"},{max:Infinity,status:"bad"}] },
    supporting:[
      {key:"frequency_hz", name:"Tap frequency", unit:"Hz"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"amplitude_cv_pct", name:"Amplitude CV", unit:"%"},
      {key:"decrement_pct_per_s", name:"Speed decrement", unit:"%/s"},
    ],
    // Two test types share the CV% headline; each foregrounds its own third metric
    // (Big & Fast → speed decrement, Paced → beat-sync tightness).
    modes:[
      { key:"big_and_fast", label:"Big & Fast", supporting:[
        {key:"frequency_hz", name:"Tap frequency", unit:"Hz"},
        {key:"confidence_pct", name:"Confidence", unit:"%"},
        {key:"amplitude_cv_pct", name:"Amplitude CV", unit:"%"},
        {key:"decrement_pct_per_s", name:"Speed decrement", unit:"%/s"},
      ]},
      { key:"paced", label:"Paced", supporting:[
        {key:"frequency_hz", name:"Tap frequency", unit:"Hz"},
        {key:"confidence_pct", name:"Confidence", unit:"%"},
        {key:"amplitude_cv_pct", name:"Amplitude CV", unit:"%"},
        {key:"sync_sd_ms", name:"Beat-sync SD", unit:"ms"},
      ]},
    ],
  },
  spiral: {
    label:"Spiral Tracing", icon:"spiral", page:"spiral",
    // Two scores, as on the test's own result screen (core/spiral/metrics.py
    // engine 4): line accuracy (how close to the spiral) and tremor. The card
    // switches between them; each is coloured by its own band (statusKey),
    // not the run's overall verdict, so a steady-but-shaky run plots high on
    // accuracy in green and high on tremor in amber. The home strip shows the
    // first view. App-0.2 runs have neither score and so no point here.
    // `typical` is the score's own edge (ACC_TYPICAL in core/spiral/metrics.py),
    // shown under the value on the home ledger. It is not `bands`, which would
    // also paint the Analysis chart.
    headline:{ key:"accuracy_score", name:"Line accuracy", unit:"", lowerBetter:false,
               bands:null, statusKey:"accuracy_status", typical:"≥ 60", typicalAt:60 },
    views:[
      { key:"accuracy", label:"Line accuracy",
        headline:{ key:"accuracy_score", name:"Line accuracy", unit:"", lowerBetter:false,
                   bands:null, statusKey:"accuracy_status" } },
      { key:"tremor", label:"Tremor",
        headline:{ key:"tremor_score", name:"Tremor (higher = more)", unit:"", lowerBetter:true,
                   bands:null, statusKey:"tremor_status" } },
    ],
    supporting:[
      {key:"mean_dev_pct", name:"Mean deviation", unit:"%"},
      {key:"tremor_pct", name:"Tremor amplitude", unit:"%"},
      {key:"smoothness_index", name:"Smoothness index", unit:""},
      {key:"completion_pct", name:"Completion", unit:"%"},
    ],
  },
  oculomotor: {
    label:"Eye Movement", icon:"eye", page:"oculomotor",
    headline:{ key:"error_rate_pct", name:"Anti-saccade error rate", unit:"%", lowerBetter:true,
      bands:[{max:20,status:"ok"},{max:40,status:"warn"},{max:Infinity,status:"bad"}] },
    supporting:[
      {key:"anti_minus_pro_ms", name:"Anti − Pro latency", unit:"ms"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"corrected_rate_pct", name:"Corrected errors", unit:"%"},
      {key:"valid_trials", name:"Valid trials", unit:""},
      // Runs with Part 2 skipped have no headline but still measure these.
      {key:"prosaccade_latency_ms", name:"Pro-saccade latency", unit:"ms"},
      {key:"fixation_rms_pct", name:"Fixation jitter (RMS)", unit:"%"},
    ],
  },
  ddk: {
    label:"Speech Rhythm", icon:"mic", page:"ddk",
    headline:{ key:"rhythm_cv_pct", name:"Syllable rhythm variability", unit:"%", lowerBetter:true,
      bands:[{max:15,status:"ok"},{max:25,status:"warn"},{max:Infinity,status:"bad"}] },
    // Not the phoneme model's order errors: they are experimental and not
    // charted until validated on real voices (SPEECH_TEST_PLAN.md §3.1b).
    supporting:[
      {key:"syllable_rate_hz", name:"Syllable rate", unit:"/s"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"npvi", name:"nPVI", unit:""},
      {key:"decrement_pct_per_s", name:"Speed decrement", unit:"%/s"},
    ],
  },
  phonation: {
    label:"Voice Steadiness", icon:"voice", page:"ddk",
    // Lower edge is the MDVP jitter threshold (1.04%); the upper edge is not
    // from a source — both provisional (core/speech/tasks.py).
    headline:{ key:"jitter_pct", name:"Jitter", unit:"%", lowerBetter:true,
      bands:[{max:1.04,status:"ok"},{max:2.08,status:"warn"},{max:Infinity,status:"bad"}] },
    supporting:[
      {key:"shimmer_pct", name:"Shimmer", unit:"%"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"hnr_db", name:"HNR", unit:"dB"},
      {key:"vocal_tremor_hz", name:"Vocal tremor", unit:"Hz"},
    ],
  },
  tremor: {
    label:"Hand Tremor", icon:"wave", page:"tremor",
    // A supporting check (TREMOR_RESTRUCTURE_PLAN.md §2): off the home
    // readings strip, charted after the screening tests, and its dots drawn
    // as Logged whatever the recorded verdict. The verdict itself is still
    // saved and read out in words (tremorFinding); only the colour goes.
    secondary:true,
    headline:{ key:"tremor_amp_pct", name:"Tremor-band movement (estimate)", unit:"%", lowerBetter:true,
      bands:null, neutral:true },
    supporting:[
      {key:"tremor_peak_hz", name:"Tremor peak", unit:"Hz"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"asymmetry_ratio", name:"Left / right ratio", unit:"×"},
      {key:"cam_glove_hz_diff", name:"Camera vs glove", unit:"Hz"},
    ],
  },
  gait: {
    label:"Walking", icon:"walk", page:"gait",
    // Seated part only so far. The bands mirror core/gait/metrics.py and are
    // provisional (Bohannon 2006 / Duncan 2011, still to be verified).
    headline:{ key:"sts5_s", name:"Five sit-to-stands", unit:"s", lowerBetter:true,
      bands:[{max:13,status:"ok"},{max:16,status:"warn"},{max:Infinity,status:"bad"}] },
    supporting:[
      {key:"leg_right_rate_hz", name:"Right leg stamps", unit:"/s"},
      {key:"confidence_pct", name:"Confidence", unit:"%"},
      {key:"leg_left_rate_hz", name:"Left leg stamps", unit:"/s"},
      {key:"failed_attempts", name:"Failed rises", unit:""},
    ],
  },
};
// Supporting checks (TREND[k].secondary) go last: the Analysis page opens a
// "Supporting checks" group before the first of them.
const TREND_ORDER = ["finger_tapping","spiral","oculomotor","ddk","phonation","gait","tremor"];
const ST = {
  ok:  {word:"Typical",   dot:"#65D6A6", band:"rgba(101,214,166,.13)"},
  warn:{word:"Monitor",   dot:"#F5A524", band:"rgba(245,165,36,.14)"},
  bad: {word:"Follow-up", dot:"#EF4444", band:"rgba(239,68,68,.14)"},
  none:{word:"Logged",    dot:"#989EFF", band:"transparent"},
};
const INK_MUTED = "#B8BED0", INK_DIM = "#8089A6", GRID = "#2A3350", LINE_C = "#989EFF";

/* Which patient a group's session belongs to. A group is many people, so
   after a clinic visit its sessions are tagged by hand from their saved times:
   record.patient = {number, day, diagnosis, demo?}. `demo` marks a run the
   examiner did to show the patient the test, not the patient's own. */
const DIAGNOSES = {
  pd:  {short:"PD",  name:"Parkinson's disease"},
  et:  {short:"ET",  name:"Essential tremor"},
  pst: {short:"PST", name:"Parkinsonian tremor"},
};
function patientOf(s){
  const p = s && s.patient;
  return p && Number.isFinite(p.number) ? p : null;
}
// Two groups can each have a patient 3, so the key carries the group.
function patientKey(s){
  const p = patientOf(s);
  return p ? `${(s.profile && s.profile.id) || ""}:${p.number}` : null;
}
function diagShort(p){
  const d = DIAGNOSES[p.diagnosis];
  return d ? d.short : String(p.diagnosis || "").toUpperCase();
}
function diagName(p){
  const d = DIAGNOSES[p.diagnosis];
  return d ? t(d.name) : String(p.diagnosis || "");
}

let analysisFilter = "all";
/* Whose history is on screen. "all" pools everyone - what this page did before
   profiles existed - "none" is the sessions nobody claimed, and anything else
   is a profile id. null means the person has not chosen yet, and resolves to
   whoever the chip is set to, so the dashboard opens on the patient who is
   about to be tested rather than on a pooled line. */
let analysisProfile = null;
let analysisPatient = null;   // patientKey() of the one patient shown, or null
let analysisSessions = null;
let analysisModes = {};   // per-test selected sub-mode (e.g. finger_tapping → "paced")
let analysisViews = {};   // per-test selected score (spiral → "tremor")
let sessionCalendarState = {}; // per trend/mode: visible month + selected day

function fmtNum(v){
  if(v==null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if(a >= 1000) return Math.round(v).toLocaleString();
  if(a >= 100)  return v.toFixed(0);
  if(a >= 10)   return v.toFixed(1);
  return v.toFixed(2);
}
function fmtDate(iso){
  return new Date(iso).toLocaleDateString(i18nLocale(),{month:"short",day:"numeric"});
}
function fmtDateTime(iso){
  return new Date(iso).toLocaleString(i18nLocale(),
    {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}
function bandFor(v, bands){
  if(!bands) return "none";
  for(const b of bands){ if(v <= b.max) return b.status; }
  return "none";
}
// Every test scores its own recording and stores that verdict on the session
// (core/*/metrics.py). Prefer it: it is the same judgement the test showed the
// person at the time, and it exists for the spiral, which has no chart bands.
// Older records without one still fall back to the provisional bands.
const VERDICT = {success:"ok", warning:"warn", danger:"bad", info:"none"};
function statusOf(session, h){
  if(h.neutral) return "none";            // a supporting check: no verdict colour
  const m = session.metrics || {};
  // a test with more than one score colours each by its own band (spiral)
  if(h.statusKey && VERDICT[m[h.statusKey]]) return VERDICT[m[h.statusKey]];
  if(m.status && VERDICT[m.status]) return VERDICT[m.status];
  return bandFor(m[h.key], h.bands);
}

/* A tremor run's finding in words, in place of a coloured verdict. The saved
   verdict (metrics.status) is unchanged; this only says it neutrally. */
const TREMOR_HOLDS = {rest_palm_up:"Palms up", rest_palm_down:"Palms down", postural:"Arms out",
                      rest:"Rest", rest_count:"Rest, counting"};
function tremorFinding(m){
  if(!m || m.scoreable === false) return m && m.reason ? t(m.reason) : "";
  if(m.tremor_peak_hz == null) return t("No rhythmic shaking found");
  const [hold, hand] = String(m.tremor_where || ":").split(":");
  const where = [TREMOR_HOLDS[hold] ? t(TREMOR_HOLDS[hold]) : hold,
                 hand ? t(hand === "left" ? "Left hand" : "Right hand") : ""]
    .filter(Boolean).join(", ");
  const hz = fmtNum(m.tremor_peak_hz);
  return m.status === "warning"
    ? t("A weak rhythm at {hz} Hz ({where}) - repeat to confirm", {hz, where})
    : t("Rhythmic shaking at {hz} Hz ({where})", {hz, where});
}

function profileFilter(){
  const list = analysisSessions || [];
  const has = id => id === "none"
    ? list.some(sn => !(sn.profile && sn.profile.id))
    : list.some(sn => sn.profile && sn.profile.id === id);
  // A pin can outlive its sessions: move the last one to somebody else and the
  // person it names has no button left to click back from. Drop it rather than
  // strand the page on an empty view it cannot leave. Only once sessions have
  // actually loaded — an empty list is "not yet", not "nobody".
  if(analysisProfile === "all") return "all";     // an explicit choice to pool
  if(analysisProfile){
    if(!list.length || has(analysisProfile)) return analysisProfile;
    analysisProfile = null;
  }
  // Never default to a group: its runs are different people, and the home
  // readings strip would present them as one person's latest numbers.
  const active = window.activeProfileId?.();
  return active && has(active) && !window.isGroupProfile?.(active) ? active : "all";
}

function profileSessions(){
  const list = analysisSessions || [];
  const f = profileFilter();
  if(f === "all") return list;
  if(f === "none") return list.filter(sn => !(sn.profile && sn.profile.id));
  return list.filter(sn => sn.profile && sn.profile.id === f);
}

/* The one place the person and patient filters are applied. The chart, the
   calendar and the home readings strip all read through it, so they cannot
   disagree about which sessions exist. */
function visibleSessions(){
  const list = profileSessions();
  if(!analysisPatient) return list;
  const mine = list.filter(sn => patientKey(sn) === analysisPatient);
  if(mine.length) return mine;
  analysisPatient = null;          // a stale pick, as profileFilter() drops one
  return list;
}

/* A group's sessions are different people: charted as separate dots, with no
   line, no "latest" readout and no change-since-last chip. */
function pooledView(){
  const f = profileFilter();
  if(f === "all" || f === "none") return false;
  if(window.isGroupProfile?.(f)) return true;
  // A removed group still says what it was in its sessions' snapshots.
  return (analysisSessions || []).some(sn => sn.profile && sn.profile.id === f
    && sn.profile.kind === "group");
}

function setAnalysisProfile(id){
  analysisProfile = id;
  analysisPatient = null;
  renderAnalysis();
  renderVitals();
}

async function loadAnalysis(){
  const body = document.getElementById("analysis-body");
  if(!body) return;
  if(!analysisSessions) body.innerHTML = `<div class="analysis-empty">${t("Loading sessions…")}</div>`;
  try{
    const r = await fetch("/api/sessions");
    analysisSessions = (await r.json()).sessions || [];
  }catch(e){ analysisSessions = []; }
  renderAnalysis();
}

function renderAnalysis(){
  const sessions = visibleSessions();
  const byTest = {};
  TREND_ORDER.forEach(k => byTest[k] = []);
  sessions.forEach(s => { if(byTest[s.test]) byTest[s.test].push(s); });

  renderAnalysisSummary(sessions, byTest);
  renderAnalysisPeople();
  renderAnalysisPatients();
  renderAnalysisFilter(byTest);

  const body = document.getElementById("analysis-body");
  if(!body) return;                       // same guard loadAnalysis() already has
  if(!sessions.length && (analysisSessions || []).length){
    // Someone has sessions, just not this person - never the fresh-install copy.
    body.innerHTML = `<div class="analysis-empty">
      <div class="analysis-empty-icon">${I.chart}</div>
      <h3>${t("Nothing logged for this person yet")}</h3>
      <p>${t("Set them on the profile chip before you launch a test, or move an existing session to them from its report.")}</p>
      <button class="btn btn-primary" onclick="showPage('home')">${I.play} ${t("Go to tests")}</button>
    </div>`;
    return;
  }
  if(!sessions.length){
    body.innerHTML = `<div class="analysis-empty">
      <div class="analysis-empty-icon">${I.chart}</div>
      <h3>${t("No sessions logged yet")}</h3>
      <p>${t("Run a screening test from the dashboard. Each session is saved locally, and its metrics will chart here so you can watch the trend over time.")}</p>
      <button class="btn btn-primary" onclick="showPage('home')">${I.play} ${t("Go to tests")}</button>
    </div>`;
    return;
  }
  const show = TREND_ORDER.filter(k =>
    (analysisFilter==="all" || analysisFilter===k) && byTest[k].length);
  if(!show.length){
    body.innerHTML = `<div class="analysis-empty"><p>${t("No sessions for this test yet.")}</p></div>`;
    return;
  }
  const firstSecondary = show.find(k => TREND[k].secondary);
  body.innerHTML = show.map(k =>
    (k === firstSecondary
      ? `<h3 class="analysis-group">${t("Supporting checks")}
           <span>${t("Not screening results: they help explain the readings above.")}</span></h3>`
      : "") + trendCard(k, byTest[k])).join("");
}

function renderAnalysisSummary(sessions, byTest){
  const el = document.getElementById("analysis-summary");
  const withData = TREND_ORDER.filter(k => byTest[k].length).length;
  let span = "—";
  if(sessions.length){
    const a = fmtDate(sessions[0].timestamp), b = fmtDate(sessions[sessions.length-1].timestamp);
    span = a===b ? a : `${a} – ${b}`;
  }
  const tiles = [
    [t("Total sessions"), sessions.length],
    [t("Tests tracked"), `${withData} / ${TREND_ORDER.length}`],
    [t("Date range"), span],
  ];
  el.innerHTML = tiles.map(([l,v]) =>
    `<div class="sum-tile"><div class="sum-val">${v}</div><div class="sum-label">${l}</div></div>`
  ).join("");
}

/* Who the page can be read as. Only profiles that actually hold sessions get a
   button - a roster of ten with one tested would be a row of dead ends - plus
   "Unassigned" when any session has no profile. */
function renderAnalysisPeople(){
  const el = document.getElementById("analysis-profile");
  const who = document.getElementById("analysis-who");
  if(!el) return;
  const all = analysisSessions || [];
  const roster = window.profileList?.() || [];
  const counts = {};
  let unassigned = 0;
  all.forEach(sn => {
    const id = sn.profile && sn.profile.id;
    if(id) counts[id] = (counts[id] || 0) + 1; else unassigned++;
  });

  // [key, label, profile-ish for the avatar]. People first, then groups:
  // groups are pools, not people.
  const isGrp = pr => pr.kind === "group" || !!window.isGroupProfile?.(pr.id);
  const opts = [["all", t("All people"), null]];
  const add = wantGroup => {
    roster.forEach(pr => {
      if(counts[pr.id] && isGrp(pr) === wantGroup) opts.push([pr.id, pr.name, pr]);
    });
    // A session outlives the profile it names - the record keeps its own
    // snapshot - so offer those names too rather than hiding the sessions.
    all.forEach(sn => {
      const pr = sn.profile;
      if(pr && pr.id && isGrp(pr) === wantGroup && !opts.some(o => o[0] === pr.id))
        opts.push([pr.id, pr.name || t("Removed profile"), pr]);
    });
  };
  add(false);
  add(true);
  if(unassigned) opts.push(["none", t("Unassigned"), null]);

  // One person and nothing unassigned: the row would be a single button that
  // does nothing. Hide it and let the line below carry the name.
  const cur = profileFilter();
  el.hidden = opts.length < 3;
  el.innerHTML = opts.map(([k, label, pr]) =>
    `<button class="seg-btn ${cur===k?"active":""}" role="tab"
       aria-selected="${cur===k}" data-person="${esc(k)}">${pr && window.profileAvatar
         ? window.profileAvatar(pr, "xs") + " " : ""}${esc(label)}</button>`).join("");
  el.querySelectorAll("[data-person]").forEach(b =>
    b.onclick = () => setAnalysisProfile(b.dataset.person));

  if(who){
    who.innerHTML = whoLine(cur);
    // profiles.js owns the form; this page only says which person it is for.
    who.querySelector("[data-add-person]")?.addEventListener("click",
      () => window.openProfileEditor?.(""));
    who.querySelector("[data-edit-person]")?.addEventListener("click", ev =>
      window.openProfileEditor?.(ev.currentTarget.dataset.editPerson));
  }
}

/* "Jane Chen - Female - 68 - right-handed". Age and sex are the reason the
   profile exists, so they stay visible while the trend is being read. */
function whoLine(filterId){
  // Editing is offered only for a person still on the roster: a session can
  // outlive the profile it names, and there is nothing left to edit then.
  const onRoster = filterId !== "all" && filterId !== "none"
    && !!window.profileById?.(filterId);
  const acts = `<span class="who-acts">
      ${onRoster ? `<button class="who-act" type="button"
        data-edit-person="${esc(filterId)}">${t("Edit details")}</button>` : ""}
      <button class="who-act" type="button" data-add-person>${t("Add a person")}</button>
    </span>`;

  if(filterId === "none")
    return `<span class="who-name">${t("Unassigned sessions")}</span>
      <span class="who-note">${t("Recorded with no profile set.")}</span>${acts}`;
  // Without a line of its own the button sat alone on an otherwise empty row.
  if(filterId === "all")
    return `<span class="who-note">${t("Everyone's sessions, together.")}</span>${acts}`;
  const pr = window.profileById?.(filterId)
    || (visibleSessions().slice(-1)[0] || {}).profile;
  if(!pr || !pr.name) return acts;
  const detail = window.describeProfile?.(pr) || "";
  const av = window.profileAvatar ? window.profileAvatar(pr, "sm") : "";
  const pt = analysisPatient && patientOf(visibleSessions()[0]);
  return `${av}<span class="who-name">${esc(pr.name)}</span>`
    + (detail ? `<span class="who-detail">${esc(detail)}</span>` : "")
    + (pt ? `<span class="who-note">${esc(t("Patient #{n} · {dx}", {n:pt.number, dx:diagName(pt)}))}</span>`
      : pooledView() ? `<span class="who-note">${t("Different people. Not one person's trend.")}</span>` : "")
    + acts;
}

/* The patients behind a group's sessions, by visit day (record.patient).
   Drawn only when the sessions on screen carry patient tags. Choosing a
   patient narrows every card to their runs; choosing them again shows all. */
function renderAnalysisPatients(){
  const el = document.getElementById("analysis-patients");
  if(!el) return;
  const byKey = new Map();
  profileSessions().forEach(sn => {
    const k = patientKey(sn);
    if(!k) return;
    if(!byKey.has(k)) byKey.set(k, {key:k, p:patientOf(sn), runs:[]});
    byKey.get(k).runs.push(sn);
  });
  if(!byKey.size){ el.hidden = true; el.innerHTML = ""; return; }

  const days = new Map();          // visit date → its patients, in number order
  [...byKey.values()].sort((a,b) => a.p.number - b.p.number).forEach(pt => {
    const dk = localDateKey(pt.runs[0].timestamp);
    if(!days.has(dk)) days.set(dk, []);
    days.get(dk).push(pt);
  });

  const card = pt => {
    const {p, runs} = pt, n = runs.length;
    const demos = runs.filter(sn => patientOf(sn).demo).length;
    const span = `${fmtTime(runs[0].timestamp)} – ${fmtTime(runs[n-1].timestamp)}`;
    const on = analysisPatient === pt.key;
    return `<button class="pt-card${on?" is-active":""}" type="button"
        data-patient="${esc(pt.key)}" aria-pressed="${on}"
        title="${esc(t("Patient #{n} · {dx}", {n:p.number, dx:diagName(p)}))}">
      <span class="pt-num">#${p.number}</span>
      <span class="pt-dx dx-${esc(p.diagnosis)}">${esc(diagShort(p))}</span>
      <span class="pt-time">${n > 1 ? span : fmtTime(runs[0].timestamp)}</span>
      <span class="pt-runs">${n === 1 ? t("1 session") : t("{n} sessions", {n})}${demos
        ? ` · <span class="pt-demo">${t("Demo")}</span>` : ""}</span>
    </button>`;
  };
  const dayBlock = ([dk, pts]) => {
    const [y, m, d] = dk.split("-").map(Number);
    const date = new Date(y, m-1, d).toLocaleDateString(i18nLocale(),
      {weekday:"long", month:"long", day:"numeric"});
    const order = Object.keys(DIAGNOSES);
    const mix = [...new Set(pts.map(pt => pt.p.diagnosis))]
      .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
      .map(dx => `${pts.filter(pt => pt.p.diagnosis === dx).length} ${esc(diagShort({diagnosis:dx}))}`)
      .join(" · ");
    const dayNo = pts[0].p.day;
    return `<div class="pt-day">
      <div class="pt-day-head">${dayNo ? `<strong>${t("Day {n}", {n:dayNo})}</strong>` : ""}
        <span>${date}</span><span class="pt-mix">${mix}</span></div>
      <div class="pt-grid">${pts.map(card).join("")}</div>
    </div>`;
  };

  el.hidden = false;
  el.innerHTML = `<div class="pt-head">
      <h3>${t("Patients")}</h3>
      <span>${t("{n} patients, grouped by when their tests were saved", {n:byKey.size})}</span>
      ${analysisPatient ? `<button class="who-act" type="button" data-patient="">${t("Show all patients")}</button>` : ""}
    </div>
    ${[...days.entries()].map(dayBlock).join("")}`;
  el.querySelectorAll("[data-patient]").forEach(b => b.onclick = () => {
    const k = b.dataset.patient;
    analysisPatient = k && k !== analysisPatient ? k : null;
    renderAnalysis();
    renderVitals();
  });
}

function renderAnalysisFilter(byTest){
  const el = document.getElementById("analysis-filter");
  const opts = [["all",t("All tests")]].concat(
    TREND_ORDER.filter(k=>byTest[k].length).map(k=>[k, t(TREND[k].label)]));
  el.innerHTML = opts.map(([k,label]) =>
    `<button class="seg-btn ${analysisFilter===k?"active":""}" role="tab"
       aria-selected="${analysisFilter===k}" data-filter="${k}">${label}</button>`).join("");
  el.querySelectorAll("[data-filter]").forEach(b =>
    b.onclick = () => { analysisFilter = b.dataset.filter; renderAnalysis(); });
}

function trendCard(key, allSessions){
  const cfg = TREND[key], h = viewHeadline(key, cfg);

  // Optional per-mode split (finger tapping: Big & Fast vs Paced). The toggle
  // swaps everything below the header — chart, readout, and supporting tiles.
  let sessions = allSessions, supporting = cfg.supporting, modeBar = "";
  let calendarKey = key;
  if(cfg.modes){
    const active = activeMode(key, cfg, allSessions);
    calendarKey = `${key}:${active}`;
    const m = cfg.modes.find(x => x.key===active) || cfg.modes[0];
    sessions = allSessions.filter(s => s.mode === active);
    supporting = m.supporting || cfg.supporting;
    modeBar = `<div class="trend-modes" role="tablist" aria-label="${t("Test type")}">${cfg.modes.map(md =>
      `<button class="seg-btn seg-sm ${md.key===active?"active":""}" role="tab"
        aria-selected="${md.key===active}"
        onclick="setTrendMode('${key}','${md.key}')">${t(md.label)}</button>`).join("")}</div>`;
  }

  if(cfg.views){
    const cur = analysisViews[key] || cfg.views[0].key;
    modeBar += `<div class="trend-modes" role="tablist" aria-label="${t("Score")}">${cfg.views.map(v =>
      `<button class="seg-btn seg-sm ${v.key===cur?"active":""}" role="tab"
        aria-selected="${v.key===cur}"
        onclick="setTrendView('${key}','${v.key}')">${t(v.label)}</button>`).join("")}</div>`;
  }

  const calendarPts = cardPoints(sessions, h);
  const pts = calendarPts.filter(p=>p.scoreable);

  const head = `<div class="trend-head">
      <div class="trend-title"><span class="trend-ic">${I[cfg.icon]}</span>
        <div><h3>${t(cfg.label)}</h3>
          <div class="trend-metric">${t(h.name)}${h.unit?` (${h.unit})`:""}</div></div>
      </div>
      <button class="trend-open" onclick="showPage('${cfg.page}')">${t("Details")} ${I.arrowRight}</button>
    </div>`;

  const support = `<div class="trend-support">${supporting.map(m =>
    supportTile(sessions, m)).join("")}</div>`;

  // One patient picked from a group: their runs from a single visit, so no
  // chart over time. How many sessions there were, and the list to open them.
  if(analysisPatient){
    const n = sessions.length, demos = calendarPts.filter(p => p.demo).length;
    return `<div class="trend-card">${head}${modeBar}
      <div class="trend-readout">
        <div class="trend-now"><span class="trend-now-val">${n}</span>
          <span class="trend-now-unit">${n === 1 ? t("session") : t("sessions")}</span></div>
      </div>
      ${demos ? `<div class="trend-span">${t("Includes {n} demo run", {n:demos})}</div>` : ""}
      ${sessionCalendar(calendarPts, h, calendarKey)}
      ${support}</div>`;
  }

  if(!pts.length){
    const partial = calendarPts.some(p => p.partial);
    return `<div class="trend-card">${head}${modeBar}
      <div class="analysis-note">${partial
        ? t("{n} session(s) logged without Part 2, so there is no error rate to chart. Open one from the calendar for its report.",{n:sessions.length})
        : cfg.modes
        ? t("{n} session(s) logged for this type, but none were scoreable for this metric yet.",{n:sessions.length})
        : t("{n} session(s) logged, but none were scoreable for this metric yet.",{n:sessions.length})}</div>
      ${sessionCalendar(calendarPts,h,calendarKey)}
      ${support}</div>`;
  }

  const pooled = pooledView();
  const latest = pts[pts.length-1], prev = pts.length>1 && !pooled ? pts[pts.length-2] : null;
  const st = ST[latest.status];
  const readout = pooled
    ? `<div class="trend-readout"><span class="analysis-note">${t("Different people. Not one person's trend.")}</span></div>`
    : `<div class="trend-readout">
      <div class="trend-now"><span class="trend-now-val">${fmtNum(latest.v)}</span>
        <span class="trend-now-unit">${h.unit}</span></div>
      <span class="badge badge-${latest.status}"><span class="badge-dot"></span>${t(st.word)}</span>
      ${prev ? deltaChip(latest.v, prev.v, h.lowerBetter) : ""}
    </div>`;
  const dateSpan = pts.length>1
    ? `${fmtDate(pts[0].iso)} – ${fmtDate(latest.iso)} · ${t("{n} sessions",{n:pts.length})}`
    : pooled ? t("1 session")
    : t("1 session · a trend line appears after your next");

  const legend = `<div class="trend-legend">
      <span><i style="background:${ST.ok.dot}"></i>${t(ST.ok.word)}</span>
      <span><i style="background:${ST.warn.dot}"></i>${t(ST.warn.word)}</span>
      <span><i style="background:${ST.bad.dot}"></i>${t(ST.bad.word)}</span>
      ${pts.some(p => p.demo) ? `<span><i class="lg-demo"></i>${t("Demo run")}</span>` : ""}
      <span class="trend-legend-note">${t("colour is the verdict the test gave that session")}</span>
    </div>`;

  // The legend explains the chart's dot colours, so it sits with the chart —
  // below the calendar it would be a key to something a screen away.
  return `<div class="trend-card">${head}${modeBar}${readout}
    <div class="trend-span">${dateSpan}</div>
    <div class="trend-chart">${trendSvg(pts, h, pooled)}</div>
    ${legend}
    <div class="trend-hint" role="note" tabindex="0">
      <span class="hint-ic">${I.info}</span><span class="hint-text">${t("Open a report from any chart point, or choose a date in the calendar")}</span>
    </div>
    ${sessionCalendar(calendarPts, h, calendarKey)}
    ${support}</div>`;
}

/* One session as the Analysis page thinks of it. The chart plots only the
   scoreable ones, but the calendar keeps every saved session — a run that
   failed the quality gate still has a report explaining why. */
function isPartialEyeRun(s){
  const sk = (s.metrics && s.metrics.parts_skipped) || [];
  return s.test === "oculomotor" && sk.includes("anti") && sk.length < 3;
}
function cardPoints(sessions, h){
  return sessions.map(s => {
    const v = s.metrics ? s.metrics[h.key] : null;
    const scoreable = v!=null && isFinite(v);
    // An eye run with Part 2 skipped: no headline, but a real report of the
    // parts that were done, so it is not listed as a failed run.
    const partial = !scoreable && isPartialEyeRun(s);
    const patient = patientOf(s);
    return {v, iso:s.timestamp, id:s.session_id, mode:s.mode, scoreable, partial,
            patient, pkey:patientKey(s), demo:!!(patient && patient.demo),
            label:s.metrics ? (h.neutral ? tremorFinding(s.metrics)
                                        : (s.metrics.reason || s.metrics.label)) : null,
            status:scoreable ? statusOf(s,h) : "none"};
  });
}

/* The points behind one calendar, rebuilt from its state key alone
   (`test` or `test:mode`), so a day or month change can redraw that one
   section without re-rendering every card on the page. */
function calendarFor(key){
  const [test, mode] = String(key).split(":");
  const cfg = TREND[test];
  if(!cfg) return null;
  const sessions = visibleSessions().filter(s =>
    s.test===test && (mode ? s.mode===mode : true));
  const h = viewHeadline(test, cfg);
  return {pts: cardPoints(sessions, h), h};
}

// Selected sub-mode for a test: explicit choice, else the mode with the most
// scoreable sessions (so the card opens on its richest trend).
function activeMode(key, cfg, sessions){
  if(analysisModes[key]) return analysisModes[key];
  const hk = cfg.headline.key;
  let best = cfg.modes[0].key, bestN = -1;
  cfg.modes.forEach(md => {
    const n = sessions.filter(s => s.mode===md.key && s.metrics
      && s.metrics[hk]!=null && isFinite(s.metrics[hk])).length;
    if(n > bestN){ bestN = n; best = md.key; }
  });
  return best;
}
function setTrendMode(key, mode){ analysisModes[key] = mode; renderAnalysis(); }

function viewHeadline(key, cfg){
  if(!cfg.views) return cfg.headline;
  const v = cfg.views.find(x => x.key === analysisViews[key]) || cfg.views[0];
  return v.headline;
}
function setTrendView(key, view){ analysisViews[key] = view; renderAnalysis(); }

function deltaChip(cur, prev, lowerBetter){
  const d = cur - prev;
  if(Math.abs(d) < 1e-9) return `<span class="delta delta-flat">${t("no change")}</span>`;
  const improved = lowerBetter ? d < 0 : d > 0;
  const arrow = d > 0 ? I.up : I.down;
  const cls = improved ? "delta-good" : "delta-bad";
  return `<span class="delta ${cls}">${arrow}${fmtNum(Math.abs(d))} ${t("vs last")}</span>`;
}

/* ── SVG line chart with status bands ─────────────────────────────── */
function trendSvg(pts, h, pooled){
  // A group's runs tagged by patient get a row of patient numbers under the plot.
  const tagged = pooled && pts.some(p => p.patient);
  const W=640, H=tagged?226:210, padL=46, padR=18, padT=18, padB=tagged?52:36;
  const iw=W-padL-padR, ih=H-padT-padB;
  let vals = pts.map(p=>p.v);
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(h.bands) h.bands.forEach(b=>{ if(isFinite(b.max)){ lo=Math.min(lo,b.max); hi=Math.max(hi,b.max);} });
  if(lo===hi){ const e=Math.abs(lo)*0.15||1; lo-=e; hi+=e; }
  const floor0 = Math.min(...vals) >= 0;   // a CV% or a time never goes below zero
  const p=(hi-lo)*0.12; lo-=p; hi+=p;
  if(floor0) lo = Math.max(lo, 0);
  // Snap the range to a round step so the four tick labels read 0 / 25 / 50…
  // rather than 17.3 / 45.4 / 73.6.
  // Smallest round step that covers the range in at most five gaps.
  const mag = Math.pow(10, Math.floor(Math.log10((hi-lo)/5)));
  const step = [1,2,2.5,5,10,20].map(m=>m*mag)
    .find(s => Math.ceil(hi/s) - Math.floor(lo/s) <= 5);
  lo = Math.floor(lo/step)*step; hi = Math.ceil(hi/step)*step;
  let stepDp = 0;   // as many decimals as the step itself has: 50 → 0, 2.5 → 1
  while(stepDp < 4 && Math.abs(step*10**stepDp - Math.round(step*10**stepDp)) > 1e-9) stepDp++;
  const tickLabel = v => (Math.abs(v) < step/1e6 ? 0 : v).toFixed(stepDp);
  const x = i => padL + (pts.length===1 ? iw/2 : iw*i/(pts.length-1));
  const y = v => padT + ih*(1-(v-lo)/(hi-lo));
  const clampY = v => Math.max(padT, Math.min(padT+ih, y(v)));

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="${t("{metric} across {n} sessions",{metric:t(h.name),n:pts.length})}">`;

  // Status bands (value ranges → clamped rects).
  if(h.bands){
    let prevMax = -Infinity;
    for(const b of h.bands){
      const top = clampY(isFinite(b.max)? b.max : hi);
      const bot = clampY(isFinite(prevMax)? prevMax : lo);
      const fill = ST[b.status].band;
      if(bot-top > 0.5) svg += `<rect x="${padL}" y="${top}" width="${iw}" height="${bot-top}" fill="${fill}"/>`;
      prevMax = b.max;
    }
  }

  // Each patient's runs as a column: a faint stripe behind every other one,
  // the patient number underneath, and a dashed rule where a visit day ends.
  const half = pts.length>1 ? iw/(pts.length-1)/2 : iw/2;
  const sameDay = (a, b) => localDateKey(pts[a].iso) === localDateKey(pts[b].iso);
  const colX = (i, j) => [Math.max(padL, x(i)-half), Math.min(padL+iw, x(j)+half)];
  if(tagged){
    let stripe = 0;
    for(let i=0; i<pts.length;){
      let j = i;
      while(j+1<pts.length && pts[j+1].pkey===pts[i].pkey && sameDay(j+1, i)) j++;
      const p = pts[i].patient, [x0, x1] = colX(i, j);
      if(p){
        if(stripe++ % 2 === 0)
          svg += `<rect x="${x0.toFixed(1)}" y="${padT}" width="${(x1-x0).toFixed(1)}" height="${ih}" fill="#FFFFFF" opacity=".04"/>`;
        if(x1-x0 >= 16)
          svg += `<text x="${((x(i)+x(j))/2).toFixed(1)}" y="${padT+ih+15}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${INK_MUTED}" font-family="'JetBrains Mono',monospace">#${p.number}</text>`;
      }
      if(j+1<pts.length && !sameDay(j, j+1)){
        const xd = ((x(j)+x(j+1))/2).toFixed(1);
        svg += `<line x1="${xd}" y1="${padT}" x2="${xd}" y2="${padT+ih}" stroke="${INK_DIM}" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`;
      }
      i = j+1;
    }
  }

  // Horizontal gridlines + y tick labels, one per step (usually 4).
  const ticks = Math.round((hi-lo)/step);
  for(let i=0;i<=ticks;i++){
    const v = lo + (hi-lo)*i/ticks, yy = y(v);
    svg += `<line x1="${padL}" y1="${yy}" x2="${padL+iw}" y2="${yy}" stroke="${GRID}" stroke-width="1" opacity="${i===0?0:.55}"/>`;
    svg += `<text x="${padL-8}" y="${yy+3.5}" text-anchor="end" font-size="11" fill="${INK_DIM}" font-family="'JetBrains Mono',monospace">${tickLabel(v)}</text>`;
  }

  // Area fill + line. Not for a group: joining strangers' runs draws a trend
  // that belongs to nobody.
  if(pts.length>1 && !pooled){
    const line = pts.map((pt,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(pt.v).toFixed(1)}`).join("");
    const area = `M${x(0).toFixed(1)},${(padT+ih)} `
      + pts.map((pt,i)=>`L${x(i).toFixed(1)},${y(pt.v).toFixed(1)}`).join(" ")
      + ` L${x(pts.length-1).toFixed(1)},${(padT+ih)} Z`;
    svg += `<path d="${area}" fill="${LINE_C}" opacity=".08"/>`;
    svg += `<path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Dots (status-coloured), each a button that opens that session's report.
  // The generous transparent circle underneath is the real hit target - a 4.5px
  // dot is not one. `fill="transparent"`, not "none": "none" takes no pointer.
  // A demo run is drawn hollow: it is the examiner's, not the patient's.
  pts.forEach((pt,i)=>{
    const last = i===pts.length-1, r = last?6:4.5;
    const who = pt.patient ? ` — ${t("Patient #{n} · {dx}", {n:pt.patient.number, dx:diagShort(pt.patient)})}`
      + (pt.demo ? ` · ${t("Demo run")}` : "") : "";
    const title = `${fmtDateTime(pt.iso)}${who} — ${fmtNum(pt.v)}${h.unit} (${t(ST[pt.status].word)})`;
    svg += `<g class="pt" ${pt.id?`data-sid="${pt.id}" tabindex="0" role="button"`:""}`
      + ` aria-label="${t("Open the report for {when}",{when:title})}">`
      + `<title>${title} — ${t("click for the full report")}</title>`
      + `<circle cx="${x(i)}" cy="${y(pt.v)}" r="15" fill="transparent"/>`
      + `<circle class="pt-ring" cx="${x(i)}" cy="${y(pt.v)}" r="${r+4}" fill="${ST[pt.status].dot}"`
      + ` opacity="${last?".22":"0"}"/>`
      + (pt.demo
        ? `<circle cx="${x(i)}" cy="${y(pt.v)}" r="${r}" fill="#0B1020" stroke="${ST[pt.status].dot}" stroke-width="2"/></g>`
        : `<circle cx="${x(i)}" cy="${y(pt.v)}" r="${r}" fill="${ST[pt.status].dot}"`
          + ` stroke="#0B1020" stroke-width="${last?2.5:2}"/></g>`);
  });

  // Direct label on the latest value.
  const lx = x(pts.length-1), lv = y(latestVal(pts));
  const above = lv - 14 > padT+6;
  svg += `<text x="${Math.min(lx, W-padR)}" y="${above? lv-12 : lv+18}" text-anchor="${pts.length===1?"middle":"end"}"
    font-size="12.5" font-weight="700" fill="#E2E8F0" stroke="#0B1020" stroke-width="4"
    stroke-linejoin="round" paint-order="stroke" font-family="'JetBrains Mono',monospace">${fmtNum(latestVal(pts))}${h.unit}</text>`;

  // X-axis end labels. Patient columns put a date under each visit day
  // instead, where there is room for one.
  if(tagged){
    for(let i=0; i<pts.length;){
      let j = i;
      while(j+1<pts.length && sameDay(j+1, i)) j++;
      const [x0, x1] = colX(i, j);
      if(x1-x0 >= 48)
        svg += `<text x="${((x0+x1)/2).toFixed(1)}" y="${H-12}" text-anchor="middle" font-size="11" fill="${INK_MUTED}">${fmtDate(pts[i].iso)}</text>`;
      i = j+1;
    }
  }else{
    svg += `<text x="${padL}" y="${H-12}" text-anchor="start" font-size="11" fill="${INK_MUTED}">${fmtDate(pts[0].iso)}</text>`;
    if(pts.length>1)
      svg += `<text x="${padL+iw}" y="${H-12}" text-anchor="end" font-size="11" fill="${INK_MUTED}">${fmtDate(pts[pts.length-1].iso)}</text>`;
  }

  return svg + `</svg>`;
}
function latestVal(pts){ return pts[pts.length-1].v; }

function localDateKey(iso){
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthKeyFor(iso){ return localDateKey(iso).slice(0,7); }
function fmtTime(iso){
  return new Date(iso).toLocaleTimeString(i18nLocale(),{hour:"numeric",minute:"2-digit"});
}

/* Picking a month or a day redraws that one calendar, not the page. A full
   renderAnalysis() rebuilds all three cards, which throws focus to <body> and
   makes the page jump under the pointer. The section carries its own state
   key, so it can rebuild itself from `analysisSessions` alone. */
function renderCalendar(key){
  const host = document.getElementById("cal-" + key);   // keys contain ":" -
  const ctx = calendarFor(key);                          // getElementById is fine
  if(!host || !ctx) return;
  const active = document.activeElement;
  const keepDay = active && active.classList && active.classList.contains("cal-day");
  host.outerHTML = sessionCalendar(ctx.pts, ctx.h, key);
  if(keepDay){
    const back = document.getElementById("cal-" + key);
    const sel = back && back.querySelector(".cal-day.is-selected");
    if(sel) sel.focus();
  }
}

function setSessionCalendarMonth(key, month){
  if(!month) return;
  sessionCalendarState[key] = {month, day:null};
  renderCalendar(key);
}
function setSessionCalendarDay(key, day){
  const state = sessionCalendarState[key] || {};
  sessionCalendarState[key] = {...state, day};
  renderCalendar(key);
}

/* The report panel's arrows walk every session in the card, so it can land on
   a day - or a month - the calendar is not showing. It calls this to bring the
   calendar to whatever is open; no-op when it is already there, so stepping
   within one day costs nothing. */
window.revealSession = function(id){
  const s = (analysisSessions || []).find(x => x.session_id === id);
  const cfg = s && TREND[s.test];
  if(!cfg) return;
  const key = cfg.modes ? `${s.test}:${s.mode}` : s.test;
  const state = sessionCalendarState[key] || {};
  const month = monthKeyFor(s.timestamp), day = localDateKey(s.timestamp);
  if(state.month===month && state.day===day) return;
  sessionCalendarState[key] = {month, day};
  renderCalendar(key);
};

/* A month calendar of the sessions in this card: the grid is the index, the
   list beside it is the day. Only months that actually hold sessions are
   reachable, because there is no reason to walk through empty ones. */
function sessionCalendar(pts, h, key){
  if(!pts.length) return "";
  const months = [...new Set(pts.map(p=>monthKeyFor(p.iso)))].sort();
  let state = sessionCalendarState[key] || {};
  if(!months.includes(state.month)) state = {month:months[months.length-1], day:null};

  const inMonth = pts.filter(p=>monthKeyFor(p.iso)===state.month);
  const grouped = {};
  inMonth.forEach(p => (grouped[localDateKey(p.iso)] ||= []).push(p));
  const activeDays = Object.keys(grouped).sort();
  if(!activeDays.includes(state.day)) state.day = activeDays[activeDays.length-1];
  sessionCalendarState[key] = state;

  const [year, month] = state.month.split("-").map(Number);
  const first = new Date(year, month-1, 1);
  const offset = (first.getDay()+6)%7;                 // Monday-first
  const nDays = new Date(year, month, 0).getDate();
  const monthAt = months.indexOf(state.month);
  const monthTitle = first.toLocaleDateString(i18nLocale(),{month:"long",year:"numeric"});
  // Jan 1 2024 was a Monday, so this walks Mon..Sun in the page's language.
  const weekdays = Array.from({length:7},(_,i)=>
    new Date(2024,0,1+i).toLocaleDateString(i18nLocale(),{weekday:"narrow"}));
  const todayKey = localDateKey(new Date().toISOString());

  const cells = Array.from({length:offset},()=>`<span class="cal-day cal-blank"></span>`);
  for(let day=1; day<=nDays; day++){
    const dk = `${state.month}-${String(day).padStart(2,"0")}`;
    const runs = grouped[dk] || [];
    const today = dk===todayKey ? " is-today" : "";
    if(!runs.length){
      cells.push(`<span class="cal-day${today}">${day}</span>`);
      continue;
    }
    // One bar under the number, split by how that day's verdicts came out -
    // the mix at a glance without four separate dots competing with the date.
    const mix = ["ok","warn","bad","none"]
      .map(k => [k, runs.filter(p=>p.status===k).length])
      .filter(([,n]) => n)
      .map(([k,n]) => `<i class="vs-${k}" style="flex:${n}"></i>`).join("");
    const when = new Date(year, month-1, day).toLocaleDateString(i18nLocale(),
      {weekday:"long", month:"long", day:"numeric"});
    cells.push(`<button class="cal-day cal-active${dk===state.day?" is-selected":""}${today}"
        data-day="${dk}" onclick="setSessionCalendarDay('${esc(key)}','${dk}')"
        aria-pressed="${dk===state.day}"
        aria-label="${esc(t("{date}: {n} session(s)",{date:when,n:runs.length}))}">
        <span class="cal-num">${day}</span>
        ${runs.length>1?`<span class="cal-count">${runs.length}</span>`:""}
        <span class="cal-bar">${mix}</span></button>`);
  }
  while(cells.length%7) cells.push(`<span class="cal-day cal-blank"></span>`);

  const selected = grouped[state.day] || [];
  const selectedTitle = selected.length
    ? new Date(selected[0].iso).toLocaleDateString(i18nLocale(),
        {weekday:"long", month:"long", day:"numeric"}) : "";
  const rows = selected.map(p=>`<button class="cal-session vs-${p.status}" data-sid="${p.id}"
      title="${esc((p.patient ? t("Patient #{n} · {dx}", {n:p.patient.number, dx:diagName(p.patient)})
        + (p.demo ? ` · ${t("Demo run")}` : "") + " — " : "")
        + (p.label ? t(p.label) : t(ST[p.status].word)))}">
      <span class="cal-time">${fmtTime(p.iso)}${p.patient
        ? `<span class="cal-pt">#${p.patient.number} · ${esc(diagShort(p.patient))}</span>` : ""}</span>
      <span class="cal-value${p.scoreable?"":" cal-unscored"}">${p.scoreable
        ? `${fmtNum(p.v)}<small>${h.unit}</small>` : "—"}${p.demo
        ? `<span class="cal-demo">${t("Demo")}</span>` : ""}</span>
      <span class="cal-verdict"><i></i>${p.scoreable?t(ST[p.status].word)
        :p.partial?t("Partial run"):t("Not scoreable")}</span>
      <span class="cal-go">${I.arrowRight}</span>
    </button>`).join("");

  return `<section class="session-calendar" id="cal-${esc(key)}"
    data-context="${pts.map(p=>p.id).filter(Boolean).join(",")}">
    <div class="cal-head">
      <div class="cal-month">
        <button class="cal-step" ${monthAt>0?"":"disabled"}
          onclick="setSessionCalendarMonth('${esc(key)}','${months[monthAt-1]||""}')"
          aria-label="${t("Previous month with sessions")}">${I.arrowLeft}</button>
        <h4>${monthTitle}</h4>
        <button class="cal-step" ${monthAt<months.length-1?"":"disabled"}
          onclick="setSessionCalendarMonth('${esc(key)}','${months[monthAt+1]||""}')"
          aria-label="${t("Next month with sessions")}">${I.arrowRight}</button>
      </div>
      <span class="cal-tally">${t("{days} active days · {n} sessions",
        {days:activeDays.length, n:inMonth.length})}</span>
    </div>
    <div class="cal-body">
      <div class="cal-grid-wrap">
        <div class="cal-weekdays" aria-hidden="true">${weekdays.map(w=>`<span>${w}</span>`).join("")}</div>
        <div class="cal-grid">${cells.join("")}</div>
      </div>
      <div class="cal-day-panel">
        <div class="cal-day-head"><strong>${selectedTitle}</strong>
          <span>${selected.length===1 ? t("1 session") : t("{n} sessions",{n:selected.length})}</span></div>
        <div class="cal-list">${rows}</div>
      </div>
    </div>
  </section>`;
}
/* One listener for the whole page: charts and calendars are re-rendered on every
   filter change, so per-element handlers would have to be re-bound each time.
   openReport lives in report.js, which loads after this file. */
const analysisBodyEl = document.getElementById("analysis-body");
if(analysisBodyEl){
  const open = el => { if(el && el.dataset.sid) window.openReport?.(el.dataset.sid); };
  analysisBodyEl.addEventListener("click", e => {
    open(e.target.closest("[data-sid]"));
  });
  analysisBodyEl.addEventListener("keydown", e => {
    if(e.key!=="Enter" && e.key!==" ") return;
    // Native <button>s already turn Enter/Space into click. This handler is
    // only for the SVG chart points; handling both caused duplicate opens.
    const el = e.target.closest(".pt[data-sid]");
    if(el){ e.preventDefault(); open(el); }
  });
}

function supportTile(sessions, m){
  const series = sessions
    .map(s => s.metrics ? s.metrics[m.key] : null)
    .filter(v => v!=null && isFinite(v));
  if(!series.length)
    return `<div class="sup-tile"><div class="sup-name">${t(m.name)}</div><div class="sup-val">—</div></div>`;
  const cur = series[series.length-1];
  return `<div class="sup-tile">
    <div class="sup-name">${t(m.name)}</div>
    <div class="sup-row"><span class="sup-val">${fmtNum(cur)}<span class="sup-unit">${m.unit}</span></span>
    ${miniSpark(series)}</div></div>`;
}

function miniSpark(vals){
  if(vals.length<2) return "";
  const W=64, H=22, p=3;
  const lo=Math.min(...vals), hi=Math.max(...vals), rng=(hi-lo)||1;
  const x=i=>p+(W-2*p)*i/(vals.length-1);
  const y=v=>p+(H-2*p)*(1-(v-lo)/rng);
  const d=vals.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg class="sup-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${LINE_C}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(vals.length-1)}" cy="${y(vals[vals.length-1])}" r="2.2" fill="${LINE_C}"/></svg>`;
}

/* ── Readings strip (home) ─────────────────────────────
   The dashboard's readings ledger: one row per test with its latest headline
   metric, its verdict, the Typical cut-off in words, and a spark of
   the sessions behind it — the same TREND config the Analysis page charts, so
   the two can never disagree. Nothing logged yet still says what the row will
   measure, which is what a fresh install sees. */

async function loadVitals(force){
  if(force || !analysisSessions){
    try{
      const r = await fetch("/api/sessions");
      analysisSessions = (await r.json()).sessions || [];
    }catch(e){ analysisSessions = analysisSessions || []; }
  }
  renderVitals();
}

function renderVitals(){
  const el = document.getElementById("vitals");
  if(!el) return;
  const byTest = {};
  TREND_ORDER.forEach(k => byTest[k] = []);
  visibleSessions().forEach(s => { if(byTest[s.test]) byTest[s.test].push(s); });
  el.innerHTML = TREND_ORDER.filter(k => !TREND[k].secondary)
    .map(k => vitalTile(k, byTest[k])).join("");

  // The strip follows the same person as the Analysis page, so it has to say
  // whose readings these are - one patient's numbers must not read as pooled.
  const who = document.getElementById("vitals-who");
  if(who){
    const cur = profileFilter();
    const pr = cur !== "all" && cur !== "none" ? window.profileById?.(cur) : null;
    who.textContent = pr ? t("for {name}", {name: pr.name})
      : cur === "none" ? t("unassigned sessions") : "";
  }
}

function vitalTile(key, sessions){
  const cfg = TREND[key], h = cfg.headline;
  const pts = sessions
    .map(s => ({ v:s.metrics ? s.metrics[h.key] : null, iso:s.timestamp,
                 confidence:s.metrics ? s.metrics.confidence_pct : null,
                 // the verdict the test itself gave, as on the Analysis page
                 // and in the report; bands alone left the spiral "Logged"
                 status:statusOf(s, h) }))
    .filter(p => p.v!=null && isFinite(p.v));
  // The unit is printed beside the value, so the metric name goes without it.
  const name = `<span class="rd-name"><span class="rd-ic">${I[cfg.icon]}</span>
      <span class="rd-id"><span class="rd-test">${t(cfg.label)}</span>
        <span class="rd-metric">${t(h.name)}</span></span></span>`;

  if(!pts.length){
    return `<button class="rd-row rd-idle" onclick="showPage('${cfg.page}')">${name}
      <span class="rd-read"><span class="rd-val rd-dim">—</span></span>
      <span class="rd-verdict"><span class="rd-wait">${t("Not run yet")}</span></span>
      <span class="rd-hint">${t("Run it once to set your baseline")}</span>
      <span class="rd-go">${I.arrowRight}</span>
    </button>`;
  }

  const latest = pts[pts.length-1];
  const st = ST[latest.status];
  const count = pts.length===1 ? t("first reading") : t("{n} sessions",{n:pts.length});
  const ref = typicalRef(h);
  return `<button class="rd-row" onclick="showPage('analysis')">${name}
    <span class="rd-read">
      <span class="rd-val">${fmtNum(latest.v)}${h.unit?`<span class="rd-unit">${h.unit}</span>`:""}</span>
      ${ref ? `<span class="rd-ref">${t("typical {ref}",{ref})}</span>` : ""}</span>
    <span class="rd-verdict">
      <span class="rd-status rd-${latest.status}"><i></i>${t(st.word)}</span>
      ${usualNote(pts)}</span>
    <span class="rd-spark">${vitalSpark(pts, h)}</span>
    <span class="rd-when"><b>${fmtDate(latest.iso)}</b><span>${count}</span></span>
  </button>`;
}

// How far the latest run sits from this person's own usual: the median of up
// to ten runs before it. One run against the previous one is mostly noise, so
// there is no "vs last" here, and no red or green: the status word is the
// verdict. A pooled group has no "usual", and fewer than three earlier runs is
// not one.
function usualNote(pts){
  const prior = pts.slice(0,-1).slice(-10).map(p=>p.v).sort((a,b)=>a-b);
  if(prior.length < 3 || pooledView()) return "";
  const mid = prior.length>>1;
  const usual = prior.length%2 ? prior[mid] : (prior[mid-1]+prior[mid])/2;
  const d = pts[pts.length-1].v - usual;
  return `<span class="rd-usual"><b>${d<0?"−":"+"}${fmtNum(Math.abs(d))}</b> ${t("vs usual")}</span>`;
}

// The Typical cut-off in words, printed under the value: the headline's own
// `typical`, else the edge of its first Typical band.
function typicalRef(h){
  if(h.typical) return h.typical;
  const ok = (h.bands||[]).find(b => b.status==="ok" && isFinite(b.max));
  return ok ? `≤ ${ok.max}${h.unit||""}` : "";
}

// The Typical cut-off as a number, for the row chart's reference line.
function typicalCut(h){
  if(h.typicalAt != null) return h.typicalAt;
  const ok = (h.bands||[]).find(b => b.status==="ok" && isFinite(b.max));
  return ok ? ok.max : null;
}

// Chart for one row: the last few sessions in a framed plot with a value axis
// (rounded ends, plus the Typical cut-off as a dashed line) and the first and
// last dates underneath. The Typical side of the cut-off is tinted green and
// every dot takes its own run's status colour; the line itself stays neutral.
function vitalSpark(all, h){
  const pts = all.slice(-14);
  const W=220, H=66, L=32, R=8, T=6, B=15;
  const x0=L, x1=W-R, y0=T, y1=H-B;
  const cut = typicalCut(h);
  const vals = pts.map(p=>p.v);
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(cut != null){ lo=Math.min(lo,cut); hi=Math.max(hi,cut); }
  if(lo===hi){ const e=Math.abs(lo)*0.2||1; lo-=e; hi+=e; }
  // round the ends outward to a 1/2/5 step so the axis labels are plain numbers
  const span=hi-lo, mag=Math.pow(10, Math.floor(Math.log10(span))), q=span/mag;
  const step = mag/(q<2 ? 5 : q<5 ? 2 : 1);
  const floor0 = lo >= 0;
  lo = Math.floor((lo-span*0.08)/step)*step; hi = Math.ceil((hi+span*0.08)/step)*step;
  if(floor0) lo = Math.max(lo, 0);
  const num = v => String(parseFloat(v.toFixed(2)));
  const x=i=>pts.length===1 ? (x0+x1)/2 : x0+8+(x1-x0-16)*i/(pts.length-1);
  const y=v=>y0+(y1-y0)*(1-(v-lo)/(hi-lo));
  const label=(tx,ty,anchor,s)=>`<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="9.5" fill="${INK_DIM}">${s}</text>`;

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
    + `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="#0E1520"/>`;
  if(cut != null){
    const yc = y(cut), below = h.lowerBetter !== false;   // which side is Typical
    const ta = below ? yc : y0, tb = below ? y1 : yc;
    if(tb-ta > 0.5) svg += `<rect x="${x0}" y="${ta.toFixed(1)}" width="${x1-x0}" height="${(tb-ta).toFixed(1)}" fill="${ST.ok.band}"/>`;
    svg += `<line x1="${x0}" y1="${yc.toFixed(1)}" x2="${x1}" y2="${yc.toFixed(1)}" stroke="${ST.ok.dot}"`
      + ` stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`;
    // the cut-off gets its own axis label when it is clear of both ends
    if(yc-y0 > 11 && y1-yc > 11) svg += label(x0-5, (yc+3).toFixed(1), "end", num(cut));
  }
  svg += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${GRID}"/>`
    + `<line x1="${x0-3}" y1="${y0}" x2="${x0}" y2="${y0}" stroke="${GRID}"/>`
    + `<line x1="${x0-3}" y1="${y1}" x2="${x0}" y2="${y1}" stroke="${GRID}"/>`
    + label(x0-5, y0+6, "end", num(hi)) + label(x0-5, y1, "end", num(lo));
  if(pts.length>1){
    svg += label(x0, H-3, "start", fmtDate(pts[0].iso)) + label(x1, H-3, "end", fmtDate(pts[pts.length-1].iso));
    const line = pts.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    svg += `<path d="${line}" fill="none" stroke="${INK_MUTED}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
  } else {
    svg += label((x0+x1)/2, H-3, "middle", fmtDate(pts[0].iso));
  }
  pts.forEach((p,i)=>{
    const last = i===pts.length-1;
    const opacity = p.confidence != null && p.confidence < 45 ? ".35" : "1";
    svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${last?3.6:2.3}" fill="${ST[p.status].dot}"`
      + ` opacity="${opacity}" stroke="#0E1520" stroke-width="${last?1.5:1}"/>`;
  });
  return svg + `</svg>`;
}

/* ── Disclaimer dock ──────────────────────────────────────────────────
   The bar used to sit across the bottom of every page permanently. It is a
   standing legal note, not a status line, so it now lives just below the
   viewport edge and rises while the pointer is in the strip it occupies.

   The zone is measured from the bar itself rather than hard-coded: a
   transform does not change the layout box, so offsetHeight is the bar's
   real height whether it is up or down, and the trigger is therefore exactly
   where the bar lands. Pointer position is read instead of a CSS :hover on
   an invisible catcher, so nothing transparent is sitting over the bottom of
   the page swallowing clicks.

   Touch has no hover at all, and this must stay reachable: the grabber is a
   real target and a tap pins the bar open. */
(function disclaimerDock(){
  const dock = document.getElementById("disclaimer-dock");
  if(!dock) return;
  const bar = dock.querySelector(".disclaimer-bar");
  const grab = dock.querySelector(".disclaimer-grab");
  let near = false, pinned = false;

  const apply = () => dock.classList.toggle("is-open", near || pinned);

  // The report sheet sits at z-index 300, so a bar rising behind its backdrop
  // would animate for nobody. Treat an open report as "not near".
  const blocked = () => !document.getElementById("report")?.hidden;

  addEventListener("mousemove", e => {
    const zone = bar.offsetHeight || 40;
    const n = !blocked() && (innerHeight - e.clientY) <= zone;
    if(n === near) return;            // only touch the DOM on a real change
    near = n; apply();
  }, {passive:true});

  // Leaving the window leaves no final mousemove, so the bar would stay up.
  document.addEventListener("mouseleave", () => { near = false; apply(); });
  addEventListener("blur", () => { near = false; apply(); });

  grab.addEventListener("click", e => {
    e.preventDefault(); pinned = !pinned; apply();
  });
  // Pinned is the touch path; any click elsewhere puts it back down.
  addEventListener("click", e => {
    if(pinned && !dock.contains(e.target)){ pinned = false; apply(); }
  });
})();

/* ── Finger tapping: mode switcher ────────────────────────────────────
   The two modes share their first two steps, so they are one filmstrip each
   behind a tablist rather than two half-width columns. The choice is a
   per-viewer convenience, so browser storage is enough (and optional). */
const TAP_MODE_KEY = "hand3d.tapMode";
function setTapMode(mode, focus){
  const tabs = document.querySelectorAll("#iiv-seg [role=tab]");
  if(![...tabs].some(b => b.dataset.mode === mode)) return;
  tabs.forEach(b => {
    const on = b.dataset.mode === mode;
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    if(on && focus) b.focus();
  });
  document.querySelectorAll("#page-iiv .filmstrip[data-mode]")
    .forEach(p => { p.hidden = p.dataset.mode !== mode; });
  try{ localStorage.setItem(TAP_MODE_KEY, mode); }catch(e){ /* private window */ }
  renderTapRecording();
}
function tapMode(){
  const on = document.querySelector("#iiv-seg [aria-selected=true]");
  return on ? on.dataset.mode : "fast";
}

/* ── "What we measure": one real run per test page ────────────────────
   Each test page shows a real recording rather than a diagram of one. The
   files are de-identified copies of sessions from results/ (the raw trace and
   the metrics; no profile, name or timestamp), so the page draws the same
   thing on the local hub and on the published site, where there is no results
   folder. The charts are report.js's own, so this is exactly what a session
   report shows. A test with no clean run yet has `file: null` and keeps the
   placeholder frame its markup ships with; see launcher_web/img/<test>/. */
const recNum = (v, d) => v == null || !isFinite(v) ? null : (+v).toFixed(d);
const RECORDINGS = {
  iiv: {
    file: "img/tapping/example-recordings.json",
    pick: all => all[tapMode()],
    body: rec => {
      const c = window.tapCharts(rec);
      return `<div class="rec-block"><h3>${t("Finger distance, every tap marked")}</h3>${c.trace}</div>`
        + `<div class="rec-block"><h3>${t("Gap between taps")}</h3>${c.intervals}</div>`;
    },
    tiles: m => [
      [t("Rhythm") + " · CV", recNum(m.cv_pct, 1), "%", true],
      [t("Speed"), recNum(m.frequency_hz, 2), "Hz"],
      [t("Slowdown"), recNum(m.decrement_pct_per_s, 2), "%/s"],
      [t("Tap size") + " · CV", recNum(m.amplitude_cv_pct, 1), "%"],
      [t("Beat sync") + " · SD", recNum(m.sync_sd_ms, 0), "ms"],
    ],
  },
  spiral: {
    file: "img/spiral/example-recording.json",
    tiles: m => [
      [t("Line accuracy"), recNum(m.accuracy_score, 0), "/100", true],
      [t("Tremor"), recNum(m.tremor_score, 0), "/100"],
      [t("Mean deviation"), recNum(m.mean_dev_pct, 1), "%"],
      [t("Smoothness"), recNum(m.smoothness_index, 0), "/100"],
      [t("Completion"), recNum(m.completion_pct, 0), "%"],
    ],
  },
  oculomotor: {
    file: "img/oculomotor/example-recording.json",
    tiles: m => [
      [t("Wrong-way looks"), recNum(m.error_rate_pct, 1), "%", true],
      ["Anti − Pro", recNum(m.anti_minus_pro_ms, 0), "ms"],
      [t("Self-corrected"), recNum(m.corrected_rate_pct, 1), "%"],
      [t("Valid trials"), recNum(m.valid_trials, 0), ""],
    ],
  },
  ddk: {
    file: null,   // no de-identified example exported yet (results/ has scoreable runs)
    tiles: m => [
      [t("Rhythm") + " · CV", recNum(m.rhythm_cv_pct, 1), "%", true],
      [t("Rate"), recNum(m.syllable_rate_hz, 1), "/s"],
      ["nPVI", recNum(m.npvi, 0), ""],
      [t("Order errors"), recNum(m.sequence_error_pct, 1), "%"],
    ],
  },
  tremor: {
    file: null,   // run live since 2026-09-30; no de-identified example exported yet
    tiles: m => [
      [t("Peak frequency"), recNum(m.tremor_peak_hz, 1), "Hz", true],
      [t("Tremor size"), recNum(m.tremor_amp_pct, 2), "%"],
      [t("Left / right"), recNum(m.asymmetry_ratio, 2), "×"],
    ],
  },
  gait: {
    file: null,   // not run live yet
    tiles: m => [
      [t("Five sit-to-stands"), recNum(m.sts5_s, 1), "s", true],
      [t("Right leg stamps"), recNum(m.leg_right_rate_hz, 1), "/s"],
      [t("Left leg stamps"), recNum(m.leg_left_rate_hz, 1), "/s"],
      [t("Failed rises"), recNum(m.failed_attempts, 0), ""],
    ],
  },
};
const recFiles = {};
function loadRecording(path){
  return recFiles[path] || (recFiles[path] = fetch(path)
    .then(r => r.ok ? r.json() : null).catch(() => null));
}
async function renderRecording(key){
  const cfg = RECORDINGS[key];
  const card = document.querySelector(`.rec-card[data-rec="${key}"]`);
  // No file yet: the markup's placeholder stays. Before report.js has run:
  // the DOMContentLoaded call below draws it.
  if(!cfg || !card || !cfg.file || !window.recordingSections) return;
  const want = key === "iiv" ? tapMode() : "";
  const all = await loadRecording(cfg.file);
  if(key === "iiv" && want !== tapMode()) return;   // the tab changed while loading
  const rec = all && (cfg.pick ? cfg.pick(all) : all);
  const body = card.querySelector(".rec-body");
  const stats = card.querySelector(".rec-stats");
  const chips = card.querySelector(".metric-chips");
  card.classList.remove("is-empty");
  if(!rec){
    body.innerHTML = `<div class="rec-empty">${t("The example recording could not be loaded.")}</div>`;
    stats.innerHTML = chips.innerHTML = "";
    return;
  }
  body.innerHTML = cfg.body ? cfg.body(rec)
    : window.recordingSections(rec, {trial: card.dataset.trial || null});
  const m = rec.metrics || {};
  const k = VERDICT[m.status] || "none", st = ST[k];
  const ico = {ok:I.check, warn:I.info, bad:I.x}[k] || I.info;
  stats.innerHTML = `<span class="rec-verdict" style="color:${st.dot};background:${st.band}">${ico} ${t(st.word)}</span>`;
  chips.innerHTML = cfg.tiles(m).filter(r => r[1] != null).map(([label, v, unit, lead]) =>
    `<div class="metric-chip${lead ? " lead" : ""}"><b>${v}<small>${unit}</small></b><span>${label}</span></div>`).join("");
}
function renderRecordings(){ Object.keys(RECORDINGS).forEach(renderRecording); }
function renderTapRecording(){ renderRecording("iiv"); }

// The eye test's trials open one at a time, as they do in the report.
document.addEventListener("click", e => {
  const chip = e.target.closest(".rec-card [data-trial]");
  if(!chip) return;
  const card = chip.closest(".rec-card");
  const cfg = RECORDINGS[card.dataset.rec];
  const sel = card.dataset.trial === chip.dataset.trial ? "" : chip.dataset.trial;
  card.dataset.trial = sel;
  card.querySelectorAll("[data-trial]").forEach(c => c.classList.toggle("is-open", c.dataset.trial === sel));
  loadRecording(cfg.file).then(rec => {
    const panel = card.querySelector("[data-trial-panel]");
    if(rec && panel) panel.innerHTML = window.trialPanelFor(rec, sel || null);
  });
});

(function initTapMode(){
  const seg = document.getElementById("iiv-seg");
  if(seg){
    seg.addEventListener("keydown", e => {
      const tabs = [...seg.querySelectorAll("[role=tab]")];
      const i = tabs.indexOf(document.activeElement);
      if(i < 0) return;
      const next = {ArrowRight:i+1, ArrowLeft:i-1, Home:0, End:tabs.length-1}[e.key];
      if(next === undefined) return;
      e.preventDefault();
      setTapMode(tabs[(next + tabs.length) % tabs.length].dataset.mode, true);
    });
    let saved = null;
    try{ saved = localStorage.getItem(TAP_MODE_KEY); }catch(e){}
    if(saved) setTapMode(saved);
  }
  // report.js (which owns the charts) loads after this file, so the first
  // draw waits for the page to finish parsing.
  document.addEventListener("DOMContentLoaded", renderRecordings);
})();

/* ── Why This: watch it work ──────────────────────────────────────────
   Hand-only HUBU-FIS clips (tools/make_why_clips.py) with the engine's own
   analysis of each: the smoothed thumb-index distance, the close threshold in
   force, every accepted tap and the final score. Nothing is computed from the
   video here; the chart replays that analysis against video.currentTime, so
   the trace, the tap marks and the counters move with the fingers. The
   running CV% is plain SD/mean of the intervals so far; the verdict at the end
   is the engine's, which also forgives a lone missed tap, so the two can
   differ by a little. Hidden entirely when clips.json is absent. */
const LD = {clips:null, i:0, load:null, bound:false, raf:0, userPaused:false};
const LD_GRADE = ["Normal", "Slight", "Mild", "Moderate", "Severe"];

function renderLiveDemo(){
  const root = document.getElementById("live-demo");
  if(!root) return;
  LD.load = LD.load || fetch("img/validation/clips.json")
    .then(r => r.ok ? r.json() : null).catch(() => null)
    .then(d => { LD.clips = d && Array.isArray(d.clips) && d.clips.length ? d.clips : null; });
  LD.load.then(() => {
    if(!LD.clips) return;
    root.hidden = false;
    document.getElementById("ld-seg").innerHTML = LD.clips.map((c, i) =>
      `<button type="button" role="tab" data-i="${i}" aria-selected="${i === LD.i}" tabindex="${i === LD.i ? 0 : -1}">`
      + `<span>UPDRS ${c.updrs}</span><small>${t(LD_GRADE[c.updrs] || "")}</small></button>`).join("");
    if(!LD.bound) bindLiveDemo();
    ldSelect(LD.i);
  });
}

function bindLiveDemo(){
  LD.bound = true;
  const v = document.getElementById("ld-video");
  const seg = document.getElementById("ld-seg");
  seg.addEventListener("click", e => {
    const b = e.target.closest("[data-i]");
    if(b) ldSelect(+b.dataset.i, true);
  });
  seg.addEventListener("keydown", e => {
    const n = LD.clips.length;
    const next = {ArrowRight:LD.i+1, ArrowLeft:LD.i-1, Home:0, End:n-1}[e.key];
    if(next === undefined) return;
    e.preventDefault();
    ldSelect((next + n) % n, true);
    seg.querySelector(`[data-i="${LD.i}"]`).focus();
  });
  document.getElementById("ld-play").addEventListener("click", () => {
    LD.userPaused = !v.paused;
    v.paused ? v.play().catch(() => {}) : v.pause();
  });
  v.addEventListener("play", ldTick);
  v.addEventListener("pause", ldSync);
  v.addEventListener("seeked", ldDraw);
  v.addEventListener("loadeddata", ldDraw);
  // Plays while on screen (never with reduced motion unless asked), pauses
  // when scrolled away or when the page switches (display:none leaves view).
  new IntersectionObserver(([en]) => {
    if(en.isIntersecting && !LD.userPaused && !reducedMotion) v.play().catch(() => {});
    else if(!en.isIntersecting) v.pause();
  }, {threshold: 0.35}).observe(document.querySelector(".ld-stage"));
  window.addEventListener("resize", ldDraw);
}

function ldSelect(i, user){
  LD.i = i;
  document.querySelectorAll("#ld-seg [role=tab]").forEach(b => {
    const on = +b.dataset.i === i;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
  });
  const v = document.getElementById("ld-video"), c = LD.clips[i];
  if(!v.src.endsWith(c.file)){
    const wasPlaying = !v.paused;
    v.src = c.file;
    if(wasPlaying || (user && !LD.userPaused)) v.play().catch(() => {});
  }
  ldDraw();
}

function ldTick(){
  cancelAnimationFrame(LD.raf);
  const v = document.getElementById("ld-video");
  const loop = () => { ldDraw(); if(!v.paused) LD.raf = requestAnimationFrame(loop); };
  ldSync();
  loop();
}
function ldSync(){
  const v = document.getElementById("ld-video");
  const b = document.getElementById("ld-play");
  b.classList.toggle("is-paused", v.paused);
  b.innerHTML = v.paused ? I.play || "▶" : "";
}

function ldDraw(){
  const c = LD.clips && LD.clips[LD.i];
  const cv = document.getElementById("ld-chart");
  if(!c || !cv || !cv.offsetWidth) return;
  const now = document.getElementById("ld-video").currentTime || 0;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.offsetWidth, H = cv.offsetHeight;
  if(cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim();
  const s = c.series, dur = c.duration_s || (s.length ? s[s.length-1][0] : 1);
  let lo = Infinity, hi = -Infinity;
  s.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
  if(!(hi > lo)){ lo = 0; hi = 1; }
  const pad = {l:8, r:8, t:14, b:22};
  const X = tt => pad.l + tt / dur * (W - pad.l - pad.r);
  const Y = d => pad.t + (1 - (d - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = (pts, upto) => {
    g.beginPath();
    let started = false;
    for(const p of pts){
      if(p[0] > upto) break;
      started ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]));
      started = true;
    }
    g.stroke();
  };
  // Axis: seconds.
  g.fillStyle = col("--text-disabled"); g.font = "11px Inter, sans-serif"; g.textAlign = "center";
  for(let sec = 0; sec <= dur; sec += 2) g.fillText(sec + " s", X(sec), H - 6);
  // The whole trace faint, so the viewer sees where the clip is going.
  g.lineWidth = 1.5; g.strokeStyle = "rgba(184,190,208,.18)"; path(s, Infinity);
  // The close threshold the detector used, up to now.
  g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeStyle = "rgba(245,165,36,.7)";
  path(c.thresholds.map(r => [r[0], r[1]]), now);
  g.setLineDash([]);
  // Taps so far, the newest one flashing.
  const taps = c.taps.filter(x => x <= now);
  taps.forEach(x => {
    const age = now - x, flash = Math.max(0, 1 - age / 0.35);
    g.strokeStyle = `rgba(124,131,253,${0.35 + 0.65*flash})`;
    g.lineWidth = 1 + 2*flash;
    g.beginPath(); g.moveTo(X(x), pad.t); g.lineTo(X(x), H - pad.b); g.stroke();
  });
  // The trace up to now, and the playhead.
  g.lineWidth = 2.25; g.strokeStyle = col("--brand"); path(s, now);
  g.strokeStyle = col("--text"); g.lineWidth = 1;
  g.beginPath(); g.moveTo(X(now), pad.t - 6); g.lineTo(X(now), H - pad.b); g.stroke();

  // Readouts.
  const iv = taps.slice(1).map((x, k) => x - taps[k]);
  const mean = iv.reduce((a, b) => a + b, 0) / (iv.length || 1);
  const sd = iv.length > 1 ? Math.sqrt(iv.reduce((a, b) => a + (b - mean)**2, 0) / (iv.length - 1)) : null;
  document.getElementById("ld-taps").textContent = taps.length;
  document.getElementById("ld-rate").textContent = iv.length ? (1 / mean).toFixed(1) : "–";
  document.getElementById("ld-cv").textContent = iv.length >= 3 && sd != null ? (sd / mean * 100).toFixed(1) + "%" : "–";
  const m = c.metrics || {}, done = now >= dur - 0.25;
  const k = VERDICT[m.status] || "none", st = ST[k];
  const box = document.getElementById("ld-verdict");
  const html = done && m.scoreable !== false
    ? `<span class="rec-verdict" style="color:${st.dot};background:${st.band}">${t(st.word)}</span>`
      + `<span>${t("Final score")} · CV ${recNum(m.cv_pct, 1) ?? "–"}%</span>`
    : `<span class="ld-pending">${t("Scoring as it plays")}</span>`;
  if(box.dataset.html !== html){ box.innerHTML = html; box.dataset.html = html; }
}

/* ── Language switch ──────────────────────────────────────────────────
   Almost everything on these pages is built from JS, so a switch has to ask
   each builder to run again. The "built once" flags are cleared first. */
onLang(lang => {
  cardsBuilt = false; whyBuilt = false;   // the status row keys off getLang()
  // Each section is guarded on its own. As one sequence, a throw in any of
  // them skipped every later one and left the DOM half-rebuilt — losing the
  // Launch buttons that buildCards() owns because a chart failed to draw.
  const step = fn => { try{ fn(); }catch(e){ console.error(e); } };
  step(renderStaticBits);
  step(buildCards);
  step(renderWhy);
  step(refresh);
  step(() => window.renderProfileChips?.(true));
  step(renderVitals);
  step(renderRecordings);
  if(analysisSessions) step(renderAnalysis);
  saveLang(lang);
});

/* The switch also picks the language of the OpenCV overlays. The hub stores it
   so a tool started straight from a terminal follows the same choice; it takes
   effect at launch, so a switch mid-run applies to the next start. */
async function saveLang(lang){
  try{
    await fetch("/api/lang", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({lang})
    });
  }catch(e){ /* hub not reachable: the page still switches, the tools don't */ }
}

/* ── Init ─────────────────────────────────────────────────────────── */
refresh();
loadVitals();
saveLang(getLang());   // onLang only fires on a change; seed the stored value
setInterval(refresh, 3000);
