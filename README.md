# Repro artifacts — oh-my-pi #9783 (bottom status line recommitted to scrollback)

Captured from a real OMP Desktop 0.9.2 session (engine omp 18.1.17) on Windows 10
IoT Enterprise LTSC 2021 (19044), native Windows, ConPTY.

## Contents

| file | what it is |
| --- | --- |
| `capture-scrubbed.bin` | The raw bytes the engine wrote to the PTY, ~26 s of activity during the runaway scroll (2.98 MB). **Text scrubbed — see below.** |
| `capture.events.log` | Per-write timestamps and byte counts from the original capture (write-rate timeline). |
| `harness/omp-tee.js` | The PTY proxy used to capture it. |
| `harness/ompwrap.cs` | Launcher (the app spawns the executable directly, so a `.cmd` will not do). |
| `analysis/emulate.js` | Replays a capture through `@xterm/headless` and reports scrollback growth. |
| `analysis/forensics.js` | Escape-sequence census (CRLF / CUU / CUP / EL). |
| `analysis/analyze-status.js` | Counts status-line rows in scrollback and contiguous runs. |
| `analysis/find-divergence.js` | Lockstep replay of two captures, reporting the first byte chunk where terminal state diverges. |
| `results.md` | Measured numbers. |

## Scrubbing (read this before trusting the .bin)

The capture embeds the reporter's session content, so all printable text was
replaced with `x` padded to the **same rendered width**, measured by writing each
text run through `@xterm/headless` itself (a per-codepoint width table gets
grapheme clusters wrong). Every escape sequence, control byte and CR/LF is copied
verbatim.

**Known deviation:** replaying the scrubbed file yields **20,349** scrollback rows
against **20,346** for the original — 3 rows, 0.015%. The escape-sequence census is
identical and the pattern under investigation is unaffected, but this is not a
byte-exact reproduction. The session JSONL is available on request if you want an
exact replay instead.

## What the original shows

```
20546  CRLF                      <- scroll pushes
    0  CUU  ESC[nA               <- cursor is never moved back up
  319  CUP  ESC[r;cH
11317  EL   ESC[K
```

Emulated at 120x32: **20,346 scrollback rows, 202 status-line rows, 65 runs of
adjacent identical status rows** (133 rows inside runs, longest 3), with each
frozen elapsed value repeated 8-30x.

## Capturing this yourself

A redirect to a file changes what the engine renders — it only draws its real TUI
when stdout is a TTY — so the capture needs a PTY proxy that also answers the
engine's `ESC[6n` cursor queries (otherwise it takes a different code path):

```js
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');
const cols = process.stdout.columns || 120, rows = process.stdout.rows || 32;
const child = pty.spawn(OMP, process.argv.slice(2),
  { name: 'xterm-256color', cols, rows, env: process.env, encoding: null, useConpty: true });
const term = new Terminal({ cols, rows, scrollback: 5000 });
child.onData((b) => {
  process.stdout.write(b);      // keep the host terminal working
  fs.appendFileSync(LOG, b);    // capture
  term.write(b, () => {         // answer cursor queries from real state
    // on each ESC[6n in b: child.write(`\x1b[${y+1};${x+1}R`)
  });
});
process.stdin.on('data', (d) => child.write(d));
```

`harness/omp-tee.js` is the full version, including resize forwarding and the
cursor-query answers.

## How to replay

```bash
npm install @xterm/headless
node analysis/forensics.js capture-scrubbed.bin      # control-sequence census
node analysis/emulate.js   capture-scrubbed.bin 120 32
```
