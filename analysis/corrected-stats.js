// Corrected statistics at the true capture geometry (133x42), vs the 120x32 I
// originally assumed.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const file = process.argv[2];
const data = fs.readFileSync(file);

const STATUS = /^\s*[<\s]*\d+s\s+DeepSeek\s/;

function run(cols, rows) {
  return new Promise((resolve) => {
    const term = new Terminal({ cols, rows, scrollback: 60000, allowProposedApi: true });
    term.write(data, () => {
      const b = term.buffer.active;
      const lines = [];
      for (let i = 0; i < b.length; i++) {
        const l = b.getLine(i);
        lines.push(l ? l.translateToString(true).replace(/\s+$/, '') : '');
      }
      const statusIdx = [];
      lines.forEach((l, i) => { if (STATUS.test(l)) statusIdx.push(i); });
      // contiguous runs
      const runs = [];
      let cur = statusIdx.length ? [statusIdx[0]] : [];
      for (let i = 1; i < statusIdx.length; i++) {
        if (statusIdx[i] === statusIdx[i - 1] + 1) cur.push(statusIdx[i]);
        else { runs.push(cur); cur = [statusIdx[i]]; }
      }
      if (cur.length) runs.push(cur);
      const multi = runs.filter((r) => r.length > 1);
      const elapsed = {};
      for (const i of statusIdx) {
        const m = lines[i].match(/(\d+)s\s+DeepSeek/);
        if (m) elapsed[m[1]] = (elapsed[m[1]] || 0) + 1;
      }
      resolve({
        scrollback: b.baseY,
        total: b.length,
        statusRows: statusIdx.length,
        multiRuns: multi.length,
        rowsInRuns: multi.reduce((a, r) => a + r.length, 0),
        longestRun: multi.length ? Math.max(...multi.map((r) => r.length)) : 0,
        elapsed,
      });
    });
  });
}

(async () => {
  for (const [c, r] of [[120, 32], [133, 42]]) {
    const s = await run(c, r);
    console.log(`\n=== replayed at ${c}x${r} ${c === 133 ? '(true capture geometry)' : '(my original assumption)'} ===`);
    console.log(`  scrollback rows                : ${s.scrollback}`);
    console.log(`  total buffer rows              : ${s.total}`);
    console.log(`  status-line rows in scrollback : ${s.statusRows}`);
    console.log(`  runs of adjacent identical     : ${s.multiRuns}`);
    console.log(`  rows inside those runs         : ${s.rowsInRuns}`);
    console.log(`  longest run                    : ${s.longestRun}`);
    const top = Object.entries(s.elapsed).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`  frozen-timer top values        : ${top.map(([k, v]) => `${k}s x${v}`).join(', ')}`);
  }
  process.exit(0);
})();
