// Replay a large rendered transcript through a real terminal emulator and
// measure whether rows are emitted more than once.
const fs = require('fs');
const { Terminal } = require('@xterm/headless');

const file = process.argv[2];
const COLS = Number(process.argv[3] || 120);
const ROWS = Number(process.argv[4] || 32);
const data = fs.readFileSync(file);
console.log('replaying', data.length, 'bytes through xterm', COLS + 'x' + ROWS, '...');

const term = new Terminal({ cols: COLS, rows: ROWS, scrollback: 60000, allowProposedApi: true });

term.write(data, () => {
  const buf = term.buffer.active;
  console.log('\n=== EMULATED RESULT ===');
  console.log('scrollback lines  :', buf.baseY);
  console.log('total buffer rows :', buf.length);

  const lines = [];
  for (let i = 0; i < buf.length; i++) {
    const l = buf.getLine(i);
    if (!l) { lines.push(''); continue; }
    lines.push(l.translateToString(true).replace(/\s+$/, ''));
  }
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  const groups = new Map();
  for (const l of nonEmpty) groups.set(l, (groups.get(l) || 0) + 1);

  // Only count "substantial" lines (a TUI legitimately repeats short filler/borders)
  const substantial = [...groups.entries()].filter(([t]) => t.trim().length >= 25);
  const dupes = substantial.filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

  console.log('non-empty lines   :', nonEmpty.length);
  console.log('distinct lines    :', groups.size);
  console.log('substantial (>=25 chars) distinct:', substantial.length);
  console.log('substantial duplicated lines     :', dupes.reduce((a, [, n]) => a + n, 0));

  console.log('\n=== TOP REPEATED SUBSTANTIAL LINES ===');
  if (!dupes.length) console.log('  (none - no repeated content)');
  for (const [t, n] of dupes.slice(0, 20)) console.log(`  ${String(n).padStart(4)}x  ${t.slice(0, 140)}`);

  // Search for a distinctive phrase from the user's screenshot
  const needle = 'Checking working tree and tests';
  const hits = nonEmpty.filter(l => l.includes(needle)).length;
  console.log(`\n"${needle}" appears in ${hits} buffer line(s)`);

  process.exit(0);
});
