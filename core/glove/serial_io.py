"""Serial transport for the sensor glove — the I/O half of ``core.glove``.

Owns the COM port in a background thread, parses lines through the pure
``protocol`` module, and keeps a bounded ring buffer the web UI can poll.

pyserial is an **optional** dependency: ``launcher.py`` must keep running (and
stay PyInstaller-packageable) on a machine that has never touched the glove, so
the import is guarded and ``HAS_PYSERIAL`` is the flag callers check first.
"""

from __future__ import annotations

import csv
import importlib
import os
import re
import threading
import time
from collections import deque
from datetime import datetime

from .flex import bend_percent, bend_range, default_span, flex_model
from .force import (conductance_us, force_model, force_newtons, force_range,
                    grams_force)
from .imu import (MIN_WINDOW_S, TREMOR_BAND, band_power, held_fraction,
                  magnitude, rms, tilt, to_units)
from .protocol import (KIND_ACCEL, KIND_FLEX, KIND_FLEXIFORCE, KIND_FSR, KIND_GYRO,
                       PROTO_SUPPORTED, ChannelMeta, FrameAccumulator,
                       GloveFrame, adc_to_mv, kind_from_name, sensor_ohms)
from .ble_io import BleSerial, has_bleak, is_ble_port
from .ble_io import ports as ble_ports
from .sim import SIM_PORT, SimSerial

serial = None       # type: ignore[assignment]
_list_ports = None  # type: ignore[assignment]
HAS_PYSERIAL = False


def has_pyserial() -> bool:
    """Is pyserial importable *right now*?

    Deliberately re-checked on each call rather than frozen at import time: the
    Developer page can install pyserial into the running interpreter, and a
    cached False would keep reporting "missing" until the hub was restarted.
    """
    global serial, _list_ports, HAS_PYSERIAL
    if HAS_PYSERIAL:
        return True
    importlib.invalidate_caches()   # pick up a package installed since startup
    try:
        import serial as _serial
        from serial.tools import list_ports as _lp
    except ImportError:
        return False
    serial, _list_ports, HAS_PYSERIAL = _serial, _lp, True
    return True


has_pyserial()   # opportunistic first attempt, so the common case is resolved

BAUD = 115200          # ignored by native USB CDC, but harmless and correct for AVR
FRAME_BUFFER = 6000    # 60 s at 100 Hz
CONSOLE_LINES = 200    # raw lines kept for the on-page serial console
COMMANDS = ("?", "S", "X", "Z", "D")

# ── link health ───────────────────────────────────────────────────────────
#
# Why this exists (2026-11-09): on 2026-11-08 the glove "froze" repeatedly, and
# the page could not say how. A dead reader thread, a board blocked writing to
# a port nobody read, a board that had reset, and a board that had hung all
# looked the same: traces stopped, everything else stayed green. Up to then a
# failed read ended the reader thread but left the port open and the status
# "connected", which also kept the board blocked (firmware before 0.10.3 waits
# forever on a host that holds the port without reading). The reader now
# watches for that, recovers what it can, and names what it cannot.
#
#   ok            bytes arriving
#   stalled       nothing for STALL_S while streaming: the port was closed and
#                 reopened (dropping DTR releases a blocked write on the
#                 board), waiting to hear from it again
#   unresponsive  reopened and still silent: the board itself has stopped -
#                 press its reset button or replug it
#   lost          the port failed under us (USB dropped, board reset): retrying
#                 the same port every RETRY_S for RECONNECT_S, then giving up
#   idle          not connected
LINK_IDLE, LINK_OK, LINK_STALLED, LINK_UNRESPONSIVE, LINK_LOST = (
    "idle", "ok", "stalled", "unresponsive", "lost")

READ_TIMEOUT_S = 0.2     # one read() wait; also how often the stall check runs
WRITE_TIMEOUT_S = 0.5    # a board that stops taking commands must not hang the hub
SETTLE_S = 0.8           # native USB settles after open before '?' is heard
STALL_S = 2.0            # 200 frames of silence. A 100 Hz board is never this quiet.
REOPEN_GAP_S = 0.3       # DTR held low long enough for the board to see it drop
RETRY_S = 1.0            # between reopen attempts after the port is lost
RECONNECT_S = 10.0       # a reset board is back on its COM port in a few seconds
RECONNECT_BLE_S = 30.0   # a Bluetooth glove that walked out of range, or rebooted
UNRESPONSIVE_RETRY_S = 10.0   # keep trying, slowly, while the board is silent
RATE_STALE_S = 1.0       # a rate with no frame behind it this long is reported as 0
LINE_MAX = 65536         # a newline-free run this long is noise, not a line

#: One line per connect, banner, stall, loss, recovery and disconnect, in
#: results/glove/. Text only: no samples, which stay in the CSV recordings.
EVENT_LOG = "events.log"
EVENT_LOG_MAX = 1_000_000   # bytes; rolled once to events.1.log

_I2C_FAIL = re.compile(r"\bi2c_fail=(\d+)")


