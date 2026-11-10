"""Bluetooth LE transport for the sensor glove (firmware 0.11.0+).

The glove advertises the Nordic UART Service. This module makes that link look
like the slice of ``serial.Serial`` that ``GloveReader`` uses (``read``,
``write``, ``close``), the same way ``sim.SimSerial`` does. So the reader's
thread, its stall-and-reopen ladder, the parser and the CSV recorder all work
unchanged over the air.

**What the board sends** (glove.ino, "Bluetooth LE"): the same text lines as
USB, except data frames, which are binary records
``0x01, len, seq u32, t_us u32, analog u16 x N, IMU i32 x 6`` (little-endian).
The stream is cut into notifications without regard to record boundaries, so
:class:`BleStreamDecoder` reassembles it and turns each record back into the
``G,...`` line USB would have carried. Everything above this file sees text.

**bleak is optional**, imported lazily like pyserial, so the hub runs on a
machine that has never used Bluetooth. ``has_bleak()`` is re-checked per call
so the Developer page's Install button takes effect without a restart.

Port names for Bluetooth gloves are ``BLE:<address>``; anything else is a COM
port.
"""

from __future__ import annotations

import asyncio
import importlib
import struct
import threading
import time

from .protocol import KIND_ACCEL, KIND_GYRO, parse_banner

BLE_PREFIX = "BLE:"
NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   # host writes commands
NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   # board notifies the stream
#: What glove.ino advertises (BLE_NAME). Matched as well as the service, since
#: Windows does not always pass the 128-bit service UUID through a scan.
GLOVE_NAME = "Hand3D Glove"

REC_MARK = 0x01
SCAN_S = 5.0
CONNECT_TIMEOUT_S = 12.0
WRITE_TIMEOUT_S = 2.0
#: Undecodable bytes allowed to pile up before the decoder drops them and
#: resynchronises on the next newline or record mark.
STREAM_MAX = 8192

_bleak = None


def has_bleak() -> bool:
    """Is bleak importable right now? Re-checked so an install takes effect."""
    global _bleak
    if _bleak is not None:
        return True
    importlib.invalidate_caches()
    try:
        import bleak as _b
    except ImportError:
        return False
    _bleak = _b
    return True


def is_ble_port(port: str | None) -> bool:
    return bool(port) and str(port).startswith(BLE_PREFIX)


def ble_address(port: str) -> str:
    return port[len(BLE_PREFIX):]


# ── stream decoding (pure; tested without a radio) ─────────────────────────


class BleStreamDecoder:
    """Notification bytes in, USB-identical text lines out.

    Needs the banner to know the record layout (how many analog columns, how
    many IMU). Records that arrive before it, or that do not match it, are
    skipped and counted in ``undecoded``; the reader asks for the banner
    first thing, so in practice that is the first few records at most.
    """

    def __init__(self) -> None:
        self._buf = bytearray()
        self._n_analog: int | None = None
        self._n_imu = 0
        self.records = 0
        self.undecoded = 0

    @property
    def has_layout(self) -> bool:
        """Has a banner been seen, so records can be decoded?"""
        return self._n_analog is not None

    def feed(self, data: bytes) -> bytes:
        buf = self._buf
        buf += data
        out = bytearray()
        i = 0
        n = len(buf)
        while i < n:
            if buf[i] == REC_MARK:
                if i + 2 > n:
                    break
                size = buf[i + 1]
                if i + 2 + size > n:
                    break
                line = self._record(bytes(buf[i + 2:i + 2 + size]))
                if line is not None:
                    out += line
                i += 2 + size
                continue
            # A text line. The board queues lines and records whole, so a
            # line is never interrupted by a record: read to its newline.
            j = buf.find(b"\n", i)
            if j < 0:
                break
            line = bytes(buf[i:j + 1])
            if line.startswith(b"#GLOVE"):
                self._learn(line.decode("utf-8", "replace").strip())
            out += line
            i = j + 1
        del buf[:i]
        if len(buf) > STREAM_MAX:
            # Lost sync (should not happen on an acknowledged link): drop to
            # the next plausible boundary rather than grow without end.
            cut = min((k for k in (buf.find(b"\n"), buf.find(bytes([REC_MARK])))
                       if k >= 0), default=-1)
            del buf[:cut + 1 if cut >= 0 else len(buf)]
        return bytes(out)

    def _learn(self, text: str) -> None:
        banner = parse_banner(text)
        if banner is None:
            return
        metas = banner.channel_meta
        self._n_imu = sum(1 for m in metas if m.kind in (KIND_ACCEL, KIND_GYRO))
        self._n_analog = len(metas) - self._n_imu

    def _record(self, rec: bytes) -> bytes | None:
        if self._n_analog is None:
            self.undecoded += 1
            return None
        want = 8 + 2 * self._n_analog + 4 * self._n_imu
        if len(rec) != want:
            self.undecoded += 1
            return None
        fmt = "<II" + "H" * self._n_analog + "i" * self._n_imu
        vals = struct.unpack(fmt, rec)
        self.records += 1
        return ("G," + ",".join(str(v) for v in vals) + "\r\n").encode("ascii")


# ── the radio (bleak on its own event loop) ────────────────────────────────

_loop: asyncio.AbstractEventLoop | None = None
_loop_lock = threading.Lock()


def _event_loop() -> asyncio.AbstractEventLoop:
    """One asyncio loop for every Bluetooth call, on its own daemon thread.

    The hub is threaded, not async; bleak is async. Running each call on a
    shared loop keeps WinRT objects on the thread that made them.
    """
    global _loop
    with _loop_lock:
        if _loop is None:
            loop = asyncio.new_event_loop()
            threading.Thread(target=loop.run_forever, name="glove-ble",
                             daemon=True).start()
            _loop = loop
        return _loop


