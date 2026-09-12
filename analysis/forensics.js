// Forensics for issue #9783: what escape sequences cause the status line to
// land in scrollback instead of being repainted in place?
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2]).toString('binary');

// Pull out the status-line text as it appears in the raw stream (after stripping SGR).
// The status row is identifiable by the elapsed-time + model pattern.
function visible(s) {
  return s.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?<>=$]*[a-zA-Z@]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

// Find every position where a status-line-looking string starts
const re = /(\d+)s\s+DeepSeek\s/g;
let m, hits = [];
while ((m = re.exec(raw)) !== null) hits.push(m.index);
console.log('status-line occurrences in raw stream:', hits.length);

// Scroll-inducing primitives
const census = {
  'LF (\\n)': (raw.match(/\n/g) || []).length,
  'CR (\\r)': (raw.match(/\r/g) || []).length,
  'CRLF': (raw.match(/\r\n/g) || []).length,
  'bare LF (not CRLF)': (raw.match(/(?<!\r)\n/g) || []).length,
  'CUP ESC[r;cH': (raw.match(/\x1b\[\d+;\d+H/g) || []).length,
  'CHA ESC[nG': (raw.match(/\x1b\[\d+G/g) || []).length,
  'CUU ESC[nA': (raw.match(/\x1b\[\d*A/g) || []).length,
  'ED  ESC[J': (raw.match(/\x1b\[J/g) || []).length,
  'EL  ESC[K': (raw.match(/\x1b\[K/g) || []).length,
  'ESC[?7l (autowrap off)': (raw.match(/\x1b\[\?7l/g) || []).length,
  'ESC[?7h (autowrap on)': (raw.match(/\x1b\[\?7h/g) || []).length,
  'DSR reply ESC[..R': (raw.match(/\x1b\[\d+;\d+R/g) || []).length,
};
console.log('\n=== control-sequence census (raw engine output) ===');
for (const [k, v] of Object.entries(census)) console.log(`  ${String(v).padStart(7)}  ${k}`);

// Show the raw bytes immediately BEFORE a few status-line writes: that is the
// sequence that decides whether it repaints in place or scrolls.
console.log('\n=== bytes preceding status-line writes (first 5) ===');
for (const h of hits.slice(0, 5)) {
  const start = Math.max(0, h - 220);
  const seg = raw.slice(start, h + 40);
  console.log('---- offset ' + h + ' ----');
  console.log(JSON.stringify(seg).replace(/\\u001b/g, '\\x1b'));
}

// Are there runs where consecutive status writes are NOT preceded by a CUP?
let scrollSuspects = 0;
for (const h of hits) {
  const back = raw.slice(Math.max(0, h - 60), h);
  const lastCup = back.lastIndexOf('\x1b[');
  const hasCup = /\x1b\[\d+;\d+H/.test(back);
  if (!hasCup) scrollSuspects++;
}
console.log('\nstatus writes NOT preceded by cursor positioning within 60 bytes:', scrollSuspects, '/', hits.length);
