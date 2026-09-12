# Repro artifacts — oh-my-pi #9783 (bottom status line recommitted to scrollback)

Captured from a real OMP Desktop 0.9.2 session (engine omp 18.1.17) on Windows 10
IoT Enterprise LTSC 2021 (19044), native Windows, ConPTY.

## Capture geometry: 133 x 42

**Replay at 133x42, not 120x32.** The proxy never logged the ConPTY size, but the
stream records it: the engine pads rows to the terminal width and 5,359 physical
lines are exactly 133 columns, and the highest row addressed is 42 (310 of 319
absolute-positioning writes land in rows 37-42, the pinned bottom chrome).

At 120 columns every 133-wide row — including the status row — wraps onto a second
physical row and manufactures apparent duplicates. See `results.md`.

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
verbatim. OSC 8 hyperlink URIs are dropped, keeping the `id=` parameter and the
envelope.

**Verified equivalent at the true geometry:** replaying the scrubbed capture at
133x42 yields the same state as the original — 19,744 scrollback rows, 19,786 total,
0-row deviation.

## What the original shows

```
20546  CRLF                      <- scroll pushes
    0  CUU  ESC[nA               <- cursor is never moved back up
  319  CUP  ESC[r;cH
11317  EL   ESC[K
```

Emulated at 133x42: **19,744 scrollback rows and 28 status-line rows**, with 6 runs
of adjacent identical status rows (20 rows inside runs, longest 5). A status row
should appear in scrollback essentially never.

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
cursor-query answers. Log the initial `cols x rows` — that is the one piece of
provenance worth not having to reconstruct afterwards.

## How to replay

```bash
npm install @xterm/headless
node analysis/forensics.js capture-scrubbed.bin      # control-sequence census
node analysis/emulate.js   capture-scrubbed.bin 133 42
```
