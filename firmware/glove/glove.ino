/*
 * glove.ino - analog acquisition for the sensor-glove digital twin
 *
 * Implements the analog front end and serial protocol specified in
 * docs/glove/GLOVE_FIRMWARE_PLAN.md (sections 3 and 4).
 *
 * Current hardware (2026-11-08, fw 0.10.0): four FSR402 pads wired directly -
 * p0 on A1 (thumb tip), p1 on A2 (index tip), p2 on A3 (middle tip), p3 on A6
 * (ring tip) - five flex strips through a CD74HC4067 on C0-C4, thumb -> pinky
 * (f0..f4), read on A0, and an MPU6050 on the header I2C bus (A4 = SDA,
 * A5 = SCL). Each analog sensor is its own divider against the 3V3 rail:
 *     3V3 --- SENSOR --- Ax --- rFixed --- GND
 * The pads use 10k; the strips use 47k. That is why rFixed is per
 * channel in CHANNELS[] rather than one global: a divider is most sensitive
 * where rFixed is near the sensor's own resistance, and a flex strip
 * (~10k flat to ~110k bent) sits in a very different band from an FSR
 * (1-30k in its rated range). Adding the remaining sensors, and the
 * CD74HC4067 mux, is a table edit rather than a rewrite.
 *
 * The onboard IMU (gate 5) rides in the same frame as six extra columns. It is
 * NOT an analog channel: it never touches the divider maths, and its columns
 * are declared in the banner with kinds `accel`/`gyro` so the host cannot apply
 * a resistance curve to an acceleration.
 *
 * Two transports, the same data (fw 0.11.0). USB serial carries the text
 * protocol below. Bluetooth LE (Nano 33 BLE only) carries the SAME text lines
 * for everything except data frames, which go as compact binary records, over
 * the Nordic UART Service, so the glove streams on battery with no cable. Both
 * run at once when both are connected; commands are accepted from either. See
 * "Bluetooth LE" below for the record layout the host decodes.
 *
 * Firmware emits RAW counts only - ADC counts for the analog channels, and
 * integer milli-units for the IMU. Conversion to newtons and degrees is a
 * per-user host-side step (plan section 2) so recalibration never needs a
 * reflash. The one exception is the 'D' diagnostic mode, which prints derived
 * millivolts/ohms for bench work and never touches the data frames.
 */

/* ---------- board differences ------------------------------------------- */
/*
 * ADC_FULLSCALE_MV is the ADC *reference* (what a reading of ADC_MAX means).
 * VDIV_SUPPLY_MV is the rail feeding the top of the divider.
 * On a Nano 33 BLE these are both 3.3 V. On a classic 5 V Nano the reference
 * is 5 V while the divider is fed from the 3V3 pin, so they differ - which is
 * exactly why they are two separate constants.
 */
#if defined(ARDUINO_ARCH_MBED) || defined(ARDUINO_ARCH_NRF52840)
  #define GLOVE_BOARD        "nano33ble"
  #define ADC_FULLSCALE_MV   3300
  #define HAS_ADC_RESOLUTION 1
  #define ADC_BITS           12
#elif defined(ARDUINO_ARCH_AVR)
  #define GLOVE_BOARD        "nano-avr"
  #define ADC_FULLSCALE_MV   5000   /* default AVCC reference - see notes */
  #define HAS_ADC_RESOLUTION 0
  #define ADC_BITS           10     /* AVR has no analogReadResolution() */
#else
  #warning "Unrecognised board - assuming a 3.3 V ADC reference."
  #define GLOVE_BOARD        "unknown"
  #define ADC_FULLSCALE_MV   3300
  #define HAS_ADC_RESOLUTION 0
  #define ADC_BITS           10
#endif

/*
 * Full-scale count. Every place that converts counts to volts MUST use this,
 * never a literal 1023 - a mismatch here silently corrupts every derived
 * resistance and force downstream.
 */
#define ADC_MAX ((1L << ADC_BITS) - 1L)

/* ---------- IMU ---------------------------------------------------------- */
/*
 * PICK THE LINE THAT MATCHES THE IMU YOU ARE USING, then re-flash.
 *
 * GLOVE_IMU_MPU6050 (the default since fw 0.10.0) is an external MPU6050
 * breakout on the header I2C pins, A4 = SDA and A5 = SCL. It is driven by
 * register below and needs NO library. Its point is placement: the module
 * sits on the back of the hand, where the board's own IMU cannot.
 *
 * The onboard options: the original Nano 33 BLE carries an LSM9DS1, the Rev2
 * a BMI270 + BMM150, and they need different Arduino libraries (plan section
 * 1.3). Install the one you pick from the Developer page's toolchain buttons.
 *
 * WHY THIS IS AN EXPLICIT SWITCH AND NOT __has_include. That was tried first
 * and is silently broken: arduino-cli (and the IDE, which uses it) discovers
 * which libraries a sketch needs by compiling and resolving the *missing
 * header errors*. __has_include swallows the error, so the resolver never
 * learns about the dependency and the library is never added to the build.
 * Measured 2026-08-23: byte-for-byte identical binaries with and without
 * Arduino_LSM9DS1 installed, and zero mentions of it in a verbose build. An
 * auto-detecting sketch would therefore have shipped imu=none forever while
 * looking like it had auto-detected. A plain #include fails loudly instead,
 * naming the header it cannot find.
 *
 * GLOVE_IMU_NONE is a legitimate build: no motion columns, no IMU library
 * needed, everything else unchanged.
 */
#define GLOVE_IMU_MPU6050     /* external, A4/A5       */
//#define GLOVE_IMU_LSM9DS1   /* original Nano 33 BLE  */
//#define GLOVE_IMU_BMI270    /* Nano 33 BLE Rev2      */
//#define GLOVE_IMU_NONE      /* build without motion  */

#if defined(GLOVE_IMU_MPU6050)
  #define HAS_IMU 1
  #define IMU_EXTERNAL 1
  #define IMU_LIB_NAME "MPU6050"
#elif defined(GLOVE_IMU_BMI270)
  #include <Arduino_BMI270_BMM150.h>
  #define HAS_IMU 1
  #define IMU_LIB_NAME "BMI270_BMM150"
#elif defined(GLOVE_IMU_LSM9DS1)
  #include <Arduino_LSM9DS1.h>
  #define HAS_IMU 1
  #define IMU_LIB_NAME "LSM9DS1"
#else
  #define HAS_IMU 0
  #define IMU_LIB_NAME "none"
#endif

#include <math.h>   /* lroundf, for the IMU's float -> milli-unit step */
#include <stdio.h>  /* snprintf, for the one-write frame in emitFrame() */

#if HAS_IMU
#include <Wire.h>   /* only to raise the IMU bus clock - see IMU_I2C_HZ */

/*
 * I2C clock for the onboard IMU, and the single most expensive constant in
 * this file.
 *
 * NEITHER IMU LIBRARY SETS ONE. Arduino_BMI270_BMM150 and Arduino_LSM9DS1
 * both call _wire->begin() and leave the bus at the Arduino default of
 * 100 kHz. Reading the accelerometer and the gyroscope is four transactions a
 * frame, and at 100 kHz that measured 10.6 ms on this board - the entire
 * 10 ms frame budget spent on one sensor, before a single ADC read. It is
 * what held the board at 59-72 Hz while its banner declared 100.
 *
 * 400 kHz (I2C fast mode) is within spec for BOTH parts: the BMI270 datasheet
 * allows up to 1 MHz and the LSM9DS1 up to 400 kHz, so this value is capped by
 * the LSM9DS1 and must not be raised without splitting it per library. The
 * onboard IMUs sit on the board's own internal bus (Wire1 on the Nano 33 BLE,
 * which is why both libraries construct against it) with fixed onboard
 * pull-ups. The MPU6050 is also rated for 400 kHz; it runs on the header bus
 * (Wire, A4/A5) and leans on the breakout's own pull-ups (4.7k on a GY-521).
 * If it drops out on a long cable, that is the place to look.
 */
static const uint32_t IMU_I2C_HZ = 400000;

