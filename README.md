# Zakupy – lista zakupów na Androida i iPhone'a

Prosta aplikacja do zakupów, obsługiwana jedną ręką w sklepie. Ciemny motyw, duże przyciski, wszystko po polsku.

- **Kilka list** (Dom, Warsztat, Wędzarnia + własne), każda z **własnymi działami** w kolejności, w jakiej chodzisz po sklepie
- **Dodawanie jednym wpisem**: „2 kg ziemniaki”, „mleko 2 l”, „2x chleb”, „jajka 10 szt (wiejskie)”, „chleb 4,50 zł”
- Produkt sam trafia do działu (słownik + zapamiętane Twoje poprawki), **ilość, jednostka, cena, notatka**
- **Podpowiedzi** często kupowanych z historii danej listy – jedno stuknięcie i jest na liście
- **Odhaczanie** stuknięciem w wiersz, **Wyczyść kupione** (z „Cofnij”), suma do zapłaty
- **Wysyłanie** listy WhatsAppem, SMS-em lub do dowolnej aplikacji; **wklejanie** listy z SMS-a / WhatsAppa (rozpozna działy, ilości i ceny)
- **Kopia danych** – przeniesienie list na inny telefon (np. z Androida na iPhone'a)
- Dane tylko w telefonie, **działa bez internetu**, nowe wersje przychodzą same

## Instalacja

**Android**: plik APK z Expo (link w zakładce *Actions → Android - build APK* albo na expo.dev → projekt *zakupy* → Builds).
Otwórz go na telefonie i zainstaluj (zezwól na instalację z tego źródła; przy Play Protect: *Zainstaluj mimo to*).

**iPhone**: w Safari otwórz **https://remigiuszkac.github.io/zakupy-app/** → *Udostępnij* → *Do ekranu początkowego*.
Ikona Zakupy działa jak aplikacja: bez internetu, z własnymi danymi, aktualizuje się sama.
(Dane w aplikacji z ekranu początkowego są osobne od tych w samym Safari.)

## Jak to jest zbudowane

| Plik | Co to jest |
|------|------------|
| `web/index.html` | cały interfejs: listy, działy, słownik działów (`SLOWNIK`), rozpoznawanie wpisu (`parsuj`), wysyłanie, wklejanie |
| `App.js` | część natywna Androida: zapis danych (AsyncStorage), WhatsApp/SMS/udostępnianie, schowek, przycisk Wstecz, aktualizacje |
| `web/sw.js`, `web/manifest.webmanifest`, `web/icons/` | wersja na iPhone'a (PWA): praca bez internetu, ikona |
| `scripts/gen-html.js` | pakuje `web/index.html` do `src/appHtml.js` (`npm run gen`) |
| `scripts/gen-icons.js` | rysuje ikony (koszyk z ptaszkiem) na canvas → `assets/` i `web/icons/` |
| `tests/ui.test.js` | testy interfejsu w Playwright (ekran telefonu, atrapa mostu Androida, tryb iPhone) |
| `app.json`, `eas.json` | konfiguracja Expo / EAS, pakiet `pl.drewnianysklep.zakupy`, projekt `@reki11/zakupy` |
| `.github/workflows/` | `publikacja.yml` (testy → aktualizacja Androida + strona iPhone'a), `build-apk.yml` (nowy APK) |

Most aplikacja ↔ interfejs: Android wstawia dane jako `window.__STORE` (i `window.__APP` z wersją), a interfejs wysyła
`postMessage` z `{t:'zapisz'|'udostepnij'|'kopiuj'|'schowek'|'aktualizuj'|'wyjdz'}`. Bez Androida (iPhone, przeglądarka)
dane są w `localStorage`.

## Aktualizacje i wersje

- Zmieniasz coś (np. słownik działów w `web/index.html`), robisz commit i push na `main`.
  GitHub Actions uruchamia testy, potem:
  - **Android**: publikuje aktualizację EAS Update (kanał `production`). Telefon pobiera ją przy otwarciu aplikacji
    (widać pasek „Sprawdzam aktualizacje…”), a także po powrocie do aplikacji po 30 min.
  - **iPhone**: publikuje stronę na GitHub Pages. Aplikacja z ekranu początkowego sprawdza `version.json` przy starcie
    i sama przeładowuje się do nowej wersji.
- Ręcznie: Menu → **O aplikacji** → **Sprawdź aktualizacje**.
- Numer wersji: `APP_WERSJA` w `web/index.html` + wpis w `CHANGELOG.md` (+ `version` w `package.json`).
- **Nowy APK** jest potrzebny tylko przy zmianie części natywnej (nowa biblioteka, uprawnienia, ikona). Zmiana
  `app.json` / `package.json` / `eas.json` na `main` sama uruchamia build w EAS (`runtimeVersion` = fingerprint, więc
  stare APK nie dostaną aktualizacji, której nie umieją uruchomić).

## Na komputerze

```bash
npm install
npm run gen                 # web/index.html -> src/appHtml.js
node tests/ui.test.js       # testy (potrzebny playwright z Chromium)
npx expo start              # podgląd w Expo
```

Sam interfejs możesz też otworzyć w przeglądarce: `web/index.html` (dane w localStorage).

## Pierwsza konfiguracja (zrobiona raz)

1. `npx eas-cli@latest init` – projekt `@reki11/zakupy`, `npx eas-cli@latest update:configure` – adres aktualizacji w `app.json`.
2. Pierwszy `eas build -p android --profile production` – wygenerował klucz podpisu na serwerze Expo (potem buduje CI).
3. GitHub → Settings → Secrets and variables → Actions: sekret **`EXPOTOKEN`** (token z expo.dev → Access tokens).
4. GitHub → Settings → Pages → Source: **GitHub Actions** (strona dla iPhone'a).

## Dodanie produktu do słownika działów

W `web/index.html` w obiekcie `SLOWNIK` dopisz początek słowa (bez polskich znaków, małymi literami) do właściwego działu,
np. `'sery': '... oscyp'`. Słowa do 3 liter muszą pasować w całości. Liczy się słowo najbliżej początku nazwy
(„sok pomarańczowy” → Napoje). Działy, które poprawisz ręcznie w aplikacji, są zapamiętywane dla danej listy.
