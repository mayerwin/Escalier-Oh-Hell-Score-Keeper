<div align="center">

# 🃏 L'Escalier

**Segnapunti offline per Oh Hell (L'Ascensore / L'Escalier) e varianti**<br>
<sub>Wizard · Skull King · Rikiki · Nominate · Stiche Raten · Barbu · Tarneeb · Chorão</sub>

<br>

[![Gioca online](https://img.shields.io/badge/▶%20Gioca%20online-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

<br>

[![Italiano](https://img.shields.io/badge/Lingua-Italiano%20🇮🇹-blue?style=flat-square)](#)
[![English](https://img.shields.io/badge/Language-English%20🇬🇧-lightgrey?style=flat-square)](README.md)
[![Français](https://img.shields.io/badge/Langue-Fran%C3%A7ais%20🇫🇷-lightgrey?style=flat-square)](README.fr.md)
[![Deutsch](https://img.shields.io/badge/Sprache-Deutsch%20🇩🇪-lightgrey?style=flat-square)](README.de.md)
[![Español](https://img.shields.io/badge/Idioma-Espa%C3%B1ol%20🇪🇸-lightgrey?style=flat-square)](README.es.md)
[![Português](https://img.shields.io/badge/L%C3%ADngua-Portugu%C3%AAs%20🇵🇹-lightgrey?style=flat-square)](README.pt.md)

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/pages.yml?branch=main&label=GitHub%20Pages&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Licenza: MIT](https://img.shields.io/badge/licenza-MIT-2c6a44.svg?style=flat-square)](LICENSE)
![Dipendenze runtime: 0](https://img.shields.io/badge/dipendenze-0-2467a8.svg?style=flat-square)
![Lingue: 6](https://img.shields.io/badge/lingue-IT%20EN%20FR%20DE%20ES%20PT-8e44ad.svg?style=flat-square)

</div>

---

## 🎯 Perché L'Escalier?

Pensato appositamente per il tavolo di gioco reale:
- 📶 **100% Offline (PWA)**: Nessuna connessione necessaria.
- 🔒 **Privacy Totale**: Nessun server, nessun account, nessun cookie.
- 🔗 **Condivisione Istantanea**: Tutta la partita in un unico link URL (~400 caratteri).

---

## 📸 Galleria Screenshot

<div align="center">

| 1️⃣ Nuova Partita — Giocatori | 2️⃣ Nuova Partita — Scala e Regole |
|:---:|:---:|
| <img src="docs/screenshots/it/01_setup_players.png" width="360" alt="Nuova partita — Giocatori" /> | <img src="docs/screenshots/it/02_setup_rules.png" width="360" alt="Nuova partita — Scala e Regole" /> |
| *Configurazione giocatori, scelta del mazziere e aggiunta rapida.* | *Forma della scala, anteprima e regole punteggio.* |

| 3️⃣ Fase delle Previsioni | 4️⃣ Fase delle Prese |
|:---:|:---:|
| <img src="docs/screenshots/it/03_play_bids.png" width="360" alt="Fase previsioni" /> | <img src="docs/screenshots/it/04_play_tricks.png" width="360" alt="Fase prese" /> |
| *Pulsanti rapidi, previsione vietata del mazziere barrata (🚫).* | *Conteggio prese rimanenti in tempo reale e calcolo punteggi.* |

| 5️⃣ Vista Scala | 6️⃣ Classifica e Tabella |
|:---:|:---:|
| <img src="docs/screenshots/it/05_stairs.png" width="360" alt="Vista scala" /> | <img src="docs/screenshots/it/06_board.png" width="360" alt="Classifica" /> |
| *Scala interattiva (1..10..1) con rotazione mazziere/apertura.* | *Podio 🥇🥈🥉, punteggi totali e griglia dettagliata delle mani.* |

| 7️⃣ Grafico Andamento | 8️⃣ Tema Scuro e Impostazioni |
|:---:|:---:|
| <img src="docs/screenshots/it/07_chart.png" width="360" alt="Grafico andamento" /> | <img src="docs/screenshots/it/08_settings_dark.png" width="360" alt="Impostazioni tema scuro" /> |
| *Curve interattive dell'evoluzione dei punti di ogni giocatore.* | *Tema panno verde scuro, 6 lingue e giocatori abituali.* |

</div>

---

## 🧮 Calcolo Punteggi

| Risultato | Formula | Esempio (Bonus=5, Presa=5, Penalità=5) |
|:---|:---|:---|
| **Previsione esatta** $(P = E)$ | $\text{Bonus} + (E \times \text{Pti/Presa})$ | Previsto 2, Fatto 2 $\rightarrow 5 + (2 \times 5) = \mathbf{+15\text{ pti}}$ |
| **Previsione errata** $(P \neq E)$ | $- (\lvert P - E \rvert \times \text{Penalità})$ | Previsto 2, Fatto 0 $\rightarrow - (2 \times 5) = \mathbf{-10\text{ pti}}$ |

---

## 🌐 Documentazione multilingue

[English](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md) · [Português](README.pt.md).

---

## 📜 Licenza

Distribuito sotto [Licenza MIT](LICENSE). Creato da **Erwin Mayer** ([github.com/mayerwin](https://github.com/mayerwin)).