/* The bus the IMU is on. Kept beside the library choice above rather than
 * assumed, because it is the same fact stated twice. */
#if defined(IMU_EXTERNAL)
  #define IMU_WIRE Wire
#elif defined(ARDUINO_ARDUINO_NANO33BLE) || defined(ARDUINO_ARCH_MBED)
  #define IMU_WIRE Wire1
#else
  #define IMU_WIRE Wire
#endif
#endif

#if defined(GLOVE_IMU_MPU6050)
/*
 * MPU6050, by register. Small enough that a library would add a dependency
 * without adding anything else, and it makes the whole sample ONE 14-byte
 * burst (accel, temperature, gyro) - about 0.4 ms at 400 kHz, against the
 * ~6 ms the onboard IMU's four library transactions cost.
 *
 * Configuration, and why:
 *  - DLPF_CFG = 3: accel 44 Hz / gyro 42 Hz bandwidth, ~5 ms delay. This is the
 *    anti-alias filter for the 100 Hz frame grid (Nyquist 50 Hz) and still
 *    passes the whole 3-12 Hz tremor band untouched.
 *  - SMPLRT_DIV = 0: with the DLPF on the output rate is 1 kHz, so every 10 ms
 *    frame finds a fresh sample and `held` stays at zero. (The onboard chips
 *    run near 100 Hz unlocked to our grid, which is what `held` was for.)
 *  - Accel +/-4 g (8192 LSB/g), gyro +/-1000 dps (32.8 LSB/dps): a brisk
 *    pronation-supination passes 500 dps, and 2000 throws away resolution a
 *    resting tremor needs.
 */
static uint8_t g_mpuAddr = 0x68;    /* AD0 low; 0x69 is tried too */
static uint8_t g_mpuWho  = 0;       /* WHO_AM_I, reported in 'D' */
static uint32_t g_mpuFails = 0;     /* failed bursts since 'Z', reported in 'D' */
static uint16_t g_mpuFailRun = 0;   /* consecutive failures, drives recovery */

/*
 * SOFTWARE I2C, WITH A TIMEOUT ON EVERYTHING. Do not go back to Wire here.
 *
 * fw 0.10.0 read the MPU6050 through the mbed core's Wire. Measured
 * 2026-11-08: after a few minutes of open/fist movement the board went
 * silent - USB still enumerated, but loop() never ran again and the sketch
 * answered nothing, not even '?'. The mbed I2C driver waits without a
 * timeout, so one glitch on a header wire that a hand flexes all the time
 * hangs the whole sampler. Here every wait is bounded: a bad wire costs held
 * IMU samples (counted), never the analog channels or the stream.
 *
 * The pins are driven as true open-drain (nRF S0D1: drive 0, release 1) so
 * the bus never sees push-pull, with the internal pull-up as a backstop to the
 * breakout's own 4.7k.
 *
 * Timing is a busy spin, NOT delayMicroseconds(): on the mbed core that call
 * costs several microseconds even for 1, and the first build of this driver
 * spent 4.9 ms of the 10 ms frame on one 14-byte read. Tune I2C_HALF_SPIN
 * against the 'D' timing line (imu=); the bus clock is whatever results.
 */
#include <nrf_gpio.h>
static uint32_t g_sda = 0, g_scl = 0;      /* nRF pin numbers for A4 / A5 */
static const uint16_t I2C_HALF_SPIN  = 8;     /* spin per half-bit */
static const uint16_t I2C_STRETCH_SPIN = 4000; /* SCL rise timeout, ~0.2 ms */

static inline void i2cDelay() {
  for (volatile uint16_t i = 0; i < I2C_HALF_SPIN; i++) { }
}
static inline void sdaLow()  { nrf_gpio_pin_clear(g_sda); }
static inline void sdaHigh() { nrf_gpio_pin_set(g_sda); }
static inline void sclLow()  { nrf_gpio_pin_clear(g_scl); }
/* Release SCL and wait for it to actually rise (clock stretching, or a
 * shorted line). False means the bus is stuck - abandon the transaction. */
static bool sclHigh() {
  nrf_gpio_pin_set(g_scl);
  for (uint16_t t = 0; t < I2C_STRETCH_SPIN; t++) {
    if (nrf_gpio_pin_read(g_scl)) return true;
  }
  return false;
}
static void i2cPinInit(uint32_t pin) {
  nrf_gpio_pin_set(pin);
  nrf_gpio_cfg(pin, NRF_GPIO_PIN_DIR_OUTPUT, NRF_GPIO_PIN_INPUT_CONNECT,
               NRF_GPIO_PIN_PULLUP, NRF_GPIO_PIN_S0D1, NRF_GPIO_PIN_NOSENSE);
}
/* Clock out up to nine pulses until a slave holding SDA low lets go, then a
 * STOP. The standard recovery for a slave left mid-byte by a reset or glitch. */
static void i2cRecover() {
  sdaHigh();
  for (uint8_t i = 0; i < 9 && !nrf_gpio_pin_read(g_sda); i++) {
    sclLow(); i2cDelay(); sclHigh(); i2cDelay();
  }
  sdaLow(); i2cDelay(); sclHigh(); i2cDelay(); sdaHigh(); i2cDelay();
}
static bool i2cStart() {
  sdaHigh();
  if (!sclHigh()) return false;
  i2cDelay();
  if (!nrf_gpio_pin_read(g_sda)) return false;   /* someone holds SDA */
  sdaLow(); i2cDelay(); sclLow(); i2cDelay();
  return true;
}
static void i2cStop() {
  sdaLow(); i2cDelay();
  sclHigh(); i2cDelay();
  sdaHigh(); i2cDelay();
}
/* Returns true on ACK. */
static bool i2cWriteByte(uint8_t v) {
  for (uint8_t m = 0x80; m; m >>= 1) {
    if (v & m) sdaHigh(); else sdaLow();
    i2cDelay();
    if (!sclHigh()) return false;
    i2cDelay();
    sclLow();
  }
  sdaHigh(); i2cDelay();
  if (!sclHigh()) return false;
  const bool ack = !nrf_gpio_pin_read(g_sda);
  i2cDelay();
  sclLow();
  return ack;
}
static bool i2cReadByte(uint8_t *out, bool ack) {
  uint8_t v = 0;
  sdaHigh();
  for (uint8_t i = 0; i < 8; i++) {
    i2cDelay();
    if (!sclHigh()) return false;
    v = (uint8_t)((v << 1) | (nrf_gpio_pin_read(g_sda) ? 1 : 0));
    i2cDelay();
    sclLow();
  }
  if (ack) sdaLow(); else sdaHigh();
  i2cDelay();
  if (!sclHigh()) return false;
  i2cDelay();
  sclLow();
  sdaHigh();
  *out = v;
  return true;
}

static bool mpuWrite(uint8_t reg, uint8_t val) {
  bool ok = i2cStart() && i2cWriteByte((uint8_t)(g_mpuAddr << 1))
            && i2cWriteByte(reg) && i2cWriteByte(val);
  i2cStop();
  return ok;
}

static bool mpuRead(uint8_t reg, uint8_t *buf, uint8_t n) {
  bool ok = i2cStart() && i2cWriteByte((uint8_t)(g_mpuAddr << 1))
            && i2cWriteByte(reg)
            && i2cStart()                                  /* repeated start */
            && i2cWriteByte((uint8_t)((g_mpuAddr << 1) | 1));
  for (uint8_t i = 0; ok && i < n; i++) ok = i2cReadByte(&buf[i], i + 1 < n);
  i2cStop();
  return ok;
}

/* Register setup, no delays, so it can also re-run mid-stream after the
 * module browned out or a wire came loose and back. */
static bool mpuConfigure() {
  return mpuWrite(0x6B, 0x01)        /* wake, PLL on gyro X clock */
      && mpuWrite(0x1A, 0x03)        /* CONFIG: DLPF_CFG = 3 */
      && mpuWrite(0x19, 0x00)        /* SMPLRT_DIV: 1 kHz */
      && mpuWrite(0x1B, 0x10)        /* GYRO_CONFIG: +/-1000 dps */
      && mpuWrite(0x1C, 0x08);       /* ACCEL_CONFIG: +/-4 g */
}