def _run(coro, timeout: float):
    return asyncio.run_coroutine_threadsafe(coro, _event_loop()).result(timeout)


_scan_lock = threading.Lock()
_found: dict[str, dict] = {}      # address -> port entry, from the last scan
_devices: dict[str, object] = {}  # address -> bleak BLEDevice, for a fast connect
_last_scan: float = 0.0


def scan(timeout: float = SCAN_S) -> tuple[bool, str, list[dict]]:
    """Look for gloves advertising nearby. Blocks for ``timeout`` seconds."""
    global _last_scan
    if not has_bleak():
        return False, "bleak is not installed. Use the Install bleak button.", []
    if not _scan_lock.acquire(blocking=False):
        return False, "A Bluetooth scan is already running.", ports()

    async def go():
        return await _bleak.BleakScanner.discover(timeout=timeout, return_adv=True)

    try:
        try:
            found = _run(go(), timeout + 10)
        except Exception as exc:  # noqa: BLE001 - radio off, no adapter, WinRT errors
            return False, f"Bluetooth scan failed: {exc}. Is Bluetooth on?", []
        hits: dict[str, dict] = {}
        for addr, (dev, adv) in found.items():
            name = adv.local_name or dev.name or ""
            uuids = [u.lower() for u in (adv.service_uuids or [])]
            if NUS_SERVICE not in uuids and name != GLOVE_NAME:
                continue
            _devices[addr] = dev
            hits[addr] = {
                "port": BLE_PREFIX + addr,
                "description": f"{name or 'Glove'} · Bluetooth · {adv.rssi} dBm",
                "hwid": addr,
                "is_glove": True,
                "transport": "ble",
                "rssi": adv.rssi,
            }
        _found.clear()
        _found.update(hits)
        _last_scan = time.time()
    finally:
        _scan_lock.release()
    if not hits:
        return True, ("No Bluetooth glove found. Is it switched on and not "
                      "connected to another computer?"), []
    return True, f"Found {len(hits)} Bluetooth glove{'s' if len(hits) > 1 else ''}.", ports()


def ports() -> list[dict]:
    """Gloves seen by the last scan, strongest signal first."""
    return sorted(_found.values(), key=lambda p: -(p.get("rssi") or -999))


class BleSerial:
    """A connected glove, read and written like a serial port.

    ``read`` waits up to ``timeout`` for decoded bytes and returns what it has
    (possibly ``b""``, which the reader treats as silence). Once the link has
    dropped and the buffer is drained it raises ``OSError``, which sends the
    reader down its lost-and-reconnect path exactly as an unplugged cable does.
    """

    def __init__(self, port: str, timeout: float = 0.2,
                 connect_timeout: float = CONNECT_TIMEOUT_S):
        if not has_bleak():
            raise OSError("bleak is not installed")
        self.port = port
        self.timeout = timeout
        self._addr = ble_address(port)
        self._cv = threading.Condition()
        self._rx = bytearray()
        self._dec = BleStreamDecoder()
        self._lost = False
        self._closed = False
        self._asked = 0.0
        target = _devices.get(self._addr, self._addr)
        self._client = _bleak.BleakClient(target, disconnected_callback=self._on_drop,
                                          timeout=connect_timeout)
        try:
            _run(self._open(), connect_timeout + 5)
        except Exception as exc:  # noqa: BLE001
            self.close()
            raise OSError(f"Bluetooth connect failed: {exc or type(exc).__name__}") from exc

    async def _open(self):
        await self._client.connect()
        await self._client.start_notify(NUS_TX, self._on_note)

    def _on_note(self, _char, data: bytearray) -> None:
        text = self._dec.feed(bytes(data))
        # Records with no banner to read them by: the request for it was lost
        # (fw 0.11.0's first build dropped back-to-back commands). Ask again,
        # at most once a second. Runs on the event loop, so a task, not _run.
        if self._dec.undecoded and not self._dec.has_layout:
            now = time.monotonic()
            if now - self._asked > 1.0:
                self._asked = now
                asyncio.ensure_future(self._client.write_gatt_char(NUS_RX, b"?",
                                                                   response=False))
        if text:
            with self._cv:
                self._rx += text
                self._cv.notify_all()

    def _on_drop(self, _client) -> None:
        with self._cv:
            self._lost = True
            self._cv.notify_all()

    @property
    def mtu(self) -> int | None:
        try:
            return int(self._client.mtu_size)
        except Exception:  # noqa: BLE001
            return None

    def read(self, size: int = 1) -> bytes:
        deadline = time.monotonic() + (self.timeout or 0)
        with self._cv:
            while not self._rx and not self._lost and not self._closed:
                left = deadline - time.monotonic()
                if left <= 0:
                    return b""
                self._cv.wait(left)
            if not self._rx:
                raise OSError("Bluetooth link lost")
            out = bytes(self._rx[:size])
            del self._rx[:size]
            return out

    def write(self, data: bytes) -> int:
        if self._lost or self._closed:
            raise OSError("Bluetooth link lost")
        try:
            _run(self._client.write_gatt_char(NUS_RX, bytes(data), response=False),
                 WRITE_TIMEOUT_S)
        except TimeoutError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise OSError(f"Bluetooth write failed: {exc}") from exc
        return len(data)

    def close(self) -> None:
        with self._cv:
            if self._closed:
                return
            self._closed = True
            self._cv.notify_all()
        try:
            _run(self._client.disconnect(), 5)
        except Exception:  # noqa: BLE001 - already gone
            pass
