# Wer ist der Spion?

Partyspiel für 3 bis 20 Leute an einem Handy. Alle kennen den Ort, nur der Spion nicht. Durch geschickte Fragen versucht ihr, den Spion zu entlarven. Der Spion versucht, den Ort zu erraten, ohne aufzufliegen.

**Spielen:** [spy.bapo.me](https://spy.bapo.me)

## So läuft eine Runde

1. Spieler, Spione und Rundenzeit einstellen und Ortspakete wählen.
2. Das Handy geht reihum. Jeder hält den Daumen auf den Fingerabdruck. Solange er drückt, öffnet sich seine Akte mit Ort und Rolle oder dem Stempel „Spion“.
3. Der Timer läuft, und das Spiel zeigt an, wer die erste Frage stellt. Über „Auflösen“ seht ihr am Ende Ort und Spione.

## Neu in Version 2

- 1000 Orte in 25 Paketen, ohne Dubletten
- Kein Ort kommt wieder, bevor alle gewählten Orte einmal dran waren
- Rollen pro Ort, im Setup abschaltbar
- Aufdecken per Gedrückthalten
- Rundentimer mit Signal, zufälliger Startspieler, optionale Spielernamen
- Neues Design. Die Einstellungen bleiben im Browser gespeichert.

## Orte hinzufügen

Alle Orte stehen in `packs/`, eine Datei pro Paket, ein Ort pro Zeile:

```
🛒 Supermarkt: Kassiererin, Kunde, Filialleiter, Regalauffüller, Ladendetektiv, Kind an der Quengelkasse
```

Vorne steht ein Emoji, dann der Ortsname. Nach dem Doppelpunkt folgen die Rollen, getrennt durch Kommas. Im Ortsnamen dürfen weder Doppelpunkt noch Komma vorkommen. Zeilen mit `#` am Anfang sind Kommentare.

- **Ort ergänzen:** Eine Zeile in die passende Paketdatei schreiben, fertig.
- **Neues Paket:** `packs/meinpaket.js` nach dem Muster einer bestehenden Datei anlegen und die id `'meinpaket'` in `packs/_list.js` eintragen.
- **Prüfen:** `node scripts/check-packs.mjs` zeigt Formatfehler und doppelte Orte über alle Pakete hinweg.

Das Spiel ist reines HTML, CSS und JavaScript ohne Build-Schritt. Lokal reicht ein einfacher Server, z. B. `python3 -m http.server`. Gehostet wird über GitHub Pages.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Bildschirme: Einrichtung, Verteilung, Spielrunde, Hinweis „Neu in Version 2“ |
| `css/style.css` | Design |
| `js/app.js` | Spiellogik |
| `js/parse.js` | Liest das Zeilenformat der Pakete |
| `packs/_list.js` | Welche Pakete in welcher Reihenfolge geladen werden |
| `packs/*.js` | Die Ortspakete |
| `scripts/check-packs.mjs` | Prüfskript für die Pakete |