static bool mpuBegin() {
  g_sda = (uint32_t)digitalPinToPinName(A4);
  g_scl = (uint32_t)digitalPinToPinName(A5);
  i2cPinInit(g_sda);
  i2cPinInit(g_scl);
  i2cRecover();
  const uint8_t addrs[2] = { 0x68, 0x69 };
  for (uint8_t a = 0; a < 2; a++) {
    g_mpuAddr = addrs[a];
    uint8_t who = 0;
    /* Any answer counts: clones report 0x70, 0x72 or 0x98 instead of 0x68,
     * and refusing them would turn a working sensor into "no IMU". */
    if (!mpuRead(0x75, &who, 1) || who == 0x00 || who == 0xFF) continue;
    g_mpuWho = who;
    if (!mpuWrite(0x6B, 0x80)) continue;      /* PWR_MGMT_1: reset */
    delay(100);
    if (!mpuConfigure()) continue;
    delay(20);
    uint8_t probe[14];
    if (mpuRead(0x3B, probe, 14)) return true;
  }
  return false;
}
#endif

/*
 * Transport scale for the IMU columns: values are emitted as integers in
 * milli-units (milli-g, milli-degrees/second) so the frame stays all-integer
 * and the host parser needs no float path. The banner publishes this as
 * `imu_scale=` - do not hardcode 1000 on the host.
 *
 * This is a TRANSPORT unit, not a resolution claim. An LSM9DS1 at +/-2000 dps
 * resolves about 70 mdps per LSB; emitting mdps does not invent precision, it
 * just avoids a decimal point on the wire.
 */
static const int32_t IMU_SCALE = 1000;

/* Column names, in frame order. Kinds are published in the banner's chan=
 * field so the host routes them away from the divider maths. */
static const char *IMU_COLS[6] = { "ax", "ay", "az", "gx", "gy", "gz" };

/* ---------- configuration ------------------------------------------------ */

#define FW_VERSION      "0.11.1"
/*
 * Frame layout is unchanged from proto 1 by the move to 12-bit: only the value
 * scale moved, and the banner's adc_bits already tells the host about that. So
 * this stays 1 rather than forcing a host-side version bump.
 */
#define PROTO_VERSION   1

static const uint16_t SAMPLE_RATE_HZ  = 100;
static const uint32_t FRAME_PERIOD_US = 1000000UL / SAMPLE_RATE_HZ;

/* Divider supply. You wired the FSR to the 3V3 pin. */
static const uint16_t VDIV_SUPPLY_MV = 3300;

/*
 * Legacy banner value only. Each channel carries its own rFixed (see
 * CHANNELS[] below); this is what the banner's `r_fixed=` field reports so a
 * host predating the per-channel `chan=` field still gets a sane number for
 * the force channels rather than nothing at all.
 */
static const uint32_t R_FIXED_DEFAULT_OHMS = 10000;

/* Reads averaged per channel per timestep - noise reduction within one
 * sample, which does not touch the inter-sample dynamics we care about.
 * Raised to 8 with the move to 12-bit: the extra two bits are only worth
 * having if they sit above the ADC's noise floor.
 *
 * Raised again to 16 at gate 2. At the top of the FSR's range the force curve
 * is steep enough that a single count is worth roughly a newton, so ADC noise
 * reads as large force swings; averaging more reads per timestep is the one
 * noise reduction plan section 2 allows, because it stays *within* a timestep
 * and so cannot touch the inter-sample dynamics (tremor) we are measuring.
 * BUDGET, MEASURED 2026-09-20 at 4 channels on the Nano 33 BLE: one
 * analogRead costs about 34 us, so a frame spends 4 x 17 x 34 us = ~2.3 ms
 * here (16 reads plus the settling discard, per channel).
 *
 * The full frame now measures ~9.1 ms of its 10 ms slot: ~2.3 ms here,
 * ~6.1 ms in the IMU, ~0.7 ms emitting. IT IS THE IMU, NOT THIS, THAT HAS
 * NO HEADROOM LEFT - do not reach for this knob first when the rate sags.
 * It was the obvious suspect when four channels dropped the board to 59 Hz
 * and it was the wrong one: halving it to 8 recovered 1 ms of a 7 ms
 * overrun. Run 'D' and read the timing line before changing anything.
 *
 * At 11 channels this phase alone becomes ~5.8 ms, which does not fit
 * alongside the IMU. That is the gate-6 problem to solve when the mux lands,
 * and lowering OVERSAMPLE is the intended lever then.
 */
/* 10 since fw 0.8.0 (12 at 0.7.0, 16 before). The sample phase is held near
 * ~2.2 ms as channels are added: six channels x 11 reads x 34 us = ~2.2 ms,
 * where 12 would have put the frame at ~9.8 ms of its 10 ms slot. Confirm
 * with the D timing line after any change. */
static const uint8_t OVERSAMPLE = 10;

/* Mux settle time. Raise this if adjacent channels bleed into each other. */
static const uint8_t MUX_SETTLE_US = 5;

/* CD74HC4067 select lines - unused until a channel sets muxCh >= 0. */
static const uint8_t MUX_SEL_PINS[4] = { 2, 3, 4, 5 };

struct AnalogChannel {
  const char *name;   /* protocol column name */
  const char *kind;   /* "fsr" | "flex" | "flexiforce" - which curve the host applies */
  uint8_t     pin;    /* analog pin (mux common pin if muxCh >= 0) */
  int8_t      muxCh;  /* -1 = wired directly, else CD74HC4067 channel */
  uint32_t    rFixed; /* this channel's own low-side resistor, ohms */
};

/*
 * Column order here IS the frame's column order, and is published in the boot
 * banner so the host can verify the layout before trusting a single sample.
 * Naming follows the plan: f0..f4 = flex thumb->pinky, p0..p5 = FSR.
 *
 * `kind` matters as much as the resistor value: the host applies a *published
 * FSR402 force curve* to force channels, and that curve is meaningless for a
 * flex strip. Mislabel a channel here and the dev page will print confident
 * newtons for a bending finger.
 *
 * PIN LAYOUT (fw 0.10.0): four FSR pads wired directly, thumb -> ring, on A1,
 * A2, A3 and A6 (A4/A5 carry the MPU6050's I2C), and the five flex strips
 * through the CD74HC4067 on C0-C4 (index on C3 and ring on C1, as wired),
 * thumb -> pinky, read on the mux SIG pin
 * (A0) with the select lines on D2-D5. The mux
 * is powered from 3V3 with EN tied to GND. Each strip keeps its own 47k to GND
 * on its channel side, so the divider is the same as when it was direct.
 * fw 0.11.1 adds the first palm FlexiForce A401 (h0, thenar) on mux C15 as a
 * PLAIN DIVIDER with 47k to GND, not yet the op-amp stage of GRIP_TEST_PLAN.md
 * section 0.3. Its kind is "flexiforce" so the host never pushes it through the
 * FSR402 curve; it reads as resistance and conductance until calibrated.
 * Nothing enforces a layout either way, because
 * every channel names its own pin in the table below and the host reads the
 * layout from the boot banner - the convention is a habit for wiring, not a
 * rule the code checks. Adding the next sensor is one line here plus a flash;
 * nothing on the host or the dev page changes.
 *
 * ONLY DECLARE PINS THAT ARE PHYSICALLY FITTED. An unconnected analog pin
 * floats and produces convincing-looking garbage rather than an obvious zero.
 *
 * rFixed MUST MATCH THE RESISTOR PHYSICALLY ON THE BOARD, per channel. This is
 * the most expensive lesson in this file: the flex channel once said 47k while
 * the bench build used 10k, which made every computed resistance 4.7x too high
 * (a healthy 34k strip read as 160k) and looked exactly like a broken sensor
 * for a whole debugging session. The firmware cannot detect this - the divider
 * maths cannot tell a wrong constant from a wrong sensor, and both produce a
 * plausible number. If you swap a physical resistor, change it here in the
 * same breath.
 *
 * 10k on an FSR402 centres on a moderate press, deliberately kept: plan 5b
 * weighed lowering it and rejected it, because the resolution gained sits
 * above the part's rated 20 N and costs light-touch resolution. 47k on the
 * flex strip is the geometric middle of its own ~10k-110k sweep, which is
 * where the divider gives the most output swing per degree of bend.
 */
