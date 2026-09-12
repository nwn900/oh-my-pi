// Focused analysis: is the status line appended into scrollback instead of
// being repainted in place? Contiguous runs of the same status line prove it.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const bin = process.argv[2];
const ev = process.argv[3];
const data = fs.readFileSync(bin);

// status line shape: "<elapsed>s  <model>  ... <ctx>%/1M ... $<cost>"
const STATUS = /^\s*[<\s]*\d+s\s+DeepSeek\s/;

const term = new Terminal({ cols: 120, rows: 32, scrollback: 60000, allowProposedApi: true });

term.write(data, () => {
  const buf = term.buffer.active;
  const lines = [];
  for (let i = 0; i < buf.length; i++) {
    const l = buf.getLine(i);
    lines.push(l ? l.translateToString(true).replace(/\s+$/, '') : '');
  }

  const statusIdx = [];
  lines.forEach((l, i) => { if (STATUS.test(l)) statusIdx.push(i); });

  console.log('total buffer rows      :', buf.length);
  console.log('scrollback rows        :', buf.baseY);
  console.log('status-line occurrences:', statusIdx.length);

  // Contiguous runs (adjacent rows both being status lines = appended, not repainted)
  const runs = [];
  let cur = [statusIdx[0]];
  for (let i = 1; i < statusIdx.length; i++) {
    if (statusIdx[i] === statusIdx[i - 1] + 1) cur.push(statusIdx[i]);
    else { runs.push(cur); cur = [statusIdx[i]]; }
  }
  if (cur.length) runs.push(cur);
  const multi = runs.filter(r => r.length > 1).sort((a, b) => b.length - a.length);
  console.log('contiguous runs of status lines:', runs.length);
  console.log('runs longer than 1 row          :', multi.length);
  console.log('longest run                     :', multi.length ? multi[0].length : 0, 'rows');
  console.log('rows inside multi-row runs      :', multi.reduce((a, r) => a + r.length, 0));

  console.log('\n=== LONGEST CONTIGUOUS RUN (raw rows) ===');
  const top = multi[0] || [];
  for (const i of top.slice(0, 14)) console.log(`  row ${i}: ${lines[i].slice(0, 130)}`);

  // Interleave check: distinct elapsed values among repeated status lines
  const elapsed = statusIdx.map(i => (lines[i].match(/(\d+)s\s+DeepSeek/) || [])[1]);
  const counts = {};
  for (const e of elapsed) counts[e] = (counts[e] || 0) + 1;
  console.log('\n=== status-line elapsed-value histogram (frozen timer = repeats) ===');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}x  "${k}s"`));

  // Where in the stream do they cluster? Use the event log timeline.
  const evLines = fs.readFileSync(ev, 'utf8').split('\n').filter(Boolean);
  const dataEv = evLines.map(l => l.split('\t')).filter(p => p[1] === 'data')
    .map(p => ({ t: Date.parse(p[0]), n: +p[2], cum: +p[3] }));
  console.log('\n=== WRITE-RATE TIMELINE (1s buckets, biggest bursts) ===');
  const buckets = new Map();
  for (const e of dataEv) {
    const b = Math.floor(e.t / 1000);
    buckets.set(b, (buckets.get(b) || 0) + e.n);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [b, n] of sorted) {
    console.log(`  ${new Date(b * 1000).toISOString().slice(11, 19)}  ${String(n).padStart(7)} bytes/s`);
  }
  const totalBytes = dataEv.reduce((a, e) => a + e.n, 0);
  const span = (dataEv[dataEv.length - 1].t - dataEv[0].t) / 1000;
  console.log(`\n  total ${totalBytes} bytes over ${Math.round(span)}s = ${Math.round(totalBytes / span)} B/s average`);
  process.exit(0);
});
