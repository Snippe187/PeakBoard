# Aenderungen

## 0.1.2 (in Arbeit)

- Neue **Spielansicht** statt Uebersicht: ein Bild wie in Minecraft (Tab-Liste, Seitenleiste, Spieler mit Namensschild); anklicken, was man aendern will, rechts erscheinen die Einstellungen dazu (welches Objective, Darstellung, Punkte, Team)
- Einfache Begriffe: Objective-Arten mit deutschen Namen (z. B. Tode, Spielzeit), Hilfetexte in jedem Menue
- **Teams per Drag & Drop**: Spieler (auch offline per Name) in die Team-Spalte ziehen, zurueck nach "Ohne Team" zum Herausnehmen; Teams mit Farbpalette, Namensschild- und Teameinstellungen
- **Tabelle**: suchen, nach Spalten sortieren, nur Online-Spieler, mehrere Eintraege auf einmal aendern (dazugeben, setzen, zuruecksetzen)
- **Rangliste**: Medaillen, Suche, Klick auf einen Spieler oeffnet ihn, Objective mit einem Klick in die Seitenleiste legen
- Aenderungen laufen weiter ueber den Entwurf (Veroeffentlichen mit einem Klick, Fremdes wird geschuetzt)

## 0.1.1

- Neuer Reiter "Anzeige": jeder Spieler sieht rechts seine eigene Seitenleiste mit Platzhaltern (Stats, Spielzeit, Ping, Rangliste, Geld ueber Vault, PlaceholderAPI), Seiten, die nach Zeit wechseln, und einem animierten Titel
- Freie Zeilen mit Farben (`&a`, `&#rrggbb`, `<red>`), Verlaeufen (`<gradient:rot:blau>`), Regenbogen, Fett/Kursiv/Unterstrichen; Live-Vorschau neben dem Editor (mit Beispielwerten oder den echten Werten eines Spielers)
- Fuenf Vorlagen mit einem Klick (Survival-Stats, Kills-Rangliste, Event, Server-Info, 3 Seiten in einem)
- Teams, Tab-Liste und "unter dem Namen" werden vom normalen Scoreboard uebernommen, damit Namensfarben bleiben
- `/board` schaltet die Anzeige fuer den Spieler aus und ein (Recht `peakboard.toggle`, Standard: jeder); Seiten koennen an ein Recht gebunden werden
- Gespeichert in `plugins/PeakBoard/display.json` (mit `.bak` der vorigen Fassung)

## 0.1.0

- Erste Version: Objectives, Punktestaende, Anzeige-Plaetze (Seitenleiste, Tab-Liste, unter dem Namen), Teams, Entwurf mit Veroeffentlichen, Schutz fuer Fremdes, Sicherung vor dem Veroeffentlichen, Sidebar-Vorschau, Tabelle, Rangliste.