/* CD74HC4067 common (SIG) pin. Every muxed channel reads through it. */
#define MUX_SIG A0

static const AnalogChannel CHANNELS[] = {
  { "p0", "fsr",  A1,      -1, 10000 },   /* thumb tip  */
  { "p1", "fsr",  A2,      -1, 10000 },   /* index tip  */
  { "p2", "fsr",  A3,      -1, 10000 },   /* middle tip */
  { "p3", "fsr",  A6,      -1, 10000 },   /* ring tip   */
  { "f0", "flex", MUX_SIG,  0, 47000 },   /* thumb  - mux C0 */
  { "f1", "flex", MUX_SIG,  3, 47000 },   /* index  - mux C3 (wired crossed with ring) */
  { "f2", "flex", MUX_SIG,  2, 47000 },   /* middle - mux C2 */
  { "f3", "flex", MUX_SIG,  1, 47000 },   /* ring   - mux C1 (wired crossed with index) */
  { "f4", "flex", MUX_SIG,  4, 47000 },   /* pinky  - mux C4 */
  { "h0", "flexiforce", MUX_SIG, 15, 47000 },  /* thenar A401 - mux C15, plain divider */
};
static const uint8_t N_CHANNELS = sizeof(CHANNELS) / sizeof(CHANNELS[0]);

/* ---------- state -------------------------------------------------------- */

static uint32_t g_seq       = 0;
static uint32_t g_epochUs   = 0;    /* micros() at the last 'Z' */
static uint32_t g_nextDueUs = 0;
static uint32_t g_missed    = 0;    /* frames skipped: deadline or full TX buffer */
static bool     g_streaming = true;
static bool     g_diag      = false;

static uint16_t g_sample[sizeof(CHANNELS) / sizeof(CHANNELS[0])];
static uint16_t g_min[sizeof(CHANNELS) / sizeof(CHANNELS[0])];
static uint16_t g_max[sizeof(CHANNELS) / sizeof(CHANNELS[0])];

/*
 * IMU state. g_imuOk is decided at runtime by IMU.begin(): a library that is
 * installed but cannot talk to the chip must NOT publish six columns of
 * zeroes, because a flat zero trace is indistinguishable from a still hand.
 * When it is false the columns are not declared and not emitted, and the
 * banner says imu=none - the same rule the analog table follows, where only
 * physically fitted pins are declared.
 */
/*
 * Per-phase cost of the last frame, microseconds, plus the worst seen since
 * the last 'Z'. Reported by the 'D' diagnostics only - it never touches a
 * data frame.
 *
 * This exists because the frame budget has now been misattributed twice.
 * Adding two sensors dropped the board from its declared 100 Hz to 59, and
 * both obvious suspects (the oversampled analog reads, then the per-character
 * USB writes) turned out to be a small part of it. Guessing costs a flash
 * cycle each time; these three numbers cost nothing and answer it outright.
 * Read them before touching OVERSAMPLE or the emit path.
 */
static uint16_t g_tSample = 0, g_tImu = 0, g_tTx = 0;
static uint16_t g_tSampleMax = 0, g_tImuMax = 0, g_tTxMax = 0;

static bool    g_imuOk   = false;
static int32_t g_imu[6]  = {0, 0, 0, 0, 0, 0};   /* ax..az mg, gx..gz mdps */
static uint32_t g_imuHeld = 0;   /* frames that reused the previous sample */

/* ---------- reset reason -------------------------------------------------- */
/*
 * Why this boot happened, published in the banner as `rst=`. It exists for the
 * freezes of 2026-11-08: a board that froze and then came back on its own
 * could have browned out (a pinched supply wire), crashed, or been reset by
 * hand, and nothing on the wire told them apart.
 *
 * nRF52840 RESETREAS bits, joined with '+'. `por` means no bit was set, which
 * on this chip is a power-on OR a brown-out - it records neither. The register
 * is cleared after reading so the next boot reports only its own cause.
 *
 * UNVERIFIED: whether the bootloader, which runs first, leaves the register
 * alone. Check once: press the reset button, reconnect, and the banner should
 * say rst=pin. If it says por, the bootloader cleared it and this field
 * carries no information.
 */
static char g_rst[48] = "unknown";

static void readResetReason() {
#if defined(NRF52840_XXAA)
  const uint32_t r = NRF_POWER->RESETREAS;
  NRF_POWER->RESETREAS = 0xFFFFFFFFUL;          /* write-1-to-clear */
  static const struct { uint32_t mask; const char *name; } BITS[] = {
    { POWER_RESETREAS_RESETPIN_Msk, "pin"    },
    { POWER_RESETREAS_DOG_Msk,      "dog"    },
    { POWER_RESETREAS_SREQ_Msk,     "sreq"   },
    { POWER_RESETREAS_LOCKUP_Msk,   "lockup" },
    { POWER_RESETREAS_OFF_Msk,      "off"    },
    { POWER_RESETREAS_LPCOMP_Msk,   "lpcomp" },
    { POWER_RESETREAS_DIF_Msk,      "dif"    },
    { POWER_RESETREAS_NFC_Msk,      "nfc"    },
    { POWER_RESETREAS_VBUS_Msk,     "vbus"   },
  };
  size_t n = 0;
  g_rst[0] = '\0';
  for (uint8_t i = 0; i < sizeof(BITS) / sizeof(BITS[0]); i++) {
    if (!(r & BITS[i].mask)) continue;
    n += snprintf(g_rst + n, sizeof(g_rst) - n, "%s%s", n ? "+" : "", BITS[i].name);
    if (n >= sizeof(g_rst)) break;
  }
  if (!n) snprintf(g_rst, sizeof(g_rst), "por");
#endif
}

/* ---------- acquisition -------------------------------------------------- */

static void selectMux(int8_t ch) {
  for (uint8_t i = 0; i < 4; i++) {
    digitalWrite(MUX_SEL_PINS[i], (ch >> i) & 0x01);
  }
  delayMicroseconds(MUX_SETTLE_US);
}

/* Takes plain scalars rather than the struct: Arduino auto-generates function
 * prototypes and can place them above the struct declaration. */
static uint16_t readChannel(uint8_t pin, int8_t muxCh) {
  if (muxCh >= 0) selectMux(muxCh);

  /* Discard the first conversion after an input change: the sample-and-hold
   * still carries charge from the previous channel. This is the crosstalk
   * that gate 4 tests for. */
  (void)analogRead(pin);

  /* uint32 deliberately: at 12-bit, 16 x 4095 = 65520 clears uint16 by only
   * 15 counts, which is too tight to leave as a trap for the next edit. */
  uint32_t sum = 0;
  for (uint8_t i = 0; i < OVERSAMPLE; i++) sum += analogRead(pin);
  return (uint16_t)(sum / OVERSAMPLE);
}

static void sampleAll() {
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    g_sample[i] = readChannel(CHANNELS[i].pin, CHANNELS[i].muxCh);
    if (g_sample[i] < g_min[i]) g_min[i] = g_sample[i];
    if (g_sample[i] > g_max[i]) g_max[i] = g_sample[i];
  }
}

/*
 * The IMU runs on its own internal output-data rate (~104-119 Hz on the
 * LSM9DS1, ~100 Hz on the BMI270) which is NOT locked to our 100 Hz frame
 * grid. Some frames therefore find no new sample waiting.
 *
 * Never block waiting for one - that would stall the sampler and corrupt the
 * timeline every temporal metric depends on. Reuse the previous value and
 * count it. A held sample is a repeated sample, and repeated samples flatten
 * exactly the high-frequency content this sensor is fitted to measure, so the
 * count is reported in the 'D' diagnostics and the host also detects holds
 * directly by looking for identical consecutive triples.
 */
