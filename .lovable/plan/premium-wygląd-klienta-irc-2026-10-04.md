# Premium wygląd klienta IRC

## Cel
Dopracować wygląd klienta IRC, żeby wyglądał jak płatna aplikacja, i zrobić to w jednym podejściu, bo konto jest darmowe. Wszystkie obecne funkcje zostają bez zmian.

## Co się zmieni
- **Okno klienta:** szklane tło z delikatną poświatą w kolorze szaty, zaokrąglone rogi, cienka świecąca ramka.
- **Pasek u góry:** kropka statusu połączenia (pulsuje przy łączeniu, świeci na zielono po połączeniu, na czerwono przy błędzie), nazwa sieci i nick w formie etykiet.
- **Lista rozmów:** ikony `#` i `@`, aktywna rozmowa podświetlona paskiem z boku, liczniki nieprzeczytanych jako kolorowe plakietki, wzmianki w kolorze ostrzegawczym.
- **Wiadomości:** kółko z inicjałem przed nickiem (każdy nick ma swój kolor), kolejne wiadomości tej samej osoby zgrupowane, czas wyszarzony, wyraźniej wyróżnione wzmianki, płynne pojawianie się nowych linii.
- **Lista nicków:** kółka z inicjałami, plakietki rang (@ op, + voice), nagłówki grup z liczbą osób.
- **Pole pisania:** wyraźna ramka po kliknięciu, podpowiedź komend, przycisk wysyłania.
- **Ustawienia:** osobne okno na środku ekranu, podzielone na sekcje (Konto, Kanały, Powiadomienia, Wygląd), z przełącznikami zamiast pól wyboru.
- **Paski przewijania:** cienkie, w kolorze szaty.
- **Szaty:** Matrix, Mono i PIRC dopracowane tak, żeby każda wyglądała spójnie.

## Szczegóły techniczne
- Zmiany tylko w `SecureTunnel.tsx` i `index.css` (nowe tokeny: poświata, szkło, statusy). Bez zmian w bramce i logice IRC.
- Okno ustawień oparte o gotowe komponenty Dialog i Switch.
- Jedna szybka kontrola, że strona się buduje.
