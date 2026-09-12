# Measured results (original capture, before scrubbing)

Capture: 2,999,178 bytes, 397 writes, 2026-09-11T21:43:57Z -> 21:44:22Z (~26 s of
activity within a resumed session; 3.5 MiB / 1459 entries / 871 messages /
15,502 transcript rows at 120x32).

## Write rate (1 s buckets)

| second | bytes |
| --- | --- |
| 21:44:01 | 549,473 |
| 21:44:02 | **1,958,127** |
| 21:44:03 | 217,535 |
| 21:44:12 | 33,648 |
| 21:44:19 | 31,313 |
| 21:44:21 | 26,181 |

Average across the active window: ~117 KB/s.

## Escape-sequence census

```
CRLF   20546
CUU        0
CUP      319
EL     11317
ED 3J      0
7l / 7h  174 each
```

## Emulated state (xterm, 120x32)

- scrollback rows: **20,346**
- status-line rows in scrollback: **202**
- contiguous runs of adjacent identical status rows: **65** (133 rows inside runs, longest 3)
- frozen-timer histogram: 5s x30, 7s x25, 2s x23, 0s x22, 1s x21, 6s x18,
  3s x17, 9s x15, 10s x14, 8s x9, 4s x8

## Controls

- `omp render <same session> --repaint 3` replays cleanly — no systematic
  duplication, so the transcript pipeline is fine and the fault is in the live loop.
- An idle capture (fresh session, a few keystrokes, same environment) emulates to a
  clean 32-row screen with 0 duplicated rows and 19 scrollback rows.
- `omp render -t` on this session: `paint 418 ms` for a full frame against the
  renderer's 200 ms cadence.
- Engine log carries `ui.loop-blocked blockedMs=... cpuMs=...` with cpuMs > blockedMs,
  and `Transcript retirement pinned by unfinalized frontier block`.

## Scrub deviation

Replaying `capture-scrubbed.bin` yields 20,349 scrollback rows vs 20,346 for the
original (3 rows, 0.015%). Census identical; conclusions unaffected.