static void sampleImu() {
#if defined(GLOVE_IMU_MPU6050)
  if (!g_imuOk) return;
  uint8_t b[14];
  /* A failed burst (loose wire) holds the last sample and counts it, the same
   * as an onboard IMU with nothing new - never a frame of zeroes. */
  if (!mpuRead(0x3B, b, 14)) {
    g_imuHeld++;
    g_mpuFails++;
    /* Once a second of failures in a row, try to bring the bus and the chip
     * back (unstick SDA, re-write the config). Costs well under 1 ms. */
    if (++g_mpuFailRun % 100 == 0) { i2cRecover(); mpuConfigure(); }
    return;
  }
  g_mpuFailRun = 0;
  for (uint8_t k = 0; k < 3; k++) {
    const int16_t a = (int16_t)((b[2 * k] << 8) | b[2 * k + 1]);
    const int16_t g = (int16_t)((b[8 + 2 * k] << 8) | b[9 + 2 * k]);
    /* LSB -> milli-g (8192 LSB/g) and milli-dps (32.8 LSB/dps). */
    g_imu[k]     = (int32_t)lroundf((float)a * IMU_SCALE / 8192.0f);
    g_imu[3 + k] = (int32_t)lroundf((float)g * IMU_SCALE / 32.8f);
  }
#elif HAS_IMU
  if (!g_imuOk) return;
  bool fresh = false;
  float x, y, z;
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(x, y, z);
    g_imu[0] = (int32_t)lroundf(x * IMU_SCALE);
    g_imu[1] = (int32_t)lroundf(y * IMU_SCALE);
    g_imu[2] = (int32_t)lroundf(z * IMU_SCALE);
    fresh = true;
  }
  if (IMU.gyroscopeAvailable()) {
    IMU.readGyroscope(x, y, z);
    g_imu[3] = (int32_t)lroundf(x * IMU_SCALE);
    g_imu[4] = (int32_t)lroundf(y * IMU_SCALE);
    g_imu[5] = (int32_t)lroundf(z * IMU_SCALE);
    fresh = true;
  }
  if (!fresh) g_imuHeld++;
#endif
}

/* ---------- derived values (diagnostics only) ---------------------------- */

static uint16_t adcToMillivolts(uint16_t adc) {
  return (uint16_t)(((uint32_t)adc * ADC_FULLSCALE_MV) / (uint32_t)ADC_MAX);
}

/* R_sensor = rFixed * (Vsupply - Vout) / Vout. Returns -1 for "open".
 * Takes rFixed as an argument rather than reading a global: the FSR and the
 * flex strip sit on different resistors, and sharing one value here would
 * silently scale one of them wrong. */
static int32_t sensorOhms(uint16_t adc, uint32_t rFixed) {
  int32_t mv = adcToMillivolts(adc);
  if (mv <= 0) return -1;
  if (mv >= VDIV_SUPPLY_MV) return 0;
  return ((int32_t)rFixed * (int32_t)(VDIV_SUPPLY_MV - mv)) / mv;
}

/* ---------- transmit path ------------------------------------------------ */
/*
 * NOTHING IN THIS SKETCH MAY WAIT ON THE HOST. Every byte goes through TX_RING,
 * and loop() moves it to USB without ever blocking. Do not call Serial.print()
 * or Serial.write() anywhere else.
 *
 * Why, read from the installed core 2026-11-09 (mbed_nano 4.6.0,
 * cores/arduino/USB): Serial.write() forwards to _SerialUSB and ends in
 * USBCDC::send(), which waits with NO timeout (write_op.wait(NULL)) until the
 * PC reads the data or drops DTR.
 * availableForWrite() is not overridden there, so it returns 0 and cannot warn
 * first. Up to fw 0.10.2 a PC that held the port open but stopped reading - a
 * hub whose reader thread had died, a script that slept - stopped the sampler
 * AND the command parser with it, which is exactly what a frozen board looks
 * like. The 2026-11-08 bench lines already showed single frames stuck 27 ms
 * and 41 ms in tx= while a script was not reading.
 *
 * Now: whole lines are queued (a full ring drops the line - frames count in
 * g_missed, text in g_txDrop - never part of one), and txPump() hands USB at
 * most one packet per call with send_nb(), which copies only when the
 * endpoint is idle and returns at once. The ring is emptied whenever the host
 * goes away, so a new connection starts on a line boundary, not on the tail of
 * stale frames.
 *
 * Sizing: a frame is ~110 bytes, the 'D' burst ~800 every 200 ms, and USB
 * drains far faster than either, so 4 KB only fills when the PC stops reading
 * - which is the case it is for.
 */
static const uint32_t TX_RING = 4096;          /* power of two */
/* Room frames may not use, so a reply to a command (the banner, #ZERO) still
 * fits when a PC that stopped reading has let frames fill the rest. Measured
 * 2026-11-09 on the first 0.10.3 build: after 4 s unread, '?' was handled but
 * its banner was dropped (txdrop=1) behind a full queue of stale frames.
 * 768 holds the banner (~400 bytes) with room to spare. */
static const uint32_t TX_TEXT_RESERVE = 768;
static uint32_t g_txDrop = 0;                  /* text lines dropped since 'Z' */

/* One transmit queue. A class with its methods inside, not free functions
 * taking a struct: Arduino generates prototypes for free functions and can
 * place them above the type they name. Head and tail run free; queued is
 * head - tail. Used twice: USB and (on the Nano 33 BLE) Bluetooth. */
class TxRing {
 public:
  uint32_t queued() const { return head_ - tail_; }
  /* Queue all n bytes or none; `keep` is room that must stay free after. */
  bool put(const uint8_t *p, uint32_t n, uint32_t keep) {
    if (n + keep > TX_RING - queued()) return false;
    for (uint32_t i = 0; i < n; i++) buf_[(head_ + i) & (TX_RING - 1)] = p[i];
    head_ += n;
    return true;
  }
  /* The contiguous run at the tail, up to the wrap. */
  const uint8_t *peek(uint32_t *n) const {
    const uint32_t off = tail_ & (TX_RING - 1);
    uint32_t run = queued();
    if (run > TX_RING - off) run = TX_RING - off;
    *n = run;
    return &buf_[off];
  }
  void take(uint32_t n) { tail_ += n; }
  void clear() { tail_ = head_; }
 private:
  uint8_t  buf_[TX_RING];
  uint32_t head_ = 0, tail_ = 0;
};
static TxRing g_usbTx;

/* ---------- Bluetooth LE -------------------------------------------------- */
/*
 * The cordless link, for a glove on battery. Nano 33 BLE only (the nRF52840's
 * own radio, through ArduinoBLE); an AVR build has no radio and compiles
 * without it.
 *
 * SERVICE: the Nordic UART Service, so a generic tool (nRF Connect) can also
 * see it. RX (6E400002, write) takes the same one-letter commands as USB. TX
 * (6E400003, notify) is a byte stream cut into notifications of up to MTU-3
 * bytes; a record can straddle two notifications, so the host reassembles the
 * stream rather than treating a notification as a unit.
 *
 * STREAM: text lines exactly as on USB (banner, #ZERO, #DIAG, '!' lines),
 * EXCEPT data frames, which are binary records - half the bytes of the text
 * line, which matters on a link this narrow:
 *     0x01, len, seq u32, t_us u32, each analog u16, each IMU column i32
 * little-endian, `len` counting the bytes after itself. 0x01 never occurs in
 * the text, so it marks a record unambiguously, and `len` lets the host skip
 * a record it cannot decode yet (no banner). Column order and kinds are the
 * banner's, as on USB. The host turns each record back into the same
 * "G,..." line, so everything above the transport is unchanged.
 *
 * NOTHING HERE MAY WAIT EITHER. ArduinoBLE's notify ends in
 * HCIClass::sendAclPkt(), which spins in poll() until the controller has a
 * free packet buffer (ArduinoBLE 2.1.0, utility/HCI.cpp) - on a weak link
 * that is the sampler stalled, the same failure the USB path was rebuilt to
 * avoid. So the pump checks the controller's free buffers first and sends
 * only when one is free; otherwise the bytes wait in the ring, and a full
 * ring drops whole frames, counted in `missed` as on USB. The counters it
 * needs (HCI._pendingPkt/_maxPkt) and the negotiated MTU (ATT._peers) are
 * private in the library, hence the `#define private public` around those two
 * headers. If an ArduinoBLE update renames them this fails to compile, loudly,
 * rather than quietly blocking.
 */
