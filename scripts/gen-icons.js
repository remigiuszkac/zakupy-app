// Ikony aplikacji rysowane na canvas (koszyk z ptaszkiem) -> assets/ (Android/Expo) i web/icons/ (iPhone/PWA).
// Uruchom: node scripts/gen-icons.js   (wymaga pakietu playwright z przegladarka Chromium)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TLO = '#0f1311';

// rysunek w ukladzie 100 x 100 (srodek 50,50)
function rysuj(opt) {
  const { s, tlo, skala, mono } = opt;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  if (tlo) {
    const gr = g.createRadialGradient(s * 0.5, s * 0.38, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
    gr.addColorStop(0, '#1d3a2b');
    gr.addColorStop(1, '#0f1311');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }
  const k = (s * skala) / 72;                 // rysunek ma ~72 jednostki szerokosci
  g.translate(s / 2, s / 2);
  g.scale(k, k);
  g.translate(-50, -55);
  const ZIEL = mono ? '#ffffff' : '#4fd18b';
  const ZIEL2 = mono ? '#ffffff' : '#a3ecc4';
  const CIEMNY = mono ? '#ffffff' : '#2fa868';
  // raczka
  g.lineCap = 'round';
  g.strokeStyle = ZIEL2;
  g.lineWidth = 7;
  g.beginPath(); g.arc(50, 47, 21, Math.PI, 0); g.stroke();
  // kosz
  g.fillStyle = CIEMNY;
  g.beginPath();
  g.moveTo(19, 56); g.lineTo(81, 56); g.lineTo(74.5, 80);
  g.quadraticCurveTo(73.5, 84, 69.5, 84); g.lineTo(30.5, 84);
  g.quadraticCurveTo(26.5, 84, 25.5, 80); g.closePath(); g.fill();
  // brzeg
  g.fillStyle = ZIEL;
  g.beginPath();
  if (g.roundRect) g.roundRect(14, 44, 72, 12, 5); else g.rect(14, 44, 72, 12);
  g.fill();
  // ptaszek
  g.lineJoin = 'round';
  g.lineWidth = 6.5;
  if (mono) { g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; } else g.strokeStyle = '#0f1311';
  g.beginPath(); g.moveTo(38, 69); g.lineTo(46.5, 77); g.lineTo(62.5, 62); g.stroke();
  return c.toDataURL('image/png');
}

const PLIKI = [
  ['assets/icon.png', { s: 1024, tlo: true, skala: 0.62 }],
  ['assets/android-icon-foreground.png', { s: 1024, tlo: false, skala: 0.5 }],
  ['assets/android-icon-monochrome.png', { s: 1024, tlo: false, skala: 0.5, mono: true }],
  ['assets/splash-icon.png', { s: 1024, tlo: false, skala: 0.8 }],
  ['assets/favicon.png', { s: 48, tlo: true, skala: 0.8 }],
  ['web/icons/icon-192.png', { s: 192, tlo: true, skala: 0.62 }],
  ['web/icons/icon-512.png', { s: 512, tlo: true, skala: 0.62 }],
  ['web/icons/icon-maskable-512.png', { s: 512, tlo: true, skala: 0.52 }],
  ['web/icons/apple-touch-icon.png', { s: 180, tlo: true, skala: 0.62 }],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<html><body></body></html>');
  for (const [plik, opt] of PLIKI) {
    const url = await p.evaluate(rysuj, opt);
    const dst = path.join(ROOT, plik);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, Buffer.from(url.split(',')[1], 'base64'));
    console.log('ikona:', plik);
  }
  // tlo ikony adaptacyjnej Androida: jednolity kolor
  const tloUrl = await p.evaluate((kolor) => {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(512, 400, 50, 512, 512, 760);
    gr.addColorStop(0, '#1d3a2b'); gr.addColorStop(1, kolor);
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    return c.toDataURL('image/png');
  }, TLO);
  fs.writeFileSync(path.join(ROOT, 'assets/android-icon-background.png'), Buffer.from(tloUrl.split(',')[1], 'base64'));
  console.log('ikona: assets/android-icon-background.png');
  await b.close();
})();
