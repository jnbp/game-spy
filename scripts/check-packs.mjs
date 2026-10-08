// Prüft alle Ortspakete: Format, Rollen, Dubletten (auch paketübergreifend).
// Aufruf:  node scripts/check-packs.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packs = [];
const ctx = { Spy: { pack: (p) => packs.push(p) }, window: {} };
ctx.window.Spy = ctx.Spy;
vm.createContext(ctx);

vm.runInContext(readFileSync(join(root, 'packs/_list.js'), 'utf8'), ctx);
const list = ctx.window.SPY_PACKS || ctx.SPY_PACKS;
for (const id of list) {
  vm.runInContext(readFileSync(join(root, `packs/${id}.js`), 'utf8'), ctx, { filename: `${id}.js` });
}
vm.runInContext(readFileSync(join(root, 'js/parse.js'), 'utf8'), ctx);
const parse = ctx.window.SpyParse || ctx.SpyParse;

let errors = 0;
const seen = new Map();
let total = 0;
for (const p of packs) {
  const { places, problems } = parse(p.places);
  problems.forEach((m) => { console.log(`✗ ${p.id}: ${m}`); errors++; });
  for (const pl of places) {
    total++;
    const key = pl.name.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
    if (seen.has(key)) { console.log(`✗ Dublette: "${pl.name}" in ${p.id} und ${seen.get(key)}`); errors++; }
    else seen.set(key, p.id);
    if (!pl.emoji) { console.log(`✗ ${p.id}: "${pl.name}" ohne Emoji`); errors++; }
    if (pl.roles.length < 3) { console.log(`✗ ${p.id}: "${pl.name}" hat nur ${pl.roles.length} Rollen`); errors++; }
  }
  console.log(`  ${p.icon} ${p.name.padEnd(24)} ${places.length} Orte`);
}
console.log(`\n${packs.length} Pakete, ${total} Orte, ${errors} Probleme`);
process.exit(errors ? 1 : 0);