#if defined(ARDUINO_ARCH_MBED) && defined(NRF52840_XXAA)
  #define GLOVE_BLE 1
#else
  #define GLOVE_BLE 0
#endif

#if GLOVE_BLE
#include <ArduinoBLE.h>
#define private public
#include <utility/HCI.h>
#include <utility/ATT.h>
#undef private

#define BLE_NAME "Hand3D Glove"
static const char *NUS_SERVICE = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *NUS_RX      = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *NUS_TX      = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
/* Largest notification value. The controller's ACL buffer caps the MTU near
 * this anyway (ATT.setMaxMtu(pktLen - 9)); the live MTU is read per send. */
static const uint16_t BLE_VALUE_MAX = 244;
/* A part-filled notification waits at most this long for more bytes. ~200
 * bytes of records accumulate in 40 ms, so most notifications go nearly full
 * at ~25 a second, well inside what the link carries. */
static const uint32_t BLE_FLUSH_MS = 40;
/* Notifications handed over per pump call, at most. */
static const uint8_t BLE_PUMP_BURST = 4;
static const uint8_t BLE_REC_MARK = 0x01;

static BLEService        g_bleService(NUS_SERVICE);
static BLECharacteristic g_bleRx(NUS_RX, BLEWrite | BLEWriteWithoutResponse, 20);
static BLECharacteristic g_bleTxChar(NUS_TX, BLENotify, BLE_VALUE_MAX);
static TxRing   g_bleTx;
static bool     g_bleOk = false;       /* radio came up */
static bool     g_bleLinked = false;   /* a central is connected AND subscribed */
static uint32_t g_bleLastSendMs = 0;
static uint32_t g_bleNotes = 0;        /* notifications sent since 'Z' */
static uint32_t g_bleWaits = 0;        /* pumps that found no free buffer since 'Z' */

/* The negotiated ATT MTU of the connected central, 23 until it asks for more. */
static uint16_t bleMtu() {
  for (int i = 0; i < ATT_MAX_PEERS; i++) {
    if (ATT._peers[i].connectionHandle != 0xffff) return ATT._peers[i].mtu;
  }
  return 23;
}

/* Refreshed once per loop pass. ATT.connected(), not BLE.connected(): the
 * latter runs a full HCI poll on every call. */
static void bleRefreshLink() {
  const bool was = g_bleLinked;
  g_bleLinked = g_bleOk && ATT.connected() && g_bleTxChar.subscribed();
  /* A new subscriber starts on a record boundary, not mid-way through stale
   * frames queued for the last one. */
  if (!was || !g_bleLinked) g_bleTx.clear();
}

static void blePump() {
  if (!g_bleLinked) return;
  uint16_t payload = bleMtu() - 3;
  if (payload > BLE_VALUE_MAX) payload = BLE_VALUE_MAX;
  const uint32_t now = millis();
  for (uint8_t k = 0; k < BLE_PUMP_BURST; k++) {
    const uint32_t q = g_bleTx.queued();
    if (!q) return;
    if (q < payload && now - g_bleLastSendMs < BLE_FLUSH_MS) return;
    if (HCI._pendingPkt >= HCI._maxPkt) { g_bleWaits++; return; }
    uint32_t n;
    const uint8_t *p = g_bleTx.peek(&n);
    if (n > payload) n = payload;
    g_bleTxChar.writeValue(p, (int)n);
    g_bleTx.take(n);
    g_bleLastSendMs = now;
    g_bleNotes++;
  }
}

static void bleCommands();   /* after handleCommand(), below */
#endif

/* On the mbed core `Serial` is a UART wrapper that forwards to the real USB
 * object, _SerialUSB (arduino::USBSerial, a USBCDC). The non-blocking calls
 * live only on the latter, so the transmit path talks to it directly. */
#if defined(ARDUINO_ARCH_MBED) && defined(SERIAL_CDC)
  #include <USB/PluggableUSBSerial.h>
  #define GLOVE_USB_CDC 1
#endif

/* Is a terminal attached (DTR up)? NOT `(bool)Serial`: on this core that
 * operator calls delay(1), which cost 1 ms of every 10 ms frame. */
static inline bool hostConnected() {
#if defined(GLOVE_USB_CDC)
  return _SerialUSB.connected();
#else
  return (bool)Serial;
#endif
}

/* Hand USB at most one packet. 63 bytes, not 64: a full-size packet leaves
 * the PC waiting for a following short one before it passes the data up. */
static void txPump() {
  if (!hostConnected()) { g_usbTx.clear(); return; }
  uint32_t n;
  uint8_t *p = (uint8_t *)g_usbTx.peek(&n);   /* up to the wrap; the rest next call */
  if (!n) return;
  if (n > 63) n = 63;
#if defined(GLOVE_USB_CDC)
  uint32_t sent = 0;
  _SerialUSB.send_nb(p, n, &sent, true);
#else
  const int room = Serial.availableForWrite();
  if (room <= 0) return;
  if ((uint32_t)room < n) n = (uint32_t)room;
  const uint32_t sent = (uint32_t)Serial.write(p, n);
#endif
  g_usbTx.take(sent);
}

/* A Print that collects one line and queues it whole when the newline comes,
 * so the banner and the diagnostics keep their print() style and still can
 * neither block nor reach the PC half-written. */
class TxLine : public Print {
 public:
  size_t write(uint8_t c) override {
    if (n_ < sizeof(buf_)) buf_[n_++] = c; else over_ = true;
    if (c == '\n') commit();
    return 1;
  }
  using Print::write;
 private:
  /* To every transport that is listening; a line any of them could not take
   * counts once. */
  void commit() {
    bool lost = over_;
    if (!over_) {
      if (hostConnected() && !g_usbTx.put(buf_, (uint32_t)n_, 0)) lost = true;
#if GLOVE_BLE
      if (g_bleLinked && !g_bleTx.put(buf_, (uint32_t)n_, 0)) lost = true;
#endif
    }
    if (lost) g_txDrop++;
    n_ = 0;
    over_ = false;
  }
  /* The banner is the longest line: ~400 bytes today, ~470 at the full
   * eleven analog channels. */
  uint8_t buf_[640];
  size_t  n_ = 0;
  bool    over_ = false;
};
static TxLine Out;

/* ---------- output ------------------------------------------------------- */

static void emitBanner() {
  Out.print(F("#GLOVE fw=" FW_VERSION " proto="));
  Out.print(PROTO_VERSION);
  Out.print(F(" board=" GLOVE_BOARD " rate="));
  Out.print(SAMPLE_RATE_HZ);
  Out.print(F(" adc_bits="));
  Out.print(ADC_BITS);
  Out.print(F(" adc_ref_mv="));
  Out.print(ADC_FULLSCALE_MV);
  Out.print(F(" vdiv_mv="));
  Out.print(VDIV_SUPPLY_MV);
  Out.print(F(" r_fixed="));
  Out.print(R_FIXED_DEFAULT_OHMS);
  /* imu= is the compiled-in library name ONLY if the chip actually answered.
   * A library that is installed but silent must read as none, or the host
   * will expect six columns that never arrive. */
  Out.print(F(" imu="));
  Out.print(g_imuOk ? IMU_LIB_NAME : "none");
  if (g_imuOk) {
    Out.print(F(" imu_scale="));
    Out.print(IMU_SCALE);
  }
  /* Additive, like chan= below: hosts that predate it ignore the key. */
  Out.print(F(" rst="));
  Out.print(g_rst);
#if GLOVE_BLE
  /* Whether the radio is up, so a USB host can tell a board that can go
   * cordless from one whose radio failed to start. */
  Out.print(F(" ble="));
  Out.print(g_bleOk ? 1 : 0);
#endif
  Out.print(F(" emg=0 cols=seq,t_us"));
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    Out.print(',');
    Out.print(CHANNELS[i].name);
  }
  if (g_imuOk) {
    for (uint8_t i = 0; i < 6; i++) {
      Out.print(',');
      Out.print(IMU_COLS[i]);
    }
  }
  /*
   * Per-channel detail: name:kind:rFixed, comma separated. This is an ADDITIVE
   * banner field - `cols` and the frame layout are unchanged, and the host's
   * parser ignores keys it does not know - so proto stays 1 and older
   * recordings still read. A host that does not understand `chan` falls back
   * to r_fixed above and to the f./p. naming convention for kind.
   */
  Out.print(F(" chan="));
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    if (i) Out.print(',');
    Out.print(CHANNELS[i].name);
    Out.print(':');
    Out.print(CHANNELS[i].kind);
    Out.print(':');
    Out.print(CHANNELS[i].rFixed);
  }
  /* IMU entries carry a kind but NO third field: there is no low-side
   * resistor on an accelerometer, and putting the scale in that slot would
   * invite a host to read it as ohms. The scale is a separate banner key. */
  if (g_imuOk) {
    for (uint8_t i = 0; i < 6; i++) {
      Out.print(',');   /* CHANNELS[] is never empty, so a comma always leads */
      Out.print(IMU_COLS[i]);
      Out.print(i < 3 ? ":accel" : ":gyro");
    }
  }
  Out.println();
}