def _close_quietly(ser) -> None:
    if ser is None:
        return
    try:
        ser.close()
    except Exception:  # noqa: BLE001 - closing a port that is already gone
        pass


def _is_write_timeout(exc: BaseException) -> bool:
    # pyserial's SerialTimeoutException, matched by name so this module still
    # imports (and the simulator still runs) without pyserial.
    return isinstance(exc, TimeoutError) or type(exc).__name__ == "SerialTimeoutException"

#: USB vendor ID of Arduino SA — how the Nano 33 BLE identifies itself.
ARDUINO_VID = 0x2341


def list_ports() -> list[dict]:
    """Enumerate serial ports, flagging the ones that look like the glove,
    followed by any Bluetooth gloves the last scan found (``BLE:<address>``).

    The serial half is empty when pyserial is missing — callers must check
    :func:`has_pyserial` first, because "no ports" and "cannot look" are
    different answers and must not be shown to the user as the same thing.
    Bluetooth entries come from ``ble_io.scan()``, never from here: a scan
    takes seconds and this is polled.
    """
    out: list[dict] = []
    if has_pyserial():
        for p in _list_ports.comports():
            out.append({
                "port": p.device,
                "description": p.description or "",
                "hwid": p.hwid or "",
                "is_glove": p.vid == ARDUINO_VID,
                "transport": "usb",
            })
        # Likely boards first, then natural port order.
        out.sort(key=lambda d: (not d["is_glove"], d["port"]))
    # A cable, when there is one, ahead of the radio: default_port() takes
    # the first glove, and USB is the steadier link.
    usb_gloves = [d for d in out if d["is_glove"]]
    return usb_gloves + ble_ports() + [d for d in out if not d["is_glove"]]


def default_port() -> str | None:
    """Best guess at the glove's port, or None if nothing looks like it."""
    for p in list_ports():
        if p["is_glove"]:
            return p["port"]
    return None


