<div align="center">

# 🃏 L'Escalier

**Ein Offline-Punkteblock für Oh Hell (Stiche Raten / L'Escalier) und verwandte Kartenspiele**<br>
<sub>Wizard · Skull King · Rikiki · Nominate · Barbu · Tarneeb · Chorão</sub>

<br>

[![Online spielen](https://img.shields.io/badge/▶%20Online%20spielen-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

<br>

[![Deutsch](https://img.shields.io/badge/Sprache-Deutsch%20🇩🇪-blue?style=flat-square)](#)
[![English](https://img.shields.io/badge/Language-English%20🇬🇧-lightgrey?style=flat-square)](README.md)
[![Français](https://img.shields.io/badge/Langue-Français%20🇫🇷-lightgrey?style=flat-square)](README.fr.md)
[![Español](https://img.shields.io/badge/Idioma-Español%20🇪🇸-lightgrey?style=flat-square)](README.es.md)
[![Italiano](https://img.shields.io/badge/Lingua-Italiano%20🇮🇹-lightgrey?style=flat-square)](README.it.md)
[![Português](https://img.shields.io/badge/Língua-Português%20🇵🇹-lightgrey?style=flat-square)](README.pt.md)

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/pages.yml?branch=main&label=GitHub%20Pages&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Lizenz: MIT](https://img.shields.io/badge/lizenz-MIT-2c6a44.svg?style=flat-square)](LICENSE)
![Laufzeit-Abhängigkeiten: 0](https://img.shields.io/badge/abh%C3%A4ngigkeiten-0-2467a8.svg?style=flat-square)
![Sprachen: 6](https://img.shields.io/badge/sprachen-DE%20EN%20FR%20ES%20IT%20PT-8e44ad.svg?style=flat-square)

</div>

---

## 🎯 Warum L'Escalier?

Die meisten Punkte-Apps für Kartenspiele sind starr: eine feste Anzahl an Runden, eine unveränderliche Spielerliste und keine Möglichkeit, Korrekturen an vergangenen Runden vorzunehmen.

Am echten Spieltisch:
- 🚶 Jemand kommt später oder muss früher gehen.
- 🃏 Die Runde beschließt spontan eine Extra-Runde mit 1 Karte für maximale Spannung.
- ✏️ Vor drei Runden wurde ein Stich falsch eingetragen.
- 💡 Das Licht ist gedimmt, das Handy liegt in einer Hand, während schon ausgeteilt wird.

**L'Escalier wurde für den echten Spieltisch gebaut:**
- 📶 **100% Offline-fähig (PWA)**: Läuft ohne Internetverbindung, vollständig zwischengespeichert.
- 🔒 **Volle Privatsphäre**: Kein Server, kein Konto, keine Cookies, synchrone lokale Speicherung.
- 🔗 **Teilen ohne Server**: Das gesamte Spiel (Spieler, Treppe, alle Ansagen & Stiche) wird in einen kompakten URL-Link (~400 Zeichen) gepackt.

---

## 📸 Screenshots & Galerie

<div align="center">

| 1️⃣ Neues Spiel — Spieler | 2️⃣ Neues Spiel — Regeln |
|:---:|:---:|
| <img src="docs/screenshots/de/01_setup_players.png" width="360" alt="Neues Spiel — Spieler" /> | <img src="docs/screenshots/de/02_setup_rules.png" width="360" alt="Neues Spiel — Regeln" /> |
| *Sitzordnung, Geber-Auswahl und Schnelleingabe.* | *Treppenmuster, Live-Vorschau und Punkte-Regler.* |

| 3️⃣ Ansage-Phase | 4️⃣ Stich-Phase |
|:---:|:---:|
| <img src="docs/screenshots/de/03_play_bids.png" width="360" alt="Ansage-Phase" /> | <img src="docs/screenshots/de/04_play_tricks.png" width="360" alt="Stich-Phase" /> |
| *Schnelleingabe, verbotene Ansage für den Geber durchgestrichen (🚫).* | *Live-Reststichzähler, automatische Punkte- und Differenzberechnung.* |

| 5️⃣ Treppen-Übersicht | 6️⃣ Rangliste & Tabelle |
|:---:|:---:|
| <img src="docs/screenshots/de/05_stairs.png" width="360" alt="Treppen-Übersicht" /> | <img src="docs/screenshots/de/06_board.png" width="360" alt="Rangliste und Tabelle" /> |
| *Interaktive Treppe (1..10..1), Geber- und Ausspieler-Rotation.* | *Podest 🥇🥈🥉, Gesamtpunkte, Erfolgsquote und Rundengitter.* |

| 7️⃣ Punkteverlauf | 8️⃣ Dunkelmodus & Einstellungen |
|:---:|:---:|
| <img src="docs/screenshots/de/07_chart.png" width="360" alt="Punkteverlauf-Diagramm" /> | <img src="docs/screenshots/de/08_settings_dark.png" width="360" alt="Dunkelmodus und Einstellungen" /> |
| *Interaktive Verlaufskurven aller Spieler über alle Runden.* | *Filztisch-Dunkelmodus, 6 Sprachen, Stammspieler-Verwaltung.* |

</div>

---

## ✨ Hauptfunktionen

### 🪜 Jederzeit bearbeitbare Treppe
- ➕ Runden jederzeit an beliebiger Stelle einfügen oder löschen.
- 🔁 Handkartengröße anpassen oder Runden überspringen.
- 📐 Den unverspielten Rest der Treppe neu berechnen (aufsteigend, absteigend, Pyramide...).
- 🛡️ Gespielte Runden bleiben im Verlauf unverändert verankert.

### ⚖️ Zwei getrennte Phasen pro Runde
1. **Phase 1: Ansagen** — Jeder Spieler sagt der Reihe nach an (Ausspieler zuerst, Geber zuletzt).
2. **Phase 2: Erzielte Stiche** — Eingabe der tatsächlichen Stiche mit Restzähler, der exakt auf Null fallen muss.

### 🚫 Geber-Regel (« Screw the Dealer »)
- Die Summe der Ansagen darf nicht der Stichzahl entsprechen.
- Die verbotene Zahl wird **direkt auf dem Chip des Gebers durchgestrichen**.

---

## 🧮 Punkteberechnung

| Ergebnis | Formel | Beispiel (Bonus=5, Stich=5, Abzug=5) |
|:---|:---|:---|
| **Ansage getroffen** $(A = S)$ | $\text{Bonus} + (S \times \text{Punkte/Stich})$ | Ansage 2, Stiche 2 $\rightarrow 5 + (2 \times 5) = \mathbf{+15\text{ Pkt.}}$ |
| **Ansage verfehlt** $(A \neq S)$ | $- (\lvert A - S \rvert \times \text{Abzug})$ | Ansage 2, Stiche 0 $\rightarrow - (2 \times 5) = \mathbf{-10\text{ Pkt.}}$ |

---

## 🌐 Mehrsprachigkeit

Vollständig lokalisiert in **6 Sprachen** über die `Intl`-API:
[English](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md) · [Português](README.pt.md).

---

## 🚀 Lokale Nutzung

Kein Build-Schritt erforderlich:

```sh
git clone https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper.git
cd Escalier-Oh-Hell-Score-Keeper
npm run serve
```

---

## 📜 Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE). Erstellt von **Erwin Mayer** ([github.com/mayerwin](https://github.com/mayerwin)).