/*
 * Frame scratch buffer. Worst case today is ~100 bytes; at the full 11
 * channels plus the IMU it is ~135. 192 leaves headroom without being worth
 * counting - this board has 256 KB of RAM.
 */
static char g_line[192];

static void emitFrame() {
  /*
   * No host, or no room in the ring: drop the frame and count it. The seq gap
   * makes the loss auditable on the host, whereas a stalled sampler is
   * invisible (see the transmit path above).
   */
  const bool usb = hostConnected();
#if GLOVE_BLE
  const bool ble = g_bleLinked;
#else
  const bool ble = false;
#endif
  if (!usb && !ble) {
    g_missed++;
    return;
  }
  /* One timestamp for both transports, so the two never disagree. */
  const uint32_t tUs = micros() - g_epochUs;
  bool lost = false;

#if GLOVE_BLE
  if (ble) {
    /* The binary record (see "Bluetooth LE"). Little-endian, as the nRF52840
     * is, so memcpy lays the fields down in wire order. */
    uint8_t rec[2 + 8 + 2 * N_CHANNELS + 4 * 6];
    uint8_t k = 2;
    memcpy(&rec[k], &g_seq, 4); k += 4;
    memcpy(&rec[k], &tUs, 4);   k += 4;
    for (uint8_t i = 0; i < N_CHANNELS; i++) { memcpy(&rec[k], &g_sample[i], 2); k += 2; }
    if (g_imuOk) {
      for (uint8_t i = 0; i < 6; i++) { memcpy(&rec[k], &g_imu[i], 4); k += 4; }
    }
    rec[0] = BLE_REC_MARK;
    rec[1] = (uint8_t)(k - 2);
    if (!g_bleTx.put(rec, k, TX_TEXT_RESERVE)) lost = true;
  }
#endif
  if (!usb) {
    if (lost) g_missed++;
    return;
  }

  /*
   * FORMAT THE WHOLE FRAME, THEN QUEUE IT ONCE. Do not go back to a
   * print() per field.
   *
   * The mbed core's USB CDC (PluggableUSBSerial.h) implements the single-byte
   * write(uint8_t) as a _putc straight onto the endpoint, while the block
   * write(buf, size) packs up to CDC_MAX_PACKET_SIZE (64) bytes into each
   * USB transfer. Printing field by field therefore cost roughly one USB
   * transaction PER CHARACTER - about 90 of them for a frame this wide.
   *
   * Measured 2026-09-20 with three FSRs, a flex strip and the IMU: this phase
   * cost 2.7 ms field-at-a-time and 0.7 ms buffered. Worth having, but on its
   * own it moved the board from 59 Hz only to 72 - the frame was also being
   * held up by the IMU bus (see IMU_I2C_HZ), which was the larger half.
   * Both had to be fixed to get back to 100 Hz.
   *
   * That is the lesson worth keeping: the rate sagged as channels were added,
   * and the cost was NOT where it looked. It is why the 'D' diagnostics now
   * time each phase, and why the rate is a measured gate (plan section 6)
   * rather than an assumption.
   *
   * Since fw 0.10.3 the line goes to TX_RING rather than to Serial, and
   * txPump() packs it into USB packets of up to 63 bytes - the same
   * packet-at-a-time cost as the block write above, without the wait.
   */
  int n = snprintf(g_line, sizeof(g_line), "G,%lu,%lu",
                   (unsigned long)g_seq,
                   (unsigned long)tUs);
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    if (n < 0 || n >= (int)sizeof(g_line)) break;
    n += snprintf(g_line + n, sizeof(g_line) - n, ",%u",
                  (unsigned int)g_sample[i]);
  }
  if (g_imuOk) {
    for (uint8_t i = 0; i < 6; i++) {
      if (n < 0 || n >= (int)sizeof(g_line)) break;
      n += snprintf(g_line + n, sizeof(g_line) - n, ",%ld", (long)g_imu[i]);
    }
  }
  /* snprintf reports what it WOULD have written, so an overrun shows up as an
   * n past the end. Drop the frame rather than emit a truncated line: the
   * seq gap is auditable on the host, a short line is just corruption. */
  if (n < 0 || n + 2 >= (int)sizeof(g_line)) {
    g_missed++;
    return;
  }
  /* Arduino's println() terminates CRLF; keep that exactly - the host's
   * line splitting and the recorded CSVs both already expect it. */
  g_line[n++] = '\r';
  g_line[n++] = '\n';
  if (!g_usbTx.put((const uint8_t *)g_line, (uint32_t)n, TX_TEXT_RESERVE)) lost = true;
  /* A frame lost on either transport counts once. */
  if (lost) g_missed++;
}

static void emitDiag() {
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    Out.print(F("#DIAG "));
    Out.print(CHANNELS[i].name);
    Out.print(F(" adc="));
    Out.print(g_sample[i]);
    Out.print(F(" mv="));
    Out.print(adcToMillivolts(g_sample[i]));
    Out.print(F(" ohm="));
    Out.print(sensorOhms(g_sample[i], CHANNELS[i].rFixed));
    Out.print(F(" min="));
    Out.print(g_min[i]);
    Out.print(F(" max="));
    Out.print(g_max[i]);
    Out.print(F(" missed="));
    Out.println(g_missed);
  }
  /* tx= is formatting and queueing only since fw 0.10.3; the USB transfer
   * itself happens in txPump() and never waits. txq= is what is still queued
   * (it climbs toward 4096 only while the PC is not reading) and txdrop= the
   * text lines lost to a full queue. */
  Out.print(F("#DIAG timing us sample="));
  Out.print(g_tSample);
  Out.print('/');
  Out.print(g_tSampleMax);
  Out.print(F(" imu="));
  Out.print(g_tImu);
  Out.print('/');
  Out.print(g_tImuMax);
  Out.print(F(" tx="));
  Out.print(g_tTx);
  Out.print('/');
  Out.print(g_tTxMax);
  Out.print(F(" txq="));
  Out.print(g_usbTx.queued());
  Out.print(F(" txdrop="));
  Out.print(g_txDrop);
  Out.println(F("  (last/max since Z; budget is 10000)"));
#if GLOVE_BLE
  /* The radio link: whether a central is subscribed, its MTU, what is still
   * queued for it, notifications sent, and pumps that found the controller's
   * buffers full (a climbing count means the link is narrower than the
   * stream - move closer, or expect missed= to follow). */
  Out.print(F("#DIAG ble up="));
  Out.print(g_bleOk ? 1 : 0);
  Out.print(F(" linked="));
  Out.print(g_bleLinked ? 1 : 0);
  Out.print(F(" mtu="));
  Out.print(g_bleLinked ? bleMtu() : 0);
  Out.print(F(" q="));
  Out.print(g_bleTx.queued());
  Out.print(F(" notes="));
  Out.print(g_bleNotes);
  Out.print(F(" waits="));
  Out.println(g_bleWaits);
