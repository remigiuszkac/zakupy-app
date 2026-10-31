// Pakuje web/index.html do src/appHtml.js (string), zeby aplikacja i aktualizacje EAS
// mialy zawsze aktualny interfejs. Uruchamiane przez `npm run gen` (tez przed start/update).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'web', 'index.html');
const dst = path.join(__dirname, '..', 'src', 'appHtml.js');
const html = fs.readFileSync(src, 'utf8');
if (!html.includes('/*__NATYWNE__*/')) {
  console.error('gen-html: brak znacznika /*__NATYWNE__*/ w web/index.html');
  process.exit(1);
}
const out =
  '// Wygenerowane przez scripts/gen-html.js z web/index.html - nie edytuj recznie.\n' +
  'export default ' + JSON.stringify(html) + ';\n';
const old = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
if (old !== out) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, out);
  console.log('gen-html: src/appHtml.js zaktualizowany (' + html.length + ' znakow)');
}
