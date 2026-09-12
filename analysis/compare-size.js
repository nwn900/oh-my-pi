const fs = require('fs');
const { Terminal } = require('@xterm/headless');
const [a, b, c, r] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
function repl(f) {
  return new Promise((res) => {
    const t = new Terminal({ cols: c, rows: r, scrollback: 60000, allowProposedApi: true });
    t.write(fs.readFileSync(f), () => res({ baseY: t.buffer.active.baseY, rows: t.buffer.active.length }));
  });
}
(async () => {
  const x = await repl(a), y = await repl(b);
  console.log(`geometry ${c}x${r}`);
  console.log(`  original: scrollback=${x.baseY} total=${x.rows}`);
  console.log(`  scrubbed: scrollback=${y.baseY} total=${y.rows}`);
  console.log(`  deviation: ${y.baseY - x.baseY} rows`);
  process.exit(0);
})();
