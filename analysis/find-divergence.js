// Feed the original and scrubbed streams into two terminals in lockstep and
// report the first chunk where their state diverges, then show both byte regions.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const a = fs.readFileSync(process.argv[2]);
const b = fs.readFileSync(process.argv[3]);
const CHUNK = 2048;

function mk() {
  return new Terminal({ cols: 120, rows: 32, scrollback: 60000, allowProposedApi: true });
}

function feed(term, buf) {
  return new Promise((r) => term.write(buf, r));
}

function esc(s) {
  return s.replace(/[^\x20-\x7e]/g, (c) => {
    const h = c.charCodeAt(0).toString(16).padStart(2, '0');
    return `<${h}>`;
  });
}

(async () => {
  const ta = mk(), tb = mk();
  const n = Math.ceil(Math.max(a.length, b.length) / CHUNK);
  let prevA = { baseY: 0, rows: 0 };
  for (let i = 0; i < n; i++) {
    const offs = i * CHUNK;
    if (offs < a.length) await feed(ta, a.subarray(offs, offs + CHUNK));
    if (offs < b.length) await feed(tb, b.subarray(offs, offs + CHUNK));
    const sa = ta.buffer.active, sb = tb.buffer.active;
    if (sa.baseY !== sb.baseY || sa.length !== sb.length) {
      console.log(`DIVERGENCE at chunk ${i} (byte offset ${offs})`);
      console.log(`  original: baseY=${sa.baseY} rows=${sa.length}`);
      console.log(`  scrubbed: baseY=${sb.baseY} rows=${sb.length}`);
      const from = Math.max(0, offs - 400);
      console.log('\n=== original region ===');
      console.log(esc(a.subarray(from, offs + CHUNK).toString('latin1')));
      console.log('\n=== scrubbed region ===');
      console.log(esc(b.subarray(from, offs + CHUNK).toString('latin1')));
      process.exit(0);
    }
    prevA = { baseY: sa.baseY, rows: sa.length };
  }
  console.log('no divergence found; final state identical:', JSON.stringify(prevA));
  process.exit(0);
})();
