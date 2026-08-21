<div align="center">

# 🃏 L'Escalier

**Anotador de puntos offline para Oh Hell (La Escalera / La Podrida) y sus variantes**<br>
<sub>Wizard · Skull King · Rikiki · Nominate · Stiche Raten · Barbu · Tarneeb · Chorão</sub>

<br>

[![Jugar en línea](https://img.shields.io/badge/▶%20Jugar%20en%20l%C3%ADnea-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

<br>

[![Español](https://img.shields.io/badge/Idioma-Espa%C3%B1ol%20🇪🇸-blue?style=flat-square)](#)
[![English](https://img.shields.io/badge/Language-English%20🇬🇧-lightgrey?style=flat-square)](README.md)
[![Français](https://img.shields.io/badge/Langue-Fran%C3%A7ais%20🇫🇷-lightgrey?style=flat-square)](README.fr.md)
[![Deutsch](https://img.shields.io/badge/Sprache-Deutsch%20🇩🇪-lightgrey?style=flat-square)](README.de.md)
[![Italiano](https://img.shields.io/badge/Lingua-Italiano%20🇮🇹-lightgrey?style=flat-square)](README.it.md)
[![Português](https://img.shields.io/badge/L%C3%ADngua-Portugu%C3%AAs%20🇵🇹-lightgrey?style=flat-square)](README.pt.md)

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/pages.yml?branch=main&label=GitHub%20Pages&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-2c6a44.svg?style=flat-square)](LICENSE)
![Dependencias en ejecución: 0](https://img.shields.io/badge/dependencias-0-2467a8.svg?style=flat-square)
![Idiomas: 6](https://img.shields.io/badge/idiomas-ES%20EN%20FR%20DE%20IT%20PT-8e44ad.svg?style=flat-square)

</div>

---

## 🎯 ¿Por qué L'Escalier?

La mayoría de los anotadores asumen un juego estático. En una mesa real:
- 🚶 Alguien llega tarde o tiene que irse antes.
- 🃏 La mesa decide añadir una mano extra de 1 carta al final.
- ✏️ Se necesita corregir una baza registrada hace tres rondas.
- 💡 Poca luz, manejable con una sola mano.

**L'Escalier fue diseñado para la mesa real:**
- 📶 **100% Offline (PWA)**: Funciona sin internet.
- 🔒 **Privacidad Total**: Sin servidores, sin cuentas, sin cookies.
- 🔗 **Compartir sin Servidor**: Toda la partida cabe en un enlace compacto de URL (~400 caracteres).

---

## 📸 Capturas de Pantalla

<div align="center">

| 1️⃣ Nueva Partida — Jugadores | 2️⃣ Nueva Partida — Escalera y Reglas |
|:---:|:---:|
| <img src="docs/screenshots/es/01_setup_players.png" width="360" alt="Nueva partida — Jugadores" /> | <img src="docs/screenshots/es/02_setup_rules.png" width="360" alt="Nueva partida — Escalera y Reglas" /> |
| *Disposición de jugadores, selección de dador y añadir rápido.* | *Forma de escalera, vista previa y control de puntuación.* |

| 3️⃣ Fase de Apuestas | 4️⃣ Fase de Bazas |
|:---:|:---:|
| <img src="docs/screenshots/es/03_play_bids.png" width="360" alt="Fase de apuestas" /> | <img src="docs/screenshots/es/04_play_tricks.png" width="360" alt="Fase de bazas" /> |
| *Fichas rápidas, apuesta prohibida del dador tachada (🚫).* | *Contador de bazas restantes y cálculo inmediato de puntos.* |

| 5️⃣ Vista de Escalera | 6️⃣ Clasificación y Tabla |
|:---:|:---:|
| <img src="docs/screenshots/es/05_stairs.png" width="360" alt="Vista de escalera" /> | <img src="docs/screenshots/es/06_board.png" width="360" alt="Clasificación" /> |
| *Escalera interactiva (1..10..1) con rotación de mano y dador.* | *Podio 🥇🥈🥉, puntuaciones acumuladas y matriz de rondas.* |

| 7️⃣ Gráfico de Evolución | 8️⃣ Modo Oscuro y Ajustes |
|:---:|:---:|
| <img src="docs/screenshots/es/07_chart.png" width="360" alt="Gráfico de evolución" /> | <img src="docs/screenshots/es/08_settings_dark.png" width="360" alt="Ajustes y tema oscuro" /> |
| *Curvas de progreso de cada jugador en tiempo real.* | *Tema tapete verde oscuro, 6 idiomas y lista de jugadores habituales.* |

</div>

---

## 🧮 Cálculo de Puntuación

| Situación | Fórmula | Ejemplo (Bono=5, Baza=5, Penalización=5) |
|:---|:---|:---|
| **Apuesta cumplida** $(A = B)$ | $\text{Bono} + (B \times \text{Pts/Baza})$ | Apuesta 2, Bazas 2 $\rightarrow 5 + (2 \times 5) = \mathbf{+15\text{ pts}}$ |
| **Apuesta fallida** $(A \neq B)$ | $- (\lvert A - B \rvert \times \text{Penalización})$ | Apuesta 2, Bazas 0 $\rightarrow - (2 \times 5) = \mathbf{-10\text{ pts}}$ |

---

## 🌐 Documentación en otros idiomas

[English](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md) · [Português](README.pt.md).

---

## 📜 Licencia

Publicado bajo la [Licencia MIT](LICENSE). Creado por **Erwin Mayer** ([github.com/mayerwin](https://github.com/mayerwin)).