class GloveReader:
    """Background serial reader with a polled ring buffer.

    Thread-safety: every mutable field is touched only under ``_lock``. The
    reader thread appends; HTTP handler threads read snapshots. ``_event``
    takes the lock itself, so it is never called while holding it.

    The reader thread also owns recovery (see the link-health notes at the
    top of this module): it is the only thread that reopens the port, and it
    does so with ``_ser`` set to None so no other thread writes to a port in
    the middle of being replaced.
    """

    #: Seconds to let native USB settle after an open. Class-level so a test
    #: with a fake port can set it to zero.
    SETTLE_S = SETTLE_S

    def __init__(self, results_dir: str):
        self._lock = threading.Lock()
        self._write_lock = threading.Lock()   # pyserial writes are not re-entrant
        self._log_lock = threading.Lock()
        self._thread: threading.Thread | None = None
        # One Event per connection, handed to its own reader thread, so a
        # reader that outlives a slow disconnect can never be revived by the
        # next connect clearing a shared flag.
        self._stop = threading.Event()
        self._ser = None

        self._frames: deque[tuple[GloveFrame, float]] = deque(maxlen=FRAME_BUFFER)
        self._console: deque[str] = deque(maxlen=CONSOLE_LINES)
        self._acc = FrameAccumulator()

        self.port: str | None = None
        self.last_error: str = ""
        self._connected_at: float = 0.0

        # Link health. `_active` is "the user asked for a connection and has
        # not ended it": it stays True while the reader is reopening the port,
        # so Disconnect still works then.
        self._active = False
        self._is_sim = False
        self._link = LINK_IDLE
        self._last_rx = 0.0            # monotonic, last byte of any kind
        self._last_frame_at = 0.0      # monotonic, last data frame
        self._down_since: float | None = None
        self._streaming = False
        self._stalls = 0
        self._reconnects = 0
        self._next_retry = 0.0
        self._i2c_fail: int | None = None

        self._results_dir = results_dir
        self._csv_file = None
        self._csv_writer = None
        self._csv_path: str | None = None
        self._csv_rows = 0

    # ── lifecycle ─────────────────────────────────────────────────────────

    def _open_port(self, port: str):
        """Open a COM port (or a Bluetooth glove) the way the board needs it.
        Replaced by tests."""
        if is_ble_port(port):
            return BleSerial(port, timeout=READ_TIMEOUT_S)
        ser = serial.Serial(port, BAUD, timeout=READ_TIMEOUT_S,
                            write_timeout=WRITE_TIMEOUT_S)
        # The firmware treats DTR as "a terminal is attached": without it every
        # frame is dropped on the board.
        try:
            ser.dtr = True
        except OSError:
            pass
        return ser

    def _begin(self, ser, port: str, sim: bool) -> threading.Event:
        """Reset per-connection state. Caller holds ``_lock``."""
        stop = threading.Event()
        self._stop = stop
        self._ser = ser
        self.port = port
        self.last_error = ""
        self._frames.clear()
        self._console.clear()
        self._acc = FrameAccumulator()
        self._connected_at = time.time()
        self._active = True
        self._is_sim = sim
        self._link = LINK_OK
        self._last_rx = time.monotonic()
        self._last_frame_at = 0.0
        self._down_since = None
        self._streaming = True        # the board boots streaming; connect sends S
        self._stalls = 0
        self._reconnects = 0
        self._i2c_fail = None
        return stop

    def connect(self, port: str) -> tuple[bool, str]:
        if self.is_connected():
            return False, f"Already connected to {self.port}."
        if port == SIM_PORT:
            return self._connect_sim()
        if not port:
            return False, "No port selected."
        ble = is_ble_port(port)
        if ble and not has_bleak():
            return False, "bleak is not installed. Use the Install bleak button."
        if not ble and not has_pyserial():
            return False, "pyserial is not installed. Use the Install pyserial button."

        try:
            ser = self._open_port(port)
        except Exception as exc:  # noqa: BLE001 - pyserial raises several types
            # Windows allows exactly one owner per COM port, and this is by far
            # the most common failure, so name the likely culprit rather than
            # surfacing a bare OS error.
            hint = ""
            if ble:
                return False, (f"Could not connect to the Bluetooth glove: {exc}. Check it "
                               "is on, in range and not connected to another computer, "
                               "then Scan again.")
            if "denied" in str(exc).lower() or "PermissionError" in type(exc).__name__:
                hint = (" — the port is held by something else. Close the Arduino "
                        "Serial Monitor or press_test.ps1 and try again.")
            return False, f"Could not open {port}: {exc}{hint}"

        with self._lock:
            stop = self._begin(ser, port, sim=False)
        self._thread = threading.Thread(target=self._run, args=(stop,),
                                        name="glove-reader", daemon=True)
        self._thread.start()
        self._event("connect", port=port)

        # Let the native-USB port settle, then ask for the banner and stream.
        # A Bluetooth link is already up and subscribed when the open returns.
        if not ble:
            time.sleep(self.SETTLE_S)
        self.send_command("?")
        self.send_command("S")
        return True, (f"Connected over Bluetooth ({port[4:]})." if ble
                      else f"Connected to {port}.")

    def _connect_sim(self) -> tuple[bool, str]:
        """Open the simulated glove (core/glove/sim.py) in place of a port.

        Needs no pyserial and no settle time. From here on it is read by the
        same thread and parsed by the same accumulator as the board.
        """
        with self._lock:
            stop = self._begin(SimSerial(), SIM_PORT, sim=True)
        self._thread = threading.Thread(target=self._run, args=(stop,),
                                        name="glove-sim", daemon=True)
        self._thread.start()
        self.send_command("?")
        return True, "Started the simulated glove."

    def is_simulated(self) -> bool:
        with self._lock:
            return isinstance(self._ser, SimSerial)

    def sim_input(self, data: dict) -> tuple[bool, str]:
        """Held controls and tremor settings from the Developer page.

        Unknown control names are dropped and the tremor numbers clamped inside
        the simulator, so a malformed body changes nothing it should not.
        """
        with self._lock:
            ser = self._ser
        if not isinstance(ser, SimSerial):
            return False, "The simulated glove is not running."
        held = data.get("held")
        if not isinstance(held, list):
            held = []
        tremor = data.get("tremor")
        ser.set_input(held, bool(data.get("hard")),
                      tremor if isinstance(tremor, dict) else None)
        return True, "Simulator updated."

    def disconnect(self) -> tuple[bool, str]:
        if not self.is_connected():
            return False, "Not connected."
        with self._lock:
            simulated = self._is_sim
            stop = self._stop
        stop.set()
        thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=1.5)
        with self._lock:
            ser, self._ser = self._ser, None
            was = self.port
            self.port = None
            self._active = False
            self._link = LINK_IDLE
            frames, dropped = self._acc.total, self._acc.dropped
        _close_quietly(ser)
        self.stop_recording()
        if simulated:
            return True, "Stopped the simulated glove."
        self._event("disconnect", port=was, frames=frames, dropped=dropped)
        return True, f"Disconnected from {was}."

    def is_connected(self) -> bool:
        with self._lock:
            return self._active

    # ── reader thread ─────────────────────────────────────────────────────

    def _run(self, stop: threading.Event) -> None:
        buf = b""
        while not stop.is_set():
            with self._lock:
                ser = self._ser
            if ser is None:
                break
            try:
                chunk = ser.read(4096) or b""
            except Exception as exc:  # noqa: BLE001 - unplugged mid-read, board reset
                if stop.is_set():
                    break
                buf = b""
                if not self._recover_lost(stop, f"Read failed: {exc}"):
                    break
                continue

            now = time.monotonic()
            if not chunk:
                if self._watch(stop, now):
                    buf = b""           # a reopened port starts on a fresh line
                continue

            self._heard(now)
            buf += chunk
            *lines, buf = buf.split(b"\n")
            if len(buf) > LINE_MAX:
                buf = b""
            for raw in lines:
                text = raw.decode("utf-8", "replace").strip()
                if not text:
                    continue
                self._ingest(text)

    def _heard(self, now: float) -> None:
        """Bytes arrived. Closes out any stall or loss that was open."""
        with self._lock:
            self._last_rx = now
            if self._link == LINK_OK:
                return
            was = self._link
            down = now - self._down_since if self._down_since is not None else 0.0
            self._link = LINK_OK
            self._down_since = None
            self.last_error = ""
        self._event("recovered", after=was, down_s=f"{down:.1f}")

    def _watch(self, stop: threading.Event, now: float) -> bool:
        """Nothing arrived this read. Advance the stall ladder.

        Returns True when the port was reopened, so the caller drops any
        half-line it was holding.
        """
        with self._lock:
            if self._is_sim or not self._streaming:
                return False
            link, age = self._link, now - self._last_rx
            if link == LINK_OK and age > STALL_S:
                self._link = LINK_STALLED
                self._stalls += 1
                self._down_since = self._last_rx
                action = "stall"
            elif link in (LINK_STALLED, LINK_LOST) and age > STALL_S:
                # Reopened (after a stall, or after the port came back) and
                # still silent: the board itself has stopped.
                self._link = LINK_UNRESPONSIVE
                self._next_retry = now + UNRESPONSIVE_RETRY_S
                self.last_error = ("The board has sent nothing since the port was "
                                   "reopened. Press its reset button or replug it.")
                action = "unresponsive"
            elif link == LINK_UNRESPONSIVE and now >= self._next_retry:
                self._next_retry = now + UNRESPONSIVE_RETRY_S
                action = "retry"
            else:
                return False
        if action == "stall":
            self._event("stall", silent_s=f"{age:.1f}")
            return self._reopen(stop, LINK_STALLED)
        if action == "unresponsive":
            self._event("unresponsive", silent_s=f"{age:.1f}")
            return False
        # A quiet retry: stays "unresponsive", so it is not logged again.
        return self._reopen(stop, LINK_UNRESPONSIVE)

    def _reopen(self, stop: threading.Event, link_after: str) -> bool:
        """Close and reopen the same port, then ask for the banner again.

        Closing drops DTR, which on the board aborts a write blocked on us and
        (fw 0.10.3+) empties its transmit queue. A port that will not reopen
        has gone away, which is the lost path.
        """
        with self._lock:
            old, port = self._ser, self.port
            self._ser = None
        _close_quietly(old)
        if stop.wait(REOPEN_GAP_S):
            return False
        try:
            ser = self._open_port(port)
        except Exception as exc:  # noqa: BLE001
            return self._recover_lost(stop, f"Reopen failed: {exc}")
        if not self._install(stop, ser, link_after):
            return False
        self._hello(stop, ser)
        return True

    def _recover_lost(self, stop: threading.Event, why: str) -> bool:
        """The port failed under the reader. Retry it, then give up cleanly.

        Returns True with a fresh port installed, or False once the
        connection has been ended (by giving up, or by Disconnect).
        """
        with self._lock:
            old, port = self._ser, self.port
            self._ser = None
            self._link = LINK_LOST
            self.last_error = why
            if self._down_since is None:
                self._down_since = self._last_rx
        _close_quietly(old)
        self._event("lost", reason=why)

        window = RECONNECT_BLE_S if is_ble_port(port) else RECONNECT_S
        deadline = time.monotonic() + window
        while not stop.wait(RETRY_S):
            try:
                ser = self._open_port(port)
            except Exception:  # noqa: BLE001 - not back yet
                if time.monotonic() >= deadline:
                    break
                continue
            if not self._install(stop, ser, LINK_LOST):
                return False
            with self._lock:
                self._reconnects += 1
            self._event("reopened")
            self._hello(stop, ser)
            return True
        if stop.is_set():
            return False

        # Gave up: end the connection properly, so the page offers Connect
        # again and says why, instead of showing a stale "connected".
        with self._lock:
            self._active = False
            self._link = LINK_IDLE
            self.port = None
            check = ("that the glove is on and in range" if is_ble_port(port)
                     else "the cable")
            self.last_error = (f"Lost {port} ({why}) and it did not come back within "
                               f"{window:.0f} s. Check {check}, then Connect again.")
            frames, dropped = self._acc.total, self._acc.dropped
        self.stop_recording()
        self._event("gave_up", port=port, frames=frames, dropped=dropped)
        return False

    def _install(self, stop: threading.Event, ser, link_after: str) -> bool:
        """Make a freshly opened port the live one, unless Disconnect came first.

        The link stays not-ok until the board speaks; one that never does
        goes on to "unresponsive" through the same stall ladder.
        """
        with self._lock:
            if stop.is_set():
                _close_quietly(ser)
                return False
            self._ser = ser
            self._link = link_after
            self._last_rx = time.monotonic()
            self._streaming = True
        return True

    def _hello(self, stop: threading.Event, ser) -> None:
        """After a reopen: let USB settle, then banner and stream."""
        if stop.wait(self.SETTLE_S):
            return
        for cmd in ("?", "S"):
            try:
                with self._write_lock:
                    ser.write((cmd + "\n").encode("ascii"))
            except Exception:  # noqa: BLE001 - the stall ladder will notice
                return

    def _ingest(self, text: str) -> None:
        now = time.time()
        note = None
        with self._lock:
            frame = self._acc.feed(text)
            if frame is None:
                # Banners, #DIAG, #ZERO and anything unrecognised: console only.
                self._console.append(text)
                if text.startswith("#GLOVE") and self._acc.banner is not None:
                    b = self._acc.banner
                    note = ("banner", {"fw": b.fw, "rst": b.rst or None, "imu": b.imu})
                elif text.startswith("#DIAG imu"):
                    m = _I2C_FAIL.search(text)
                    if m:
                        self._i2c_fail = int(m.group(1))
                elif text.startswith("!"):
                    note = ("board_says", {"text": text})
            else:
                self._frames.append((frame, now))
                self._last_frame_at = time.monotonic()
                if self._csv_writer is not None:
                    try:
                        self._csv_writer.writerow(
                            [f"{now:.6f}", frame.seq, frame.t_us, *frame.values])
                        self._csv_rows += 1
                    except (OSError, ValueError):
                        pass
        if note is not None:
            self._event(note[0], **note[1])

    # ── event log ─────────────────────────────────────────────────────────

    def _event(self, kind: str, **fields) -> None:
        """Append one line to results/glove/events.log. Never raises.

        Never call this while holding ``_lock``: it reads the counters under
        it. The simulator is not logged - the file is about the hardware.
        """
        with self._lock:
            if self._is_sim:
                return
            fields.setdefault("port", self.port)
            fields.setdefault("frames", self._acc.total)
            fields.setdefault("dropped", self._acc.dropped)
            if self._i2c_fail is not None:
                fields.setdefault("i2c_fail", self._i2c_fail)
        parts = [datetime.now().isoformat(timespec="milliseconds"), kind]
        for key, value in fields.items():
            if value is None:
                continue
            text = str(value)
            if not text or any(c.isspace() for c in text) or '"' in text:
                text = '"' + text.replace('"', "'") + '"'
            parts.append(f"{key}={text}")
        line = " ".join(parts) + "\n"
        path = os.path.join(self._results_dir, "glove", EVENT_LOG)
        with self._log_lock:
            try:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                if os.path.exists(path) and os.path.getsize(path) > EVENT_LOG_MAX:
                    os.replace(path, path[:-len(".log")] + ".1.log")
                with open(path, "a", encoding="utf-8") as fh:
                    fh.write(line)
            except OSError:
                pass

    # ── commands ──────────────────────────────────────────────────────────

    def send_command(self, cmd: str) -> tuple[bool, str]:
        cmd = (cmd or "").strip().upper()
        if cmd not in COMMANDS:
            return False, f"Unknown command: {cmd!r}"
        with self._lock:
            ser, active = self._ser, self._active
        if ser is None:
            return False, ("The glove connection is recovering. Try again in a moment."
                           if active else "Not connected.")
        # Written outside _lock: a board that has stopped taking input must
        # cost this one call its write timeout, not freeze every status poll.
        try:
            with self._write_lock:
                ser.write((cmd + "\n").encode("ascii"))
        except Exception as exc:  # noqa: BLE001
            if _is_write_timeout(exc):
                self._event("write_timeout", cmd=cmd)
                return False, "The board did not take the command. It may have stopped responding."
            return False, f"Write failed: {exc}"
        with self._lock:
            if cmd == "S":
                self._streaming = True
            elif cmd == "X":
                self._streaming = False     # silence is expected now, not a stall
            elif cmd == "Z":
                # The board restarts its counters, so ours must follow or every
                # subsequent frame looks like a huge backwards jump.
                self._acc.reset_counters()
                self._frames.clear()
        return True, f"Sent {cmd}."

    # ── polling API ───────────────────────────────────────────────────────

    def snapshot(self, since_seq: int = -1, limit: int = 2000) -> dict:
        """Frames newer than ``since_seq``, plus stream health and console."""
        with self._lock:
            frames = [f for f, _ts in self._frames if f.seq > since_seq]
            if len(frames) > limit:
                frames = frames[-limit:]
            banner = self._acc.banner
            payload = {
                "frames": [[f.seq, f.t_us, *f.values] for f in frames],
                "cols": list(banner.cols) if banner else [],
                "channels": list(banner.channels) if banner else [],
                "rate_hz": round(self._live_rate(), 3),
                "dropped": self._acc.dropped,
                "total": self._acc.total,
                "console": list(self._console),
                "connected": self._active,
                # Polled every 100 ms, so the page hears about a stall at once
                # rather than on its next 4 s status poll.
                "link": self._link,
            }
            self._console.clear()   # console lines are delivered once
        return payload

    def _live_rate(self) -> float:
        """The device rate, or 0 once no frame has arrived for RATE_STALE_S.

        The accumulator's rate is worked out from the last 200 frames however
        old they are, so on its own it stayed at a healthy ~100 Hz after the
        stream stopped. Caller holds ``_lock``.
        """
        if not self._last_frame_at or time.monotonic() - self._last_frame_at > RATE_STALE_S:
            return 0.0
        return self._acc.rate_hz

    def stats(self) -> dict:
        with self._lock:
            banner = self._acc.banner
            uptime = time.time() - self._connected_at if self._active else 0.0
            sim = self._ser if isinstance(self._ser, SimSerial) else None
            rx_age = time.monotonic() - self._last_rx if self._active else None
            return {
                "pyserial": has_pyserial(),
                "bleak": has_bleak(),
                "connected": self._active,
                "port": self.port,
                # usb | ble | sim, so the page can label the link.
                "transport": (None if not self._active else "sim" if self._is_sim
                              else "ble" if is_ble_port(self.port) else "usb"),
                "ble_mtu": (self._ser.mtu if isinstance(self._ser, BleSerial)
                            else None),
                # Link health (see the notes at the top of this module).
                "link": self._link,
                "rx_age_s": round(rx_age, 1) if rx_age is not None else None,
                "stalls": self._stalls,
                "reconnects": self._reconnects,
                "i2c_fail": self._i2c_fail,
                # The simulated glove (core/glove/sim.py): the page shows its
                # key panel, and the held keys and tremor settings come back
                # here so the panel survives a reload.
                "simulated": sim is not None,
                "sim": sim.sim.state() if sim is not None else None,
                "rate_hz": round(self._live_rate(), 3),
                "dropped": self._acc.dropped,
                "total": self._acc.total,
                "uptime_s": round(uptime, 1),
                "last_error": self.last_error,
                "recording": self._csv_path is not None,
                "record_path": os.path.basename(self._csv_path) if self._csv_path else None,
                "record_rows": self._csv_rows,
                "proto_supported": PROTO_SUPPORTED,
                # Shipped to the frontend so the force curve is written down in
                # exactly one place (core/glove/force.py) and dev.js merely
                # interpolates the points it is given.
                "force_model": force_model(),
                # Same contract for bend: the span lives on the server so the
                # page never carries its own copy of a calibration.
                "flex_model": flex_model(default_span()),
                # And for motion: the tremor band is defined in core/glove/imu.py
                # (matching core/spiral/metrics.py), never in the frontend.
                "imu_model": {"tremor_band": list(TREMOR_BAND),
                              "min_window_s": MIN_WINDOW_S},
                "banner": {
                    "fw": banner.fw,
                    "proto": banner.proto,
                    "board": banner.board,
                    "rate": banner.rate,
                    "adc_bits": banner.adc_bits,
                    "adc_ref_mv": banner.adc_ref_mv,
                    "vdiv_mv": banner.vdiv_mv,
                    "r_fixed": banner.r_fixed,
                    "imu": banner.imu,
                    "imu_scale": banner.imu_scale,
                    "imu_present": banner.imu_present,
                    "rst": banner.rst,
                    "emg": banner.emg,
                    "cols": list(banner.cols),
                    "channels": list(banner.channels),
                    # Always one entry per channel, in column order — the page
                    # indexes it alongside the frame values, so a short list
                    # would silently shift every readout.
                    "chan": [{"name": m.name, "kind": m.kind,
                              "r_fixed": m.r_fixed}
                             for m in banner.channel_meta],
                    "supported": banner.supported,
                } if banner else None,
            }

    def derived(self, adc: int, channel: int | str | None = None) -> dict:
        """The full chain for one ADC reading, using the banner's constants.

        counts → millivolts → sensor resistance, then a branch by sensor kind:

        * **force** channels continue → conductance → approximate newtons, with
          ``range`` saying whether that force is inside the part's rated band.
        * **flex** channels continue → bend percent against the recorded span,
          with ``range`` saying whether the reading is clamped at either end.

        The branch is the point. The FSR402 force curve is meaningless for a
        bend sensor, and applying it anyway would print a confident newton
        figure for a bending finger. Channels whose kind is unknown stop at
        resistance rather than guessing.

        ``channel`` is the column index (or name); omit it only when the kind
        genuinely does not matter, since the default assumes a force channel
        for backwards compatibility with single-FSR callers.
        """
        with self._lock:
            b = self._acc.banner
        ref = b.adc_ref_mv if b else 3300
        vdiv = b.vdiv_mv if b else 3300
        bits = b.adc_bits if b else 10
        meta = self._meta_for(b, channel)

        # Motion channels never touch the divider maths: there is no resistor
        # in the path, and sensor_ohms() would happily return a plausible
        # resistance for an acceleration.
        if meta.is_imu:
            scale = b.imu_scale if b else 1000
            value = to_units(adc, scale)
            return {"channel": meta.name, "kind": meta.kind, "r_fixed": None,
                    "mv": None, "ohm": None, "us": None, "newtons": None,
                    "gramsf": None, "bend_pct": None,
                    "value": value,
                    "unit": "g" if meta.kind == KIND_ACCEL else "deg/s",
                    "range": "imu"}

        ohm = sensor_ohms(adc, ref, vdiv, meta.r_fixed, bits)
        out = {
            "channel": meta.name,
            "kind": meta.kind,
            "r_fixed": meta.r_fixed,
            "mv": adc_to_mv(adc, ref, bits),
            "ohm": ohm,
            "us": conductance_us(ohm),
            "newtons": None,
            "gramsf": None,
            "bend_pct": None,
            "range": "open",
        }
        if meta.kind == KIND_FLEX:
            span = self._flex_span(meta.name)
            out["bend_pct"] = bend_percent(ohm, span)
            out["range"] = bend_range(ohm, span)
        elif meta.kind == KIND_FSR:
            newtons = force_newtons(ohm)
            out["newtons"] = newtons
            out["gramsf"] = grams_force(newtons)
            out["range"] = force_range(newtons)
        elif meta.kind == KIND_FLEXIFORCE:
            # An A401 has no published curve to borrow: newtons wait for its
            # own calibration (GRIP_TEST_PLAN.md gate G1). Conductance, which
            # is what it is linear in, is already in "us".
            out["range"] = "uncalibrated"
        return out

    def imu_summary(self, window_s: float = 3.0) -> dict:
        """Derived motion readout for the Developer page's Motion card.

        Everything the IMU is fitted for, in one poll: orientation from
        gravity, how hard the hand is moving, and the tremor content of the
        acceleration magnitude.

        **Magnitude, not a single axis.** ||a|| is independent of how the board
        happens to be mounted on the glove, so the tremor figure does not
        change meaning when the glove is re-donned — which is exactly the
        failure mode listed for the flex strips in GLOVE_FIRMWARE_PLAN.md §8.

        Every field that cannot be computed comes back as ``None`` with a
        ``note`` saying why, rather than as a zero that reads like a
        measurement of stillness.
        """
        with self._lock:
            banner = self._acc.banner
            frames = [f for f, _ts in self._frames]
            measured_hz = self._acc.rate_hz

        if banner is None:
            return {"present": False, "note": "No banner yet — connect the board."}
        if not banner.imu_present:
            return {"present": False, "imu": banner.imu,
                    "note": "This firmware reports no IMU. Check the MPU6050 "
                            "wiring on A4/A5 and reconnect, or for an onboard "
                            "IMU install its library and re-flash."}
        idx = banner.imu_index()
        if not idx:
            # Declared but not in the columns: refuse rather than guess an
            # offset, which would read a flex strip as an accelerometer.
            return {"present": False, "imu": banner.imu,
                    "note": "Banner declares an IMU but the six motion columns "
                            "are missing from cols=."}

        # The device's own measured rate is authoritative over the banner's
        # nominal one: spectral results scale directly with it.
        fs = measured_hz if measured_hz > 1 else float(banner.rate or 100)
        want = max(4, int(round(window_s * fs)))
        recent = frames[-want:]
        scale = banner.imu_scale

        def col(name: str, frame) -> float | None:
            i = idx[name]
            return to_units(frame.values[i], scale) if i < len(frame.values) else None

        accel = [(col("ax", f), col("ay", f), col("az", f)) for f in recent]
        gyro = [(col("gx", f), col("gy", f), col("gz", f)) for f in recent]
        accel = [t for t in accel if None not in t]
        gyro = [t for t in gyro if None not in t]
        if not accel:
            return {"present": True, "imu": banner.imu,
                    "note": "No motion samples in the buffer yet."}

        # Tilt from a short average, not a single sample: one frame of ADC-
        # scale noise swings the angle by a degree or two and makes a resting
        # readout look jittery when the board is not moving at all.
        tail = accel[-min(len(accel), max(2, int(fs // 10))):]
        avg = tuple(sum(t[i] for t in tail) / len(tail) for i in range(3))
        orientation = tilt(*avg)

        a_mag = [magnitude(*t) for t in accel]
        g_mag = [magnitude(*t) for t in gyro] if gyro else []
        tremor = band_power(a_mag, fs)

        return {
            "present": True,
            "imu": banner.imu,
            "scale": scale,
            "fs": round(fs, 2),
            "n": len(accel),
            "window_s": round(len(accel) / fs, 2) if fs else None,
            "accel": {"x": accel[-1][0], "y": accel[-1][1], "z": accel[-1][2],
                      "magnitude": a_mag[-1]},
            "gyro": ({"x": gyro[-1][0], "y": gyro[-1][1], "z": gyro[-1][2],
                      "magnitude": g_mag[-1]} if gyro else None),
            "tilt": orientation,
            # Motion RMS on ||a|| about its own mean: gravity cancels out, so
            # this is movement only, in g.
            "motion_rms_g": rms(a_mag),
            "gyro_rms_dps": rms(g_mag) if g_mag else None,
            # Measured, not trusted from a counter — see imu.held_fraction.
            "held_frac": held_fraction(accel),
            "tremor": tremor,
            "tremor_note": None if tremor else (
                f"Needs at least {MIN_WINDOW_S:.0f} s of samples at a rate that "
                f"resolves {TREMOR_BAND[0]}–{TREMOR_BAND[1]} Hz."),
        }

    def imu_series(self, t0: float, t1: float) -> dict:
        """IMU samples whose host arrival time falls in [t0, t1], in g and °/s.

        For a test that records the glove beside the camera (the tremor test,
        docs/tests/TREMOR_TEST_PLAN.md §5): the host clock is the only one
        both streams share, so it selects the window. The **device** clock
        spaces the samples, though — host arrival times come in USB bursts —
        so ``t`` is the device timestamp in seconds and ``fs`` the measured
        device rate, which is what the spectral maths needs.

        Returns ``{"fs", "t", "accel", "gyro"}`` with accel/gyro as lists of
        (x, y, z), or ``{"fs": 0.0, ...}`` with empty lists when there is no
        banner, no IMU or no samples in the window.
        """
        with self._lock:
            banner = self._acc.banner
            frames = [f for f, ts in self._frames if t0 <= ts <= t1]
            measured_hz = self._acc.rate_hz
        empty = {"fs": 0.0, "t": [], "accel": [], "gyro": []}
        if banner is None or not banner.imu_present:
            return empty
        idx = banner.imu_index()
        if not idx or not frames:
            return empty
        scale = banner.imu_scale
        fs = measured_hz if measured_hz > 1 else float(banner.rate or 100)

        ts, accel, gyro = [], [], []
        for f in frames:
            if max(idx.values()) >= len(f.values):
                continue
            a = tuple(to_units(f.values[idx[k]], scale) for k in ("ax", "ay", "az"))
            g = tuple(to_units(f.values[idx[k]], scale) for k in ("gx", "gy", "gz"))
            if None in a or None in g:
                continue
            ts.append(f.t_us / 1_000_000.0)
            accel.append(a)
            gyro.append(g)
        return {"fs": fs, "t": ts, "accel": accel, "gyro": gyro}

    def imu_name(self) -> str | None:
        """The IMU the banner names, or None when there is none."""
        with self._lock:
            banner = self._acc.banner
        return banner.imu if banner is not None and banner.imu_present else None

    def _meta_for(self, banner, channel: int | str | None) -> ChannelMeta:
        """Channel details for an index or name, with a safe fallback.

        Never returns None: an unrecognised channel degrades to the banner's
        global resistor and a kind guessed from the name, which is the same
        path firmware predating the ``chan=`` field takes.
        """
        default_r = banner.r_fixed if banner else 10000
        if banner is not None:
            metas = banner.channel_meta
            if isinstance(channel, int) and 0 <= channel < len(metas):
                return metas[channel]
            if isinstance(channel, str):
                for m in metas:
                    if m.name == channel:
                        return m
        name = channel if isinstance(channel, str) else ""
        # No channel named at all: assume force, matching the original
        # single-FSR behaviour of this method.
        kind = kind_from_name(name) if name else KIND_FSR
        return ChannelMeta(name=name, kind=kind, r_fixed=default_r)

    def _flex_span(self, name: str):
        """Recorded bend span for a flex channel.

        Currently always the provisional default — per-user calibration is
        gate 9 (``calibrate.py``). Isolated here so that landing calibration
        means changing this one method, and so every flex reading today is
        correctly reported as uncalibrated.
        """
        return default_span()

    # ── CSV recording ─────────────────────────────────────────────────────

    def start_recording(self) -> tuple[bool, str]:
        if not self.is_connected():
            return False, "Connect to the board first."
        with self._lock:
            if self._csv_path is not None:
                return False, "Already recording."
            banner = self._acc.banner
            channels = list(banner.channels) if banner else []
            outdir = os.path.join(self._results_dir, "glove")
            try:
                os.makedirs(outdir, exist_ok=True)
                # A simulated recording says so in its name, so it can never be
                # read later as data from the glove.
                prefix = "glove_sim_" if isinstance(self._ser, SimSerial) else "glove_"
                name = prefix + datetime.now().strftime("%Y%m%d_%H%M%S") + ".csv"
                path = os.path.join(outdir, name)
                fh = open(path, "w", newline="", encoding="utf-8")
            except OSError as exc:
                return False, f"Could not start recording: {exc}"
            writer = csv.writer(fh)
            # host_time is a COARSE arrival stamp: pyserial hands us a whole
            # buffered chunk at once, so a burst of frames shares nearly the
            # same value. Use it only to align against the camera clock
            # (ROADMAP §3.1); per-sample timing comes from the device's t_us.
            writer.writerow(["host_time", "seq", "t_us", *channels])
            self._csv_file = fh
            self._csv_writer = writer
            self._csv_path = path
            self._csv_rows = 0
        return True, f"Recording to results/glove/{os.path.basename(path)}"

    def stop_recording(self) -> tuple[bool, str]:
        with self._lock:
            if self._csv_path is None:
                return False, "Not recording."
            path, rows = self._csv_path, self._csv_rows
            try:
                self._csv_file.close()
            except OSError:
                pass
            self._csv_file = None
            self._csv_writer = None
            self._csv_path = None
        return True, f"Saved {rows} rows to {os.path.basename(path)}"
