// Zakupy - aplikacja na Androida.
// Interfejs (listy, dzialy, podpowiedzi, wklejanie, ceny) to web/index.html w WebView.
// Ta warstwa daje mu: zapis danych w telefonie (AsyncStorage), wysylanie listy (WhatsApp / SMS / inne),
// schowek, przycisk Wstecz i automatyczne aktualizacje (EAS Update) z widocznym paskiem przy starcie.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Linking, Share, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import HTML from './src/appHtml';

const KLUCZ_DANE = 'zak:store';
const TLO = '#0f1311';
const ADRES_STRONY = 'https://zakupy.app.local/';

// Dane w JSON wstawiane do <script> - bez "</script>" i znakow konczacych linie w JS
const doSkryptu = (o) => JSON.stringify(o).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

export default function App() {
  const [dane, setDane] = useState(null);      // wszystko, co interfejs zapisal (listy, historia, ustawienia)
  const [aktual, setAktual] = useState(null);  // pasek u gory: stan sprawdzania aktualizacji
  const web = useRef(null);
  const daneRef = useRef({});
  const zapisTimer = useRef(null);
  const zaladowano = useRef(false);
  const ostatniCheck = useRef(0);
  const sprawdzam = useRef(false);

  // ---- start: dane z pamieci telefonu ----
  useEffect(() => {
    (async () => {
      let d = {};
      try { d = JSON.parse((await AsyncStorage.getItem(KLUCZ_DANE)) || '{}') || {}; } catch (e) { d = {}; }
      daneRef.current = d;
      setDane(d);
    })();
  }, []);

  const zapiszTeraz = useCallback(() => {
    clearTimeout(zapisTimer.current);
    zapisTimer.current = null;
    AsyncStorage.setItem(KLUCZ_DANE, JSON.stringify(daneRef.current)).catch(() => {});
  }, []);
  const zapiszPozniej = useCallback(() => {
    clearTimeout(zapisTimer.current);
    zapisTimer.current = setTimeout(zapiszTeraz, 300);
  }, [zapiszTeraz]);

  const doStrony = useCallback((js) => web.current && web.current.injectJavaScript(js + '; true;'), []);

  // ---- aktualizacje z GitHuba (EAS Update): przy starcie, po powrocie po 30 min i na przycisk ----
  const sprawdzAktualizacje = useCallback(async (reczne = false) => {
    const wynik = (s) => { if (reczne) doStrony("window.__aktualizacja && window.__aktualizacja('" + s + "')"); };
    if (__DEV__ || !Updates.isEnabled) { wynik('wylaczone'); return; }
    if (sprawdzam.current) return;
    sprawdzam.current = true;
    ostatniCheck.current = Date.now();
    try {
      setAktual('Sprawdzam aktualizacje…');
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        setAktual('Pobieram nową wersję…');
        await Updates.fetchUpdateAsync();
        zapiszTeraz();
        setAktual('Uruchamiam nową wersję…');
        await Updates.reloadAsync();
        return;
      }
      setAktual(null);
      wynik('aktualna');
    } catch (e) {
      setAktual(null);   // brak internetu (np. w sklepie) - sprobujemy przy nastepnym starcie
      wynik('blad');
    } finally {
      sprawdzam.current = false;
    }
  }, [zapiszTeraz, doStrony]);

  useEffect(() => {
    sprawdzAktualizacje();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') zapiszTeraz();
      else if (Date.now() - ostatniCheck.current > 30 * 60 * 1000) sprawdzAktualizacje();
    });
    return () => sub.remove();
  }, [sprawdzAktualizacje, zapiszTeraz]);

  // ---- przycisk Wstecz: najpierw interfejs (zamknij okno, schowaj klawiature) ----
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!web.current) return false;
      web.current.injectJavaScript('window.__wstecz && window.__wstecz(); true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  // ---- wysylanie listy ----
  const udostepnij = useCallback(async (m) => {
    const tekst = String(m.tekst || '');
    if (!tekst) return;
    const enc = encodeURIComponent(tekst);
    const systemowe = () => Share.share({ message: tekst }).catch(() => {});
    if (m.cel === 'whatsapp') {
      try { await Linking.openURL('whatsapp://send?text=' + enc); }
      catch (e) {
        try { await Linking.openURL('https://wa.me/?text=' + enc); } catch (e2) { await systemowe(); }
      }
    } else if (m.cel === 'sms') {
      try { await Linking.openURL('sms:?body=' + enc); } catch (e) { await systemowe(); }
    } else {
      await systemowe();
    }
  }, []);

  // ---- wiadomosci z interfejsu ----
  const onMessage = useCallback(async (e) => {
    let m;
    try { m = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    try {
      switch (m.t) {
        case 'zapisz':
          if (typeof m.k === 'string') {
            daneRef.current[m.k] = m.v;
            zapiszPozniej();
          }
          break;
        case 'udostepnij':
          await udostepnij(m);
          break;
        case 'kopiuj':
          await Clipboard.setStringAsync(String(m.tekst || ''));
          break;
        case 'schowek': {
          let s = '';
          try { s = await Clipboard.getStringAsync(); } catch (err) { s = ''; }
          doStrony('window.__schowek && window.__schowek(' + doSkryptu(s || '') + ')');
          break;
        }
        case 'aktualizuj':
          sprawdzAktualizacje(true);
          break;
        case 'wyjdz':
          zapiszTeraz();
          BackHandler.exitApp();
          break;
        default:
          break;
      }
    } catch (err) { /* nie wywracaj aplikacji przez jedna wiadomosc */ }
  }, [zapiszPozniej, zapiszTeraz, udostepnij, sprawdzAktualizacje, doStrony]);

  // pierwsze zaladowanie strony zostaje w WebView, kazdy inny link idzie do przegladarki / aplikacji
  const onShouldStart = useCallback((req) => {
    if (!zaladowano.current) return true;
    if (req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith('blob:')) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  if (!dane) {
    return (
      <View style={{ flex: 1, backgroundColor: TLO, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4fd18b" />
      </View>
    );
  }

  const app = {
    natywna: Constants.expoConfig?.version || null,
    update: Updates.isEmbeddedLaunch ? null : (Updates.createdAt ? Updates.createdAt.getTime() : null),
    kanal: Updates.channel || null,
  };
  const wstaw = 'window.__STORE=' + doSkryptu(dane) + ';window.__APP=' + doSkryptu(app) + ';';
  const html = HTML.replace('/*__NATYWNE__*/', () => wstaw);   // funkcja: bez interpretacji "$&" z danych

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: TLO }} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          ref={web}
          source={{ html, baseUrl: ADRES_STRONY }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          textZoom={100}
          setSupportMultipleWindows={false}
          overScrollMode="never"
          style={{ flex: 1, backgroundColor: TLO }}
          onMessage={onMessage}
          onLoadEnd={() => { zaladowano.current = true; }}
          onShouldStartLoadWithRequest={onShouldStart}
        />
        {aktual ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ backgroundColor: '#2f3b33', color: '#dff7ea', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, overflow: 'hidden', fontSize: 13, fontWeight: '600' }}>
              {aktual}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
