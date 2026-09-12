# Measured results

Capture: 2,999,178 bytes, 397 writes, 2026-09-11T21:43:57Z -> 21:44:22Z (~26 s of
activity within a resumed session; 3.5 MiB / 1459 entries / 871 messages /
15,502 transcript rows).

## Capture geometry: 133 x 42

The proxy never logged the ConPTY size, but the stream records it. Two independent
signals agree:

- **columns = 133** — the engine pads/truncates rows to the terminal width, and
  5,359 physical lines are exactly 133 columns wide (next most common widths are
  partial lines: 1, 134, 33, 61...).
- **rows = 42** — the highest row the engine ever addresses is 42, and 310 of the
  319 absolute-positioning writes land in rows 37-42 (the pinned bottom chrome).

An earlier revision of this file replayed at **120x32**, which was wrong: at 120
columns every 133-wide row (including the status row) wraps onto a second physical
row, manufacturing apparent duplicates. All numbers below are at 133x42.

## Escape-sequence census (byte-level, geometry-independent)

```
CRLF   20546
CUU        0
CUP      319
EL     11317
ED 3J      0
7l / 7h  174 each
```

## Emulated state (xterm, 133x42)

- scrollback rows: **19,744** (total buffer 19,786)
- status-line rows in scrollback: **28**
- contiguous runs of adjacent identical status rows: **6** (20 rows inside runs, longest 5)
- frozen-timer values: at most 5 repeats per value

At the wrong geometry (120x32) the same file reports 20,346 / 202 / 65, which is
what an earlier revision of this file published. A status row still reaches native
scrollback 28 times where it should appear essentially never, so the defect stands
— but the magnitude was inflated ~7x by the replay size.

## Write rate (1 s buckets, from `capture.events.log`)

| second | bytes |
| --- | --- |
| 21:44:01 | 549,473 |
| 21:44:02 | **1,958,127** |
| 21:44:03 | 217,535 |
| 21:44:12 | 33,648 |
| 21:44:19 | 31,313 |
| 21:44:21 | 26,181 |

## Controls

- `omp render <same session> --repaint 3` replays cleanly — no systematic
  duplication, so the transcript pipeline is fine and the fault is in the live loop.
- An idle capture (fresh session, a few keystrokes, same environment) emulates to a
  clean screen with 0 duplicated rows and 19 scrollback rows.
- `omp render -t` on this session: `paint 418 ms` for a full frame against the
  renderer's 200 ms cadence.
- Engine log carries `ui.loop-blocked blockedMs=... cpuMs=...` with cpuMs > blockedMs,
  and `Transcript retirement pinned by unfinalized frontier block`.

## Scrubbing

Printable text is replaced with `x` at the same measured display width (measured by
running each text run through `@xterm/headless` itself, since a per-codepoint width
table gets grapheme clusters wrong). Escape sequences, control bytes and CR/LF are
verbatim.

**At the true 133x42, the scrubbed capture replays byte-for-byte identically to the
original: 19,744 scrollback rows, 19,786 total, 0-row deviation.** (The 3-row
deviation reported in an earlier revision was measured at 120x32 and does not exist
at the correct size.)
