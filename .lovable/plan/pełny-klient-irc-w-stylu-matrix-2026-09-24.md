# Pełny klient IRC w stylu Matrix

## Cel
Przekształcić obecną bramkę w wygodny klient IRC inspirowany mIRC i irssi, zachowując własny wygląd Matrix oraz działające połączenie z PIRC.

## Zakres
- Zmienić terminal u góry w belkę rozwijaną kliknięciem; po wejściu na stronę będzie zwinięty.
- Przebudować klienta na układ sieć → kanały i rozmowy prywatne, z przełączaniem aktywnej rozmowy bez utraty historii.
- Dodać liczniki nieprzeczytanych wiadomości i wyróżnienie wzmianek o własnym nicku.
- Pokazywać temat kanału, tryby kanału, znaczniki czasu oraz osobne style wiadomości, akcji, notice i zdarzeń systemowych.
- Rozbudować listę nicków o rangi i menu: rozpocznij rozmowę, WHOIS, wpisz wzmiankę; operacyjne polecenia będą dostępne tylko jako jawne komendy.
- Dodać autouzupełnianie nicków i komend klawiszem Tab oraz historię wpisanych poleceń strzałkami.
- Rozszerzyć komendy o `/query`, `/close`, `/notice`, `/topic`, `/mode`, `/kick`, `/ban`, `/invite`, `/away`, `/names`, `/list`, obok już działających poleceń.
- Obsłużyć kolejne zdarzenia IRC: NOTICE, TOPIC, MODE, KICK, INVITE, numerics, MOTD i błędy; aktualizować kanały i nicki na żywo.
- Dodać automatyczne ponowne łączenie po przypadkowym zerwaniu oraz ręczne ponowienie, bez reconnectu po świadomym rozłączeniu.
- Na telefonie zastosować wysuwane panele rozmów i nicków; na laptopie zachować klasyczny trzykolumnowy układ.

## Szczegóły techniczne
- Kod bramka.pirc.pl może posłużyć jedynie jako publiczna referencja zachowania; klient pozostanie własną implementacją bez kopiowania wyglądu lub kodu.
- Stan rozmów będzie utrzymywany lokalnie w trakcie sesji; historia po zamknięciu strony wymagałaby osobnego konta/bouncera i nie wchodzi w ten etap.
- Istniejąca bramka WebSocket i lista dozwolonych serwerów pozostaną, z korektami protokołu tylko tam, gdzie wymaga tego poprawna obsługa zdarzeń.
- Po wdrożeniu sprawdzić połączenie z Jowiszem, wejście na kanał, przełączanie rozmów, prywatną wiadomość, listę nicków, komendy klawiaturowe i widok mobilny.
