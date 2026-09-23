# Rozbudowa klienta IRC

## Cel
Rozwinąć obecny „Secure Tunnel” w wygodny klient IRC przypominający klasyczny mIRC, bez usuwania dotychczasowego klimatu Matrixa.

## Zakres
- Dodać `jowisz.pirc.pl` do listy dozwolonych i widocznych serwerów IRC, z bezpiecznym połączeniem TLS na właściwym porcie.
- Po połączeniu pokazać pełny widok rozmowy: pasek aktywnego kanału, historię wiadomości, pole pisania oraz listę nicków po prawej stronie.
- Obsłużyć komendy w przyjaznej formie, m.in. `/join #kanał`, `/part`, `/nick`, `/me`, `/msg`, `/whois` i `/quit`; zwykły tekst będzie wysyłany na bieżący kanał.
- Odczytywać zdarzenia IRC (JOIN/PART/QUIT/NICK/NAMES) i na ich podstawie na żywo aktualizować listę użytkowników, z operatorami na górze.
- Zachować możliwość wpisywania surowych komend IRC jako opcję dla bardziej zaawansowanych osób.
- Dodać przełącznik trzech szat: **Matrix** (obecna i domyślna), **Mono** (czarno-biała) oraz **PIRC** (czytelna klasyczna bramka); wybór zapamiętać w przeglądarce.
- Dopasować widok do laptopa i telefonu: na mniejszym ekranie lista nicków będzie wysuwana zamiast ściskać rozmowę.

## Szczegóły techniczne
- Rozszerzyć istniejącą funkcję chmurową, whitelistę hostów i obsługę komunikatów IRC; po zmianie wdrożyć ją i wykonać próbę połączenia.
- Przebudować tylko sekcję tunelu oraz wspólne tokeny kolorów, bez usuwania terminala, deszczu kodu i easter eggów.
- Dodać dostępne etykiety i podpowiedzi do ikon oraz czytelne stany: łączenie, połączono, rozłączono, błąd.
- Zweryfikować kompilację oraz wygląd i podstawowy przebieg połączenia w działającym podglądzie.