#endif
  if (g_imuOk) {
    Out.print(F("#DIAG imu mg="));
    Out.print(g_imu[0]); Out.print(',');
    Out.print(g_imu[1]); Out.print(',');
    Out.print(g_imu[2]);
    Out.print(F(" mdps="));
    Out.print(g_imu[3]); Out.print(',');
    Out.print(g_imu[4]); Out.print(',');
    Out.print(g_imu[5]);
    /* Held frames reused the previous sample because the IMU's own output
     * rate had nothing new. High counts mean the effective IMU rate is below
     * the frame rate, which matters for anything spectral. */
    Out.print(F(" held="));
#if defined(GLOVE_IMU_MPU6050)
    Out.print(g_imuHeld);
    Out.print(F(" who=0x"));
    Out.print(g_mpuWho, HEX);
    Out.print(F(" addr=0x"));
    Out.print(g_mpuAddr, HEX);
    Out.print(F(" i2c_fail="));
    Out.println(g_mpuFails);
#else
    Out.println(g_imuHeld);
#endif
  }
}

/* ---------- commands ----------------------------------------------------- */

static void resetSpans() {
  for (uint8_t i = 0; i < N_CHANNELS; i++) {
    /* Must seed from ADC_MAX, not a literal 1023: at 12-bit a seed of 1023
     * would pin the minimum there for any reading above it. */
    g_min[i] = (uint16_t)ADC_MAX;
    g_max[i] = 0;
  }
}

static void handleCommand(char c) {
  switch (c) {
    case '?': emitBanner();                      break;
    case 'S': g_streaming = true;                break;
    case 'X': g_streaming = false;               break;
    case 'D': g_diag = !g_diag;                  break;
    case 'Z':
      g_seq     = 0;
      g_epochUs = micros();
      g_missed  = 0;
      g_imuHeld = 0;
#if defined(GLOVE_IMU_MPU6050)
      g_mpuFails = 0;
#endif
      g_txDrop  = 0;
#if GLOVE_BLE
      g_bleNotes = 0;
      g_bleWaits = 0;
#endif
      g_tSampleMax = g_tImuMax = g_tTxMax = 0;
      resetSpans();
      Out.println(F("#ZERO"));
      break;
    default:  /* ignore newlines and stray bytes */ break;
  }
}

#if GLOVE_BLE
/* Commands written to the RX characteristic, one letter per byte, exactly as
 * on USB. A reply (the banner, #ZERO) goes to every listening transport.
 *
 * QUEUED FROM A WRITE HANDLER, NOT READ WITH written(). The characteristic
 * holds only its latest value, and the hub sends "?" then "S" back to back:
 * both land in one BLE.poll(), and polling written() afterwards saw only the
 * "S" - measured on the first 0.11.0 build, where the banner never came over
 * the air. The handler runs once per write, inside poll(), so it only
 * queues; loop() runs the commands after the link state is refreshed, so the
 * banner a new subscriber asks for is not dropped as "nobody listening". */
static char    g_bleCmd[32];
static uint8_t g_bleCmdN = 0;

/* A captureless lambda rather than a function: Arduino generates prototypes
 * for free functions and put this one above the ArduinoBLE include. */
static const BLECharacteristicEventHandler bleOnWrite = [](BLEDevice, BLECharacteristic ch) {
  const uint8_t *v = ch.value();
  const int n = ch.valueLength();
  for (int i = 0; i < n && g_bleCmdN < sizeof(g_bleCmd); i++) g_bleCmd[g_bleCmdN++] = (char)v[i];
};

static void bleCommands() {
  const uint8_t n = g_bleCmdN;
  g_bleCmdN = 0;
  for (uint8_t i = 0; i < n; i++) handleCommand(g_bleCmd[i]);
}
#endif

/* ---------- lifecycle ---------------------------------------------------- */

void setup() {
  readResetReason();   /* first, before anything can reset the chip again */
  Serial.begin(115200);
  /* Bounded wait so the banner is not lost to a slow host, but the board
   * still runs headless if nothing ever opens the port. (Here, and only here,
   * the delay(1) inside `!Serial` is wanted: it lets USB come up.) */
  while (!Serial && millis() < 3000) { }

#if HAS_ADC_RESOLUTION
  analogReadResolution(ADC_BITS);
#endif

  for (uint8_t i = 0; i < 4; i++) pinMode(MUX_SEL_PINS[i], OUTPUT);

#if defined(GLOVE_IMU_MPU6050)
  g_imuOk = mpuBegin();
  if (!g_imuOk) {
    Out.println(F("!IMU MPU6050 not answering on A4/A5 (0x68/0x69) - no motion columns"));
  }
#elif HAS_IMU
  g_imuOk = IMU.begin();
  /* AFTER begin(), never before: the library calls _wire->begin() itself, and
   * on some cores that resets the clock to the default. */
  if (g_imuOk) IMU_WIRE.setClock(IMU_I2C_HZ);
  if (!g_imuOk) {
    /* Say so loudly on the wire. Silence here is how "wrong library for this
     * board revision" hides for a week. */
    Out.println(F("!IMU " IMU_LIB_NAME " begin() failed - no motion columns"));
  }
#endif

#if GLOVE_BLE
  g_bleOk = BLE.begin();
  if (g_bleOk) {
    BLE.setLocalName(BLE_NAME);      /* goes in the scan response */
    BLE.setDeviceName(BLE_NAME);
    BLE.setAdvertisedService(g_bleService);
    g_bleRx.setEventHandler(BLEWritten, bleOnWrite);
    g_bleService.addCharacteristic(g_bleRx);
    g_bleService.addCharacteristic(g_bleTxChar);
    BLE.addService(g_bleService);
    /* 7.5-15 ms, in 1.25 ms units. A request only: the PC decides, and
     * Windows often settles on 15 or 30 ms, which still carries the stream
     * because each event can carry several notifications. */
    BLE.setConnectionInterval(6, 12);
    BLE.advertise();
  } else {
    Out.println(F("!BLE radio did not start - USB only"));
  }
#endif

  resetSpans();
  g_epochUs   = micros();
  g_nextDueUs = micros() + FRAME_PERIOD_US;

  emitBanner();
}

void loop() {
  while (Serial.available()) handleCommand((char)Serial.read());
#if GLOVE_BLE
  if (g_bleOk) {
    BLE.poll();          /* timeout 0: handles pending radio events, never waits */
    bleRefreshLink();
    bleCommands();
    blePump();
  }
#endif
  /* Every pass, including the idle spins between frames: that is what
   * drains the ring. */
  txPump();

  if ((int32_t)(micros() - g_nextDueUs) < 0) return;

  /* Absolute grid: accumulate the period rather than restarting from "now",
   * so the schedule cannot drift. Same technique as core/tapping's metronome. */
  g_nextDueUs += FRAME_PERIOD_US;
  if ((int32_t)(micros() - g_nextDueUs) >= 0) {
    /* More than a full period behind - resync instead of running a burst of
     * catch-up frames carrying stale timestamps. */
    g_missed++;
    g_nextDueUs = micros() + FRAME_PERIOD_US;
  }

  const uint32_t tA = micros();
  sampleAll();
  const uint32_t tB = micros();
  sampleImu();
  const uint32_t tC = micros();
  g_seq++;

  if (g_streaming) emitFrame();
  const uint32_t tD = micros();
  txPump();   /* start this frame's first packet now rather than next pass */

  g_tSample = (uint16_t)(tB - tA);
  g_tImu    = (uint16_t)(tC - tB);
  g_tTx     = (uint16_t)(tD - tC);
  if (g_tSample > g_tSampleMax) g_tSampleMax = g_tSample;
  if (g_tImu    > g_tImuMax)    g_tImuMax    = g_tImu;
  if (g_tTx     > g_tTxMax)     g_tTxMax     = g_tTx;

  if (g_diag) {
    static uint32_t lastDiagMs = 0;
    if (millis() - lastDiagMs >= 200) {
      lastDiagMs = millis();
      emitDiag();
    }
  }
}
