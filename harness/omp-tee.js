// omp-tee: transparent PTY proxy that captures everything the OMP engine writes.
//
// Why a proxy: the engine only renders its real TUI when stdout is a TTY, so a
// simple pipe would change the behaviour we are trying to capture. This spawns
// the real engine inside its own ConPTY, forwards bytes both ways, and keeps the
// inner terminal state in a headless xterm so it can answer the engine's cursor
// position queries (ESC[6n) exactly like the real terminal would.
//
// Capture output:
//   capture.bin         raw bytes the engine wrote
//   capture-events.log  timestamp + byte count per write (for rate analysis)

const path = require('path');
const fs = require('fs');
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');

const REAL_OMP = process.env.OMP_TEE_REAL || 'C:\\Users\\micha\\AppData\\Local\\omp\\omp.exe';
const DIR = __dirname;
// One file per process: the desktop also runs short omp subcommands (models,
// usage, config probes) and concurrent proxies would otherwise interleave.
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const BIN = path.join(DIR, `capture-${process.pid}-${STAMP}.bin`);
const EVENTS = path.join(DIR, `capture-${process.pid}-${STAMP}.events.log`);
const MAX_CAPTURE = 64 * 1024 * 1024;

const cols = (process.stdout.columns && process.stdout.columns > 0) ? process.stdout.columns : 120;
const rows = (process.stdout.rows && process.stdout.rows > 0) ? process.stdout.rows : 32;

const bin = fs.createWriteStream(BIN, { flags: 'a' });
const events = fs.createWriteStream(EVENTS, { flags: 'a' });

let capturedBytes = 0;
let stopped = false;

function logEvent(kind, n) {
  try { events.write(`${new Date().toISOString()}\t${kind}\t${n}\t${capturedBytes}\n`); } catch {}
}

logEvent('start', 0);
events.write(`${new Date().toISOString()}\targs\t${JSON.stringify(process.argv.slice(2))}\t0\n`);

const child = pty.spawn(REAL_OMP, process.argv.slice(2), {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: process.cwd(),
  env: process.env,
  encoding: null,          // raw Buffers, not decoded strings
  useConpty: true,
});

// Terminal state model, used to answer cursor-position queries faithfully.
const term = new Terminal({ cols, rows, scrollback: 5000, allowProposedApi: true });

function answerQueries(buf) {
  // The engine asks "where is the cursor?" with ESC[6n and expects ESC[<row>;<col>R
  let from = 0;
  for (;;) {
    const i = buf.indexOf('\x1b[6n', from, 'latin1');
    if (i === -1) break;
    from = i + 4;
    const b = term.buffer.active;
    const reply = `\x1b[${b.cursorY + 1};${b.cursorX + 1}R`;
    try { child.write(reply); } catch {}
  }
}

child.onData((chunk) => {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'binary');
  if (!buf.length) return;

  // 1. forward to the desktop's terminal, unchanged
  try { process.stdout.write(buf); } catch {}

  // 2. capture
  if (!stopped && capturedBytes < MAX_CAPTURE) {
    bin.write(buf);
    capturedBytes += buf.length;
    logEvent('data', buf.length);
    if (capturedBytes >= MAX_CAPTURE) { stopped = true; logEvent('capped', 0); }
  }

  // 3. keep the state model current, then answer any cursor queries in this chunk
  term.write(buf, () => answerQueries(buf));
});

// Keyboard / input: outer terminal -> engine
if (process.stdin.isTTY && process.stdin.setRawMode) {
  try { process.stdin.setRawMode(true); } catch {}
}
process.stdin.on('data', (d) => { try { child.write(d); } catch {} });
process.stdin.resume();

// Window resizes
if (process.stdout.on) {
  process.stdout.on('resize', () => {
    try {
      const c = process.stdout.columns, r = process.stdout.rows;
      if (c > 0 && r > 0) { child.resize(c, r); term.resize(c, r); logEvent('resize', c * 1000 + r); }
    } catch {}
  });
}

child.onExit(({ exitCode }) => {
  logEvent('exit', exitCode);
  try { bin.end(); events.end(); } catch {}
  // give the streams a tick to flush
  setTimeout(() => process.exit(exitCode), 30);
});

process.on('SIGINT', () => { try { child.kill(); } catch {} });
