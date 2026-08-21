<div align="center">

# 🃏 L'Escalier

**Marcador de pontos offline para Oh Hell (A Escada / Foda-se) e variantes**<br>
<sub>Wizard · Skull King · Rikiki · Nominate · Stiche Raten · Barbu · Tarneeb · Chorão</sub>

<br>

[![Jogar online](https://img.shields.io/badge/▶%20Jogar%20online-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

<br>

[![Português](https://img.shields.io/badge/L%C3%ADngua-Portugu%C3%AAs%20🇵🇹-blue?style=flat-square)](#)
[![English](https://img.shields.io/badge/Language-English%20🇬🇧-lightgrey?style=flat-square)](README.md)
[![Français](https://img.shields.io/badge/Langue-Fran%C3%A7ais%20🇫🇷-lightgrey?style=flat-square)](README.fr.md)
[![Deutsch](https://img.shields.io/badge/Sprache-Deutsch%20🇩🇪-lightgrey?style=flat-square)](README.de.md)
[![Español](https://img.shields.io/badge/Idioma-Espa%C3%B1ol%20🇪🇸-lightgrey?style=flat-square)](README.es.md)
[![Italiano](https://img.shields.io/badge/Lingua-Italiano%20🇮🇹-lightgrey?style=flat-square)](README.it.md)

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/pages.yml?branch=main&label=GitHub%20Pages&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-2c6a44.svg?style=flat-square)](LICENSE)
![Dependências em execução: 0](https://img.shields.io/badge/depend%C3%AAncias-0-2467a8.svg?style=flat-square)
![Idiomas: 6](https://img.shields.io/badge/idiomas-PT%20EN%20FR%20DE%20ES%20IT-8e44ad.svg?style=flat-square)

</div>

---

## 🎯 Porquê L'Escalier?

Feito especialmente para a mesa real de jogo:
- 📶 **100% Offline (PWA)**: Funciona sem ligação à rede.
- 🔒 **Privacidade Total**: Sem servidores, sem contas, sem cookies.
- 🔗 **Partilha Instantânea**: Todo o jogo num link de URL compacto (~400 caracteres).

---

## 📸 Capturas de Ecrã

<div align="center">

| 1️⃣ Novo Jogo — Jogadores | 2️⃣ Novo Jogo — Escada e Regras |
|:---:|:---:|
| <img src="docs/screenshots/pt/01_setup_players.png" width="360" alt="Novo jogo — Jogadores" /> | <img src="docs/screenshots/pt/02_setup_rules.png" width="360" alt="Novo jogo — Escada e Regras" /> |
| *Configuração dos jogadores, escolha do distribuidor e adicionar rápido.* | *Padrão da escada, pré-visualização e pontuação.* |

| 3️⃣ Fase de Apostas | 4️⃣ Fase de Vazas |
|:---:|:---:|
| <img src="docs/screenshots/pt/03_play_bids.png" width="360" alt="Fase de apostas" /> | <img src="docs/screenshots/pt/04_play_tricks.png" width="360" alt="Fase de vazas" /> |
| *Fichas rápidas, aposta proibida do distribuidor riscada (🚫).* | *Contagem decrescente de vazas restantes e cálculo de pontuações.* |

| 5️⃣ Vista da Escada | 6️⃣ Classificação e Tabela |
|:---:|:---:|
| <img src="docs/screenshots/pt/05_stairs.png" width="360" alt="Vista da escada" /> | <img src="docs/screenshots/pt/06_board.png" width="360" alt="Classificação" /> |
| *Escada interativa (1..10..1) com rotação de distribuidor/abertura.* | *Pódio 🥇🥈🥉, pontuação acumulada e matriz detalhada de rondas.* |

| 7️⃣ Gráfico de Evolução | 8️⃣ Modo Escuro e Definições |
|:---:|:---:|
| <img src="docs/screenshots/pt/07_chart.png" width="360" alt="Gráfico de evolução" /> | <img src="docs/screenshots/pt/08_settings_dark.png" width="360" alt="Definições e tema escuro" /> |
| *Curvas interativas de evolução das pontuações dos jogadores.* | *Tema tapete verde escuro, 6 idiomas e lista de jogadores habituais.* |

</div>

---

## 🧮 Cálculo de Pontuações

| Situação | Fórmula | Exemplo (Bónus=5, Vaza=5, Penalização=5) |
|:---|:---|:---|
| **Aposta cumprida** $(A = V)$ | $\text{Bónus} + (V \times \text{Pts/Vaza})$ | Aposta 2, Vazas 2 $\rightarrow 5 + (2 \times 5) = \mathbf{+15\text{ pts}}$ |
| **Aposta falhada** $(A \neq V)$ | $- (\lvert A - V \rvert \times \text{Penalização})$ | Aposta 2, Vazas 0 $\rightarrow - (2 \times 5) = \mathbf{-10\text{ pts}}$ |

---

## 🌐 Suporte Multilingue

Completamente traduzido em **6 idiomas** com formatação nativa de plurais e datas através da API `Intl`:

| Idioma | Código | Documentação | Seletor na Aplicação |
|:---|:---:|:---:|:---:|
| 🇵🇹 **Português (PT)** | `pt` | [README.pt.md](README.pt.md) | Deteção automática ou nas Definições |
| 🇬🇧 **English** | `en` | [README.md](README.md) | Deteção automática ou nas Definições |
| 🇫🇷 **Français** | `fr` | [README.fr.md](README.fr.md) | Deteção automática ou nas Definições |
| 🇩🇪 **Deutsch** | `de` | [README.de.md](README.de.md) | Deteção automática ou nas Definições |
| 🇪🇸 **Español** | `es` | [README.es.md](README.es.md) | Deteção automática ou nas Definições |
| 🇮🇹 **Italiano** | `it` | [README.it.md](README.it.md) | Deteção automática ou nas Definições |

---

## 📜 Licença

Distribuído sob [Licença MIT](LICENSE). Criado por **Erwin Mayer** ([github.com/mayerwin](https://github.com/mayerwin)).
