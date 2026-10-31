// Testy interfejsu w Playwright: ekran telefonu, atrapa mostu ReactNativeWebView (jak w aplikacji na Androida)
// oraz tryb przegladarki (iPhone / PWA, dane w localStorage).
// Uruchom: node tests/ui.test.js   (zrzuty ekranu: ZRZUTY=katalog node tests/ui.test.js)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const ADRES = 'https://zakupy.app.local/';
const ZRZUTY = process.env.ZRZUTY || '';
const TELEFON = { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, locale: 'pl-PL' };

let ok = 0;
async function test(nazwa, fn) {
  try { await fn(); ok++; console.log('  ✓ ' + nazwa); }
  catch (e) { console.error('  ✗ ' + nazwa + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}

async function otworzNat(ctx, store = {}) {
  const page = await ctx.newPage();
  const bledy = [];
  page.on('pageerror', (e) => bledy.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) bledy.push(m.text()); });
  await page.addInitScript(() => {
    window.__msgs = [];
    window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) };
  });
  const html = HTML.replace('/*__NATYWNE__*/', () => 'window.__STORE=' + JSON.stringify(store) + ';window.__APP={"natywna":"1.0.0","update":null};');
  await page.route('**/*', (r) => (r.request().url() === ADRES ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : r.fulfill({ status: 404, body: '' })));
  await page.goto(ADRES);
  return { page, bledy };
}
const msgs = (page) => page.evaluate(() => window.__msgs);
const zapisane = async (page) => (await msgs(page)).filter((m) => m.t === 'zapisz').reduce((o, m) => ((o[m.k] = m.v), o), {});
const zrzut = async (page, n) => { if (ZRZUTY) { fs.mkdirSync(ZRZUTY, { recursive: true }); await page.screenshot({ path: path.join(ZRZUTY, n + '.png') }); } };
async function dodajWpis(page, t) { await page.fill('#wpis', t); await page.press('#wpis', 'Enter'); }
const wiersz = (page, n) => page.locator('#lista .it', { has: page.locator('.nm b', { hasText: new RegExp('^' + n + '$') }) });
// grupy: [[dzial, [produkty]]...] tylko do kupienia
const grupy = (page) => page.evaluate(() => {
  const out = []; let g = null;
  for (const el of document.querySelectorAll('#lista > *')) {
    if (el.matches('h3.dz')) { if (el.classList.contains('kup')) break; g = [el.childNodes[0].textContent.trim(), []]; out.push(g); }
    else if (el.matches('.it') && g) g[1].push(el.querySelector('.nm b').textContent);
  }
  return out;
});

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(TELEFON);

  console.log('Aplikacja (most ReactNativeWebView):');
  const { page, bledy } = await otworzNat(ctx);

  await test('start: trzy listy, Dom aktywny, pusta lista', async () => {
    const tabs = await page.locator('.tab').allTextContents();
    assert.deepStrictEqual(tabs.map((t) => t.replace(/\d+$/, '').trim()), ['🏠 Dom', '🔧 Warsztat', '🔥 Wędzarnia']);
    assert.ok(await page.evaluate(() => { const t = document.querySelector('#tabs'); return t.scrollWidth <= t.clientWidth + 2; }), 'zakladki mieszcza sie na ekranie');
    assert.ok(await page.locator('.tab.act .tn').isVisible(), 'aktywna lista z nazwa');
    assert.match(await page.locator('.tab.act').textContent(), /Dom/);
    assert.match(await page.locator('.pusta').textContent(), /Lista jest pusta/);
    await zrzut(page, '01-pusta');
  });

  await test('słownik działów (Dom, Warsztat, Wędzarnia)', async () => {
    const r = await page.evaluate(() => {
      const d = nowaLista('dom'), w = nowaLista('warsztat'), z = nowaLista('wedzarnia');
      const n = (l, x) => l.dz.find((q) => q.id === zgadnijDzial(l, x)).n;
      return {
        dom: ['ziemniaki', 'mleko', 'Masło', 'chleb', 'jajka', 'sok pomarańczowy', 'ogórki', 'ogórki kiszone', 'płyn do naczyń', 'płyn do płukania ust', 'pasta do zębów', 'pierś z kurczaka', 'łosoś', 'bułka tarta', 'krem czekoladowy', 'papier toaletowy', 'kawa', 'ser żółty', 'serwetki', 'sos pomidorowy', 'udka', 'ryż', 'cukier', 'piwo', 'winogrona', 'coś dziwnego'].map((x) => [x, n(d, x)]),
        warsztat: ['śruby M6', 'kabel 3x1,5', 'taśma led', 'klej do drewna', 'olej do drewna', 'papier ścierny 120', 'sklejka 3 mm', 'ESP32', 'wiertło 6', 'rękawice'].map((x) => [x, n(w, x)]),
        wedzarnia: ['peklosól', 'zrębki olchowe', 'boczek', 'ser capri', 'jałowiec', 'osłonki', 'termometr'].map((x) => [x, n(z, x)]),
      };
    });
    const oczek = {
      dom: ['Warzywa i owoce', 'Nabiał i jajka', 'Nabiał i jajka', 'Pieczywo', 'Nabiał i jajka', 'Napoje', 'Warzywa i owoce', 'Konserwy i słoiki', 'Chemia', 'Kosmetyki i higiena', 'Kosmetyki i higiena', 'Mięso i wędliny', 'Ryby', 'Sypkie i makarony', 'Słodycze i przekąski', 'Chemia', 'Kawa i herbata', 'Nabiał i jajka', 'Chemia', 'Przyprawy i sosy', 'Mięso i wędliny', 'Sypkie i makarony', 'Sypkie i makarony', 'Napoje', 'Warzywa i owoce', 'Inne'],
      warsztat: ['Śruby i łączniki', 'Elektryka', 'Elektryka', 'Kleje i chemia', 'Farby i lakiery', 'Materiały ścierne', 'Drewno i sklejka', 'Elektronika', 'Narzędzia', 'BHP'],
      wedzarnia: ['Sól i peklosól', 'Zrębki i drewno', 'Mięso', 'Sery', 'Przyprawy', 'Osłonki i sznurki', 'Akcesoria'],
    };
    for (const k of Object.keys(oczek)) assert.deepStrictEqual(r[k].map((x) => x[1]), oczek[k], k + ': ' + JSON.stringify(r[k]));
  });

  await test('rozpoznawanie ilości, jednostek, cen i notatek', async () => {
    const r = await page.evaluate(() => ['2 kg ziemniaki', 'mleko 2 l', '2x chleb', 'mleko x2', 'masło 200g', 'jajka 10 szt (wiejskie)', 'mleko 3,2%', 'cola 0,5l 6 szt', '1,5 kg schab', 'chleb 4,50 zł', 'sok 2 l – 9,98 zł', '30 dag sera', 'śruby M6 20 szt', 'taśma led 5 m', '7days croissant']
      .map((t) => { const p = parsuj(t); return [p.n, p.q, p.j, p.c == null ? null : Math.round(p.c * 100) / 100, p.nt]; }));
    assert.deepStrictEqual(r, [
      ['ziemniaki', 2, 'kg', null, ''], ['mleko', 2, 'l', null, ''], ['chleb', 2, 'szt', null, ''], ['mleko', 2, 'szt', null, ''],
      ['masło', 200, 'g', null, ''], ['jajka', 10, 'szt', null, 'wiejskie'], ['mleko 3,2%', 1, 'szt', null, ''], ['cola 0,5l', 6, 'szt', null, ''],
      ['schab', 1.5, 'kg', null, ''], ['chleb', 1, 'szt', 4.5, ''], ['sok', 2, 'l', 4.99, ''], ['sera', 300, 'g', null, ''],
      ['śruby M6', 20, 'szt', null, ''], ['taśma led', 5, 'm', null, ''], ['7days croissant', 1, 'szt', null, ''],
    ]);
  });

  await test('dodawanie z pola: produkty trafiają do działów w kolejności sklepu', async () => {
    for (const t of ['mleko 2 l', '2 kg ziemniaki', 'chleb', 'płyn do naczyń', 'jajka 10']) await dodajWpis(page, t);
    assert.deepStrictEqual(await grupy(page), [
      ['Warzywa i owoce', ['ziemniaki']], ['Pieczywo', ['chleb']], ['Nabiał i jajka', ['mleko', 'jajka']], ['Chemia', ['płyn do naczyń']],
    ]);
    assert.match(await wiersz(page, 'ziemniaki').locator('small').textContent(), /2 kg/);
    assert.match(await page.locator('.tab.act').textContent(), /5$/);
    assert.match(await page.locator('#sum').textContent(), /Do kupienia 5/);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'wpis', 'pole zostaje aktywne do kolejnego wpisu');
  });

  await test('ten sam produkt drugi raz: „Już na liście”', async () => {
    await dodajWpis(page, 'Chleb');
    assert.match(await page.locator('#toast').textContent(), /Już na liście/);
    assert.strictEqual(await page.locator('#lista .it').count(), 5);
    await page.evaluate(() => document.activeElement.blur());
  });

  await test('odhaczanie stuknięciem i powrót', async () => {
    await wiersz(page, 'mleko').click();
    assert.strictEqual(await page.locator('#lista .it.k').count(), 1);
    assert.match(await page.locator('#hKup').textContent(), /Kupione 1/);
    assert.match(await page.locator('#bWycz').textContent(), /Wyczyść kupione \(1\)/);
    await zrzut(page, '02-lista');
    await wiersz(page, 'jajka').click();
    await wiersz(page, 'jajka').click();     // pomylka - wraca na liste
    assert.strictEqual(await page.locator('#lista .it.k').count(), 1);
  });

  await test('edycja: cena i suma', async () => {
    await wiersz(page, 'ziemniaki').locator('.ed').click();
    await page.waitForSelector('#sheet.show #eC');
    assert.match(await page.locator('#eCl').textContent(), /za 1 kg/);
    await page.fill('#eC', '3,50');
    assert.match(await page.locator('#eR').textContent(), /7,00 zł/);
    await page.click('[data-pm="1"]');
    assert.strictEqual(await page.inputValue('#eQ'), '2,5');
    await page.click('[data-pm="-1"]');
    await page.fill('#eT', 'młode');
    await zrzut(page, '03-edycja');
    await page.click('#eOk');
    assert.match(await wiersz(page, 'ziemniaki').textContent(), /7,00 zł/);
    assert.match(await wiersz(page, 'ziemniaki').locator('small').textContent(), /2 kg · młode/);
    assert.match(await page.locator('#sum').textContent(), /ok\. 7,00 zł/);
  });

  await test('przytrzymanie wiersza otwiera edycję (bez odhaczania)', async () => {
    const b = await wiersz(page, 'chleb').boundingBox();
    await page.mouse.move(b.x + 120, b.y + b.height / 2);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    assert.ok(await page.locator('#sheet.show #eN').isVisible());
    assert.strictEqual(await wiersz(page, 'chleb').evaluate((e) => e.classList.contains('k')), false);
    await page.click('#sheet .x');
  });

  await test('zmiana działu w edycji jest zapamiętana na przyszłość', async () => {
    await wiersz(page, 'płyn do naczyń').locator('.ed').click();
    await page.click('#eD [data-d="inne"]');
    await page.click('#eOk');
    assert.ok((await grupy(page)).some(([d, p]) => d === 'Inne' && p.includes('płyn do naczyń')));
    assert.strictEqual(await page.evaluate(() => L().dz.find((d) => d.id === zgadnijDzial(L(), 'Płyn do naczyń')).n), 'Inne');
  });

  await test('wyczyść kupione + cofnij', async () => {
    await page.click('#bWycz');
    assert.strictEqual(await page.locator('#lista .it.k').count(), 0);
    assert.match(await page.locator('#toast').textContent(), /Usunięto kupione: 1/);
    await page.click('#toast button');
    assert.strictEqual(await page.locator('#lista .it.k').count(), 1);
    await page.click('#bWycz');
    assert.strictEqual(await page.locator('#lista .it.k').count(), 0);
  });

  await test('podpowiedzi: często kupowane i wyszukiwanie z historii', async () => {
    await page.focus('#wpis');
    assert.ok(await page.locator('#sug.show').isVisible());
    assert.match(await page.locator('#sug').textContent(), /Często kupowane/);
    assert.match(await page.locator('#sug').textContent(), /mleko\s*2 l/);
    await zrzut(page, '04-podpowiedzi');
    await page.fill('#wpis', '3 ml');
    const chip = page.locator('#sug [data-h="mleko"]');
    assert.ok(await chip.isVisible());
    await chip.click();
    assert.match(await wiersz(page, 'mleko').locator('small').textContent(), /3 l/);
    assert.strictEqual(await page.inputValue('#wpis'), '');
    await page.evaluate(() => document.activeElement.blur());
  });

  await test('wklejanie listy z SMS-a (nagłówki działów, przecinki, ilości, ceny)', async () => {
    await page.click('#bMenu');
    await page.click('[data-m="wklej"]');
    await page.fill('#wTx', '🛒 Dom – lista zakupów\n\nPieczywo:\n• bułki 6\n\n- masło\n1. jajka 10 szt (wiejskie)\ncukier, kawa, sok pomarańczowy 2 l – 9,98 zł');
    assert.match(await page.locator('#wOk').textContent(), /Dodaj 6 produktów/);
    await zrzut(page, '05-wklej');
    await page.click('#wOk');
    assert.match(await page.locator('#toast').textContent(), /Dodano 5 produktów \(1 już było\)/);
    const g = Object.fromEntries(await grupy(page));
    assert.ok(g['Pieczywo'].includes('bułki'));
    assert.ok(g['Nabiał i jajka'].includes('masło'));
    assert.ok(g['Napoje'].includes('sok pomarańczowy'));
    assert.ok(g['Kawa i herbata'].includes('kawa'));
    assert.ok(g['Sypkie i makarony'].includes('cukier'));
    assert.match(await wiersz(page, 'jajka').locator('small').textContent(), /10 szt · wiejskie/);
    assert.match(await wiersz(page, 'sok pomarańczowy').textContent(), /9,98 zł/);
  });

  await test('schowek z Androida w okienku wklejania', async () => {
    await page.click('#bMenu');
    await page.click('[data-m="wklej"]');
    await page.click('#wSch');
    assert.ok((await msgs(page)).some((m) => m.t === 'schowek'));
    await page.evaluate(() => window.__schowek('ser\nszynka 20 dag'));
    assert.strictEqual(await page.inputValue('#wTx'), 'ser\nszynka 20 dag');
    assert.match(await page.locator('#wOk').textContent(), /Dodaj 2 produkty/);
    await page.click('#sheet .x');
  });

  await test('wysyłanie: WhatsApp / SMS / inne / kopiuj, z cenami', async () => {
    await page.click('#bUdo');
    await page.check('#shC');
    const podg = await page.locator('#shP').textContent();
    assert.match(podg, /^🏠 Dom – lista zakupów/);
    assert.match(podg, /Warzywa i owoce:\n• ziemniaki 2 kg \(młode\) – 7,00 zł/);
    assert.match(podg, /Razem ok\. /);
    await zrzut(page, '06-wyslij');
    for (const cel of ['whatsapp', 'sms', 'system', 'kopiuj']) await page.click(`[data-u="${cel}"]`);
    const m = (await msgs(page)).filter((x) => x.t === 'udostepnij' || x.t === 'kopiuj');
    assert.deepStrictEqual(m.map((x) => x.cel || 'kopiuj'), ['whatsapp', 'sms', 'system', 'kopiuj']);
    assert.ok(m.every((x) => x.tekst === podg));
    await page.click('#sheet .x');
  });

  await test('wysłana lista wczytuje się z powrotem 1:1', async () => {
    const r = await page.evaluate(() => {
      const l = L(), t = tekstListy(l, true);
      const ps = parsujTekst(l, t);
      const nie = l.poz.filter((p) => !p.k);
      return { ps: ps.map((p) => [p.n, p.q, p.j, p.d, p.c == null ? null : Math.round(p.c * 100)]), lista: l.dz.flatMap((d) => nie.filter((p) => p.d === d.id)).map((p) => [p.n, p.q, p.j, p.d, p.c == null ? null : Math.round(p.c * 100)]) };
    });
    assert.deepStrictEqual(r.ps, r.lista);
  });

  await test('dane zapisywane przez most i odczytywane po ponownym uruchomieniu', async () => {
    const s = await zapisane(page);
    assert.ok(Array.isArray(s.listy) && s.akt);
    const { page: p2, bledy: b2 } = await otworzNat(ctx, s);
    assert.deepStrictEqual(await grupy(p2), await grupy(page));
    assert.match(await p2.locator('#sum').textContent(), new RegExp((await page.locator('#sum span').textContent()).replace(/[.()]/g, '\\$&')));
    assert.deepStrictEqual(b2, []);
    await p2.close();
  });

  await test('druga lista (Warsztat) ma własne działy i historię', async () => {
    await page.click('.tab:has-text("Warsztat")');
    assert.match(await page.locator('.pusta').textContent(), /Lista jest pusta/);
    for (const t of ['śruby M6 20 szt', 'taśma led 5 m', 'klej do drewna']) await dodajWpis(page, t);
    await page.evaluate(() => document.activeElement.blur());
    assert.deepStrictEqual(await grupy(page), [['Śruby i łączniki', ['śruby M6']], ['Elektryka', ['taśma led']], ['Kleje i chemia', ['klej do drewna']]]);
    await page.focus('#wpis');
    assert.strictEqual(await page.locator('#sug [data-h="mleko"]').count(), 0);
    await page.evaluate(() => document.activeElement.blur());
  });

  await test('działy: zmiana kolejności, nazwy, dodanie i usunięcie', async () => {
    await page.click('#bMenu'); await page.click('[data-m="dzialy"]');
    await page.click('#dzL [data-up="1"]');                       // Elektryka nad Śruby
    await page.fill('#dzL [data-ren] >> nth=0', 'Elektryka i kable');
    await page.locator('#dzL [data-ren] >> nth=0').dispatchEvent('change');
    await page.fill('#dzN', 'Laser'); await page.click('#dzAdd button');
    await zrzut(page, '07-dzialy');
    const kl = await page.evaluate(() => L().dz.find((d) => d.n === 'Kleje i chemia').id);
    await page.click(`#dzL [data-del="${kl}"]`);
    await page.click('#sheet .x');
    assert.deepStrictEqual(await grupy(page), [['Elektryka i kable', ['taśma led']], ['Śruby i łączniki', ['śruby M6']], ['Inne', ['klej do drewna']]]);
    assert.ok(await page.evaluate(() => L().dz.some((d) => d.n === 'Laser')));
  });

  await test('listy: nowa z wzoru, zmiana nazwy, usunięcie (dwa stuknięcia) i cofnij', async () => {
    await page.click('#bMenu'); await page.click('[data-m="listy"]');
    await page.click('#lsW [data-w="pusta"]');
    await page.fill('#lsN', 'Działka'); await page.click('#lsAdd button');
    assert.match(await page.locator('.tab.act').textContent(), /Działka/);
    assert.strictEqual(await page.locator('#tabs.kompakt').count(), 1, 'cztery listy: nieaktywne tylko z ikonka');
    await page.click('#bMenu'); await page.click('[data-m="listy"]');
    await zrzut(page, '08-listy');
    const id = await page.evaluate(() => L().id);
    await page.click(`#lsL [data-del="${id}"]`);
    assert.match(await page.locator(`#lsL [data-del="${id}"]`).textContent(), /Usunąć\?/);
    await page.click(`#lsL [data-del="${id}"]`);
    await page.click('#sheet .x');
    assert.strictEqual(await page.locator('.tab').count(), 3);
    await page.click('#toast button');
    assert.strictEqual(await page.locator('.tab').count(), 4);
    await page.evaluate(() => { listy = listy.filter((l) => l.n !== 'Działka'); akt = listy[0].id; zapisz(); render(); });
  });

  await test('kopia danych: wysłanie i wczytanie na „drugim telefonie”', async () => {
    await page.click('#bMenu'); await page.click('[data-m="kopia"]');
    await page.click('#kKop');
    const kop = (await msgs(page)).filter((m) => m.t === 'kopiuj').pop().tekst;
    assert.match(kop, /^\{"zakupy":1/);
    await page.click('#sheet .x');
    const { page: p2 } = await otworzNat(ctx, {});
    await p2.click('#bMenu'); await p2.click('[data-m="kopia"]');
    await p2.fill('#kTx', kop);
    await p2.click('#kOk');
    assert.match(await p2.locator('#kOk').textContent(), /Na pewno/);
    await p2.click('#kOk');
    assert.deepStrictEqual(await grupy(p2), await grupy(page));
    assert.strictEqual(await p2.locator('.tab').count(), 3);
    await p2.close();
  });

  await test('Wstecz: zamyka okno, chowa klawiaturę, potem wychodzi', async () => {
    await page.click('#bMenu');
    await page.evaluate(() => window.__wstecz());
    assert.strictEqual(await page.locator('#sheet.show').count(), 0);
    await page.focus('#wpis');
    await page.evaluate(() => window.__wstecz());
    assert.notStrictEqual(await page.evaluate(() => document.activeElement.id), 'wpis');
    await page.evaluate(() => window.__wstecz());
    assert.strictEqual((await msgs(page)).pop().t, 'wyjdz');
  });

  await test('O aplikacji: wersja i „Sprawdź aktualizacje”', async () => {
    await page.click('#bMenu'); await page.click('[data-m="info"]');
    assert.match(await page.locator('#sheetBox h2').textContent(), /Zakupy v\d+\.\d+\.\d+/);
    await page.click('#iAkt');
    assert.strictEqual((await msgs(page)).pop().t, 'aktualizuj');
    await page.evaluate(() => window.__aktualizacja('aktualna'));
    assert.match(await page.locator('#toast').textContent(), /najnowszą wersję/);
    await page.click('#sheet .x');
  });

  await test('układ: nic nie wystaje poza ekran, przyciski min. 44 px', async () => {
    const r = await page.evaluate(() => ({
      w: document.scrollingElement.scrollWidth,
      male: [...document.querySelectorAll('#lista .it, .tab, .ib, .plus, #wpis')].filter((e) => e.getBoundingClientRect().height < 44).length,
    }));
    assert.ok(r.w <= 393, 'szerokosc ' + r.w);
    assert.strictEqual(r.male, 0);
  });

  await test('brak błędów JavaScript', async () => { assert.deepStrictEqual(bledy, []); });

  // ---------- tryb przegladarki (iPhone / PWA) ----------
  console.log('Przeglądarka / iPhone (PWA):');
  const ctx2 = await browser.newContext({ ...TELEFON, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx2.route('https://wa.me/**', (r) => r.fulfill({ contentType: 'text/html', body: 'wa' }));
  await ctx2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost' });
  const p3 = await ctx2.newPage();
  const b3 = [];
  p3.on('pageerror', (e) => b3.push(e.message));
  await p3.route('http://localhost/**', (r) => (r.request().url().endsWith('/') ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: HTML }) : r.fulfill({ status: 404, body: '' })));
  await p3.goto('http://localhost/');

  await test('podpowiedź instalacji na iPhonie', async () => {
    assert.match(await p3.locator('.ios').textContent(), /Do ekranu początkowego/);
    await zrzut(p3, '09-iphone');
    await p3.click('.ios button');
    assert.strictEqual(await p3.locator('.ios').count(), 0);
  });

  await test('dane w localStorage przetrwają ponowne otwarcie', async () => {
    await dodajWpis(p3, '2 kg ziemniaki');
    await dodajWpis(p3, 'mleko');
    await p3.reload();
    assert.deepStrictEqual(await grupy(p3), [['Warzywa i owoce', ['ziemniaki']], ['Nabiał i jajka', ['mleko']]]);
    assert.strictEqual(await p3.locator('.ios').count(), 0);
  });

  await test('WhatsApp i kopiowanie bez aplikacji', async () => {
    await p3.click('#bUdo');
    const [okno] = await Promise.all([ctx2.waitForEvent('page'), p3.click('[data-u="whatsapp"]')]);
    assert.match(okno.url(), /wa\.me\/\?text=.*ziemniaki/);
    await okno.close();
    await p3.click('[data-u="kopiuj"]');
    assert.match(await p3.evaluate(() => navigator.clipboard.readText()), /• ziemniaki 2 kg/);
  });

  await test('aktualizacje wyłączone poza GitHub Pages (bez błędów)', async () => {
    await p3.click('#sheet .x');
    await p3.click('#bMenu'); await p3.click('[data-m="info"]'); await p3.click('#iAkt');
    assert.match(await p3.locator('#toast').textContent(), /zainstalowanej aplikacji/);
    assert.deepStrictEqual(b3, []);
  });

  await browser.close();
  console.log(process.exitCode ? '\nSĄ BŁĘDY' : `\nWszystkie testy OK (${ok})`);
})();
