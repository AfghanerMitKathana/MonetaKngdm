# MonetaKngdm fertigstellen

Diese Website hat jetzt zwei Teile:

- `frontend`: Das ist das Aussehen deiner Website.
- `backend`: Das ist der kleine Server, der spaeter echte Daten von einer Finanz-API holt.

## 1. Was du installieren brauchst

Installiere Node.js, falls es noch nicht auf deinem PC ist:

https://nodejs.org

Nimm die Version mit der Aufschrift `LTS`.

## 2. API-Key holen

Ein API-Key ist wie ein Passwort fuer einen Datendienst. Deine Website fragt damit nach echten Aktienkursen.

Ein einfacher kostenloser Anbieter ist Alpha Vantage:

https://www.alphavantage.co/support/#api-key

Dort holst du dir einen kostenlosen Key.

Hinweis: Der kostenlose Key ist gut zum Starten. Je nach Markt sind die Daten aber nicht immer komplett live. Fuer echte Live-Daten braucht man bei Finanzdaten oft einen bezahlten Tarif.

## 3. API-Key eintragen

Kopiere die Datei `.env.example` und nenne die Kopie `.env`.

In `.env` steht dann:

```text
ALPHA_VANTAGE_API_KEY=dein_api_key_hier_einfuegen
```

Ersetze `dein_api_key_hier_einfuegen` durch deinen echten Key.

Wichtig: Die Datei `.env` darf nicht auf GitHub hochgeladen werden. Sie steht schon in `.gitignore`, also ist sie geschuetzt.

Wichtig nach jeder Aenderung an `.env`: Server stoppen und neu starten. Sonst liest das Backend den neuen Key nicht.

## 4. Website starten

Oeffne ein Terminal in diesem Projektordner:

```text
C:\Dev\MonetaKngdm
```

Dann:

```bash
cd backend
npm start
```

Danach oeffnest du im Browser:

```text
http://localhost:3000
```

## Wenn `npm start` nicht erkannt wird

Wenn Windows sagt, dass `npm` nicht erkannt wird, fehlt sehr wahrscheinlich Node.js oder das Terminal wurde nach der Installation noch nicht neu gestartet.

So loest du es:

1. Installiere Node.js LTS von https://nodejs.org
2. Schliesse danach CMD komplett.
3. Oeffne CMD neu.
4. Pruefe:

```bash
node -v
npm -v
```

Wenn beide Befehle eine Versionsnummer zeigen, ist alles bereit.

Dann wieder:

```bash
cd C:\Dev\MonetaKngdm\backend
npm start
```

## 5. Ohne API-Key testen

Du kannst die Website auch ohne API-Key starten. Dann zeigt sie Beispieldaten.

So kannst du erst pruefen, ob alles funktioniert, bevor du dich um echte Daten kuemmerst.

## 6. Welche Dateien wichtig sind

- `frontend/index.html`: Deine Hauptseite.
- `backend/server.js`: Holt Daten und liefert die Website aus.
- `.env`: Hier kommt dein geheimer API-Key rein.
- `.env.example`: Beispiel, damit man weiss, was in `.env` stehen muss.

## 7. Naechste sinnvolle Schritte

Als Naechstes kannst du entscheiden:

- Sollen Nutzer eigene Aktien in die Watchlist eintragen koennen?
- Soll es Login und Benutzerkonten geben?
- Soll die Website online gestellt werden?

Wenn ja, brauchst du danach wahrscheinlich noch eine Datenbank. Fuer den Anfang reicht dieses Backend aber gut aus.

## Eigene Watchlist benutzen

Auf der Website gibt es jetzt ein Feld fuer eigene Aktien.

Beispiele fuer Symbole:

- `AAPL` fuer Apple
- `MSFT` fuer Microsoft
- `NVDA` fuer NVIDIA
- `ENR.DEX` fuer Siemens Energy auf XETRA
- `Y0N` fuer Redwood AI in Frankfurt
- `AIRX` fuer Redwood AI an der Canadian Securities Exchange
- `RDWCF` fuer Redwood AI am OTCQB-Markt

`A422EZ` ist bei Redwood AI die WKN. Du kannst `A422EZ` trotzdem eingeben; die Website wandelt es intern zu `Y0N` um.

Die Eintraege werden hier gespeichert:

```text
backend\data\store.json
```

## Suche benutzen

Oben auf der Startseite gibt es jetzt eine Suchleiste.

Du kannst zum Beispiel eingeben:

```text
Apple
AAPL
Microsoft
MSFT
```

Nach der Suche kannst du den Treffer direkt zur Watchlist hinzufuegen oder einen Aktienwecker dafuer vorbereiten.

## Knoepfe auf der Seite

Diese Knoepfe haben jetzt eine Funktion:

- `Watchlist bearbeiten`: springt zum Watchlist-Feld.
- `Maerkte oeffnen`: springt zur Marktuebersicht.
- `News ansehen`: springt zu den News.
- `Top Aktien`, `Indizes`, `ETFs`: wechseln die Marktuebersicht.
- `Alle News neu laden`: laedt die News nochmal.
- `Zur Watchlist hinzufuegen`: speichert ein Symbol in deiner Watchlist.
- `Aktienwecker erstellen`: speichert einen Zielkurs.
- `Benachrichtigungen erlauben`: fragt den Browser nach Erlaubnis fuer Meldungen.

## Aktienwecker benutzen

Du kannst ein Symbol und einen Zielkurs eintragen.

Beispiel:

```text
AAPL
215
Benachrichtigen, wenn Kurs hoeher ist
```

Danach auf `Benachrichtigungen erlauben` klicken.

Wichtig: Diese einfache Version prueft die Kurse, solange die Website im Browser offen ist. Fuer Benachrichtigungen, wenn die Website komplett geschlossen ist, braucht man spaeter echtes Web-Push mit einem extra Push-Dienst.

## Graphen benutzen

Die Website hat jetzt einen Kursverlauf.

Du kannst den Graphen wechseln, indem du auf einen Wert in der Watchlist, in der Marktuebersicht oder im Suchergebnis klickst.

Oben rechts im Graphen kannst du den Zeitraum wechseln:

- `1M`: ein Monat
- `3M`: drei Monate
- `6M`: sechs Monate
- `1J`: ein Jahr

Die Chart-Daten kommen von Yahoo Finance. Wenn eine sehr neue oder kleine Aktie keinen Graphen zeigt, hat die Datenquelle dafuer wahrscheinlich noch zu wenig Kursverlauf.

## Wenn trotz API-Key keine echten Kurse kommen

Oben rechts zeigt die Website jetzt den API-Status.

- `Live-Daten: ... Kurse`: Es werden echte Kursdaten geladen.
- `Demo-Daten: ... Kurse`: Es werden nur Beispieldaten genutzt.
- `Keine Kursdaten gefunden`: Das Symbol wurde bei den Datenquellen nicht gefunden.
- `API-Key fehlt`: `.env` wird nicht gefunden oder der Server wurde nicht neu gestartet.

Der kostenlose Alpha-Vantage-Key ist begrenzt. Wenn du viele Symbole schnell hintereinander pruefst, kann kurzzeitig keine Antwort mit echten Kursen kommen.

Das Backend nutzt fuer Kurse jetzt zuerst Stooq als echte Datenquelle. Alpha Vantage bleibt fuer News und als Reserve drin. Ausserdem speichert das Backend Kursantworten 15 Minuten zwischen. Dadurch fragt deine Website nicht bei jedem Klick sofort wieder neue Daten an.
