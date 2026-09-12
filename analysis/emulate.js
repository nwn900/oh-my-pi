// Replay a captured PTY byte stream through a real terminal emulator and
// report the actual screen state + scrollback growth.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const file = process.argv[2];
const COLS = Number(process.argv[3] || 120);
const ROWS = Number(process.argv[4] || 32);
const data = fs.readFileSync(file);

const term = new Terminal({ cols: COLS, rows: ROWS, scrollback: 20000, allowProposedApi: true });

term.write(data, () => {
  const buf = term.buffer.active;
  console.log('=== TERMINAL EMULATION RESULT (real xterm state) ===');
  console.log('cols x rows      :', COLS + 'x' + ROWS);
  console.log('scrollback lines :', buf.baseY, '   <-- lines pushed off the top of the screen');
  console.log('total buffer rows:', buf.length);
  console.log('cursor           : x=' + buf.cursorX + ' y=' + buf.cursorY);

  // Collect all lines (scrollback + screen)
  const lines = [];
  for (let i = 0; i < buf.length; i++) {
    const l = buf.getLine(i);
    if (!l) continue;
    lines.push(l.translateToString(true).replace(/\s+$/, ''));
  }

  // Non-empty lines only
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  const groups = new Map();
  for (const l of nonEmpty) groups.set(l, (groups.get(l) || 0) + 1);
  const dupes = [...groups.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

  console.log('\nnon-empty buffer lines:', nonEmpty.length);
  console.log('distinct lines        :', groups.size);
  console.log('lines duplicated      :', dupes.reduce((a, [, n]) => a + n, 0));
  console.log('\n=== TOP DUPLICATED LINES IN SCROLLBACK+SCREEN ===');
  for (const [t, n] of dupes.slice(0, 15)) console.log(`  ${String(n).padStart(4)}x  ${t.slice(0, 130)}`);

  console.log('\n=== FINAL VISIBLE SCREEN (last ' + ROWS + ' rows) ===');
  const start = Math.max(0, buf.length - ROWS);
  for (let i = start; i < buf.length; i++) {
    const l = lines[i] || '';
    if (l.trim()) console.log('  ' + String(i - start).padStart(2) + '| ' + l.slice(0, 150));
  }
  process.exit(0);
});
