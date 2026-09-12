// Infer the real terminal geometry from the capture itself, then replay at that
// size to get correct numbers. The engine addresses absolute rows/columns, so the
// stream records the true dimensions even though the proxy never logged them.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const file = process.argv[2];
const widths = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const txt = fs.readFileSync(file).toString('latin1');

// --- absolute cursor addressing bounds -------------------------------------
const cup = [...txt.matchAll(/\x1b\[(\d+);(\d+)H/g)].map((m) => [+m[1], +m[2]]);
const vpa = [...txt.matchAll(/\x1b\[(\d+)d/g)].map((m) => +m[1]);
const rows = cup.map((c) => c[0]).concat(vpa);
const cols = cup.map((c) => c[1]);
console.log('absolute positioning:');
console.log('  CUP/VPA count     :', cup.length + vpa.length);
console.log('  max row addressed :', Math.max(...rows));
console.log('  max col addressed :', Math.max(...cols));
const rowHist = {};
for (const r of rows) rowHist[r] = (rowHist[r] || 0) + 1;
const topRows = Object.entries(rowHist).sort((a, b) => +b[0] - +a[0]).slice(0, 6);
console.log('  highest rows used :', topRows.map(([r, n]) => `${r}x${n}`).join(' '));

// --- physical line widths ---------------------------------------------------
function strip(s) {
  return s
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?<>=$]*[a-zA-Z@]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '');
}
function width(s) {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    w += cp < 0x7f ? 1 : (widths[cp] === undefined ? 1 : widths[cp]);
  }
  return w;
}
const lineWidths = txt.split('\n').map((l) => width(strip(l)));
const hist = {};
for (const w of lineWidths) hist[w] = (hist[w] || 0) + 1;
const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\nphysical line widths (display columns):');
for (const [w, n] of top) console.log(`  ${String(w).padStart(4)} cols  x${n}`);
console.log('  max width seen:', Math.max(...lineWidths));

// --- replay at candidate sizes ---------------------------------------------
function replay(colsN, rowsN) {
  return new Promise((resolve) => {
    const data = fs.readFileSync(file);
    const term = new Terminal({ cols: colsN, rows: rowsN, scrollback: 60000, allowProposedApi: true });
    term.write(data, () => {
      const b = term.buffer.active;
      resolve({ baseY: b.baseY, rows: b.length });
    });
  });
}

(async () => {
  console.log('\nreplay at candidate geometries:');
  for (const [c, r] of [[120, 32], [120, 40], [120, 44], [150, 44], [160, 48], [180, 50]]) {
    const s = await replay(c, r);
    console.log(`  ${c}x${r}: scrollback=${s.baseY} total=${s.rows}`);
  }
})();
