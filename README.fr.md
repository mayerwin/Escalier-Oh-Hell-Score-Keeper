<div align="center">

# 🃏 L'Escalier

**Compteur de points hors-ligne pour le jeu de cartes l'Ascenseur / Escalier (*Oh Hell*) et toutes ses variantes**<br>
<sub>Wizard · Skull King · Rikiki · Casse-Tête · Stiche Raten · Barbu · Tarneeb · Chorão</sub>

<br>

[![Jouer en ligne](https://img.shields.io/badge/▶%20Jouer%20en%20ligne-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

<br>

[![Français](https://img.shields.io/badge/Langue-Français%20🇫🇷-blue?style=flat-square)](#)
[![English](https://img.shields.io/badge/Language-English%20🇬🇧-lightgrey?style=flat-square)](README.md)
[![Deutsch](https://img.shields.io/badge/Sprache-Deutsch%20🇩🇪-lightgrey?style=flat-square)](README.de.md)
[![Español](https://img.shields.io/badge/Idioma-Español%20🇪🇸-lightgrey?style=flat-square)](README.es.md)
[![Italiano](https://img.shields.io/badge/Lingua-Italiano%20🇮🇹-lightgrey?style=flat-square)](README.it.md)
[![Português](https://img.shields.io/badge/Língua-Português%20🇵🇹-lightgrey?style=flat-square)](README.pt.md)

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/mayerwin/Escalier-Oh-Hell-Score-Keeper/pages.yml?branch=main&label=GitHub%20Pages&style=flat-square)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-2c6a44.svg?style=flat-square)](LICENSE)
![Dépendances d'exécution: 0](https://img.shields.io/badge/dépendances-0-2467a8.svg?style=flat-square)
![Langues: 6](https://img.shields.io/badge/langues-FR%20EN%20DE%20ES%20IT%20PT-8e44ad.svg?style=flat-square)

</div>

---

## 🎯 Pourquoi L'Escalier ?

La plupart des compteurs de score imposent un déroulement figé : une échelle de manches gravée dans le marbre, une liste de joueurs immuable et aucune possibilité de corriger une manche jouée trois tours plus tôt.

Dans la vraie vie autour d'une table de cartes :
- 🚶 Quelqu’un arrive en retard ou doit partir plus tôt.
- 🃏 La table décide d'ajouter une manche à 1 carte à la fin pour le suspense.
- ✏️ Une erreur de saisie est constatée après coup.
- 💡 La lumière est tamisée, on tient son téléphone d'une seule main pendant que le donneur distribue déjà.

**L'Escalier a été pensé pour la table réelle :**
- 📶 **100% hors-ligne (PWA)** : fonctionne sans réseau, préchargé dans le navigateur.
- 🔒 **Confidentialité totale** : zéro serveur, zéro compte, zéro cookie, stockage local instantané.
- 🔗 **Partage instantané** : toute la partie (joueurs, historique manche par manche, barème) est compressée dans un lien URL compact de ~400 caractères.

---

## 📸 Aperçu & Galerie d'écrans

<div align="center">

| 1️⃣ Configuration — Joueurs & Table | 2️⃣ Configuration — Volée & Barème |
|:---:|:---:|
| <img src="docs/screenshots/fr/01_setup_players.png" width="360" alt="Configuration de nouvelle partie — Joueurs" /> | <img src="docs/screenshots/fr/02_setup_rules.png" width="360" alt="Configuration de nouvelle partie — Volée et Barème" /> |
| *Installation des joueurs, choix du premier donneur, ajout rapide.* | *Motif de volée personnalisable, aperçu en direct et curseurs de score.* |

| 3️⃣ Phase des Annonces | 4️⃣ Phase des Plis |
|:---:|:---:|
| <img src="docs/screenshots/fr/03_play_bids.png" width="360" alt="Phase des annonces" /> | <img src="docs/screenshots/fr/04_play_tricks.png" width="360" alt="Phase des plis" /> |
| *Puces rapides, contrat interdit du donneur barré (🚫), badge d'entame.* | *Décompte en direct des plis restants, calcul instantané des gains/pertes.* |

| 5️⃣ Volée de l'Escalier | 6️⃣ Tableau & Classement |
|:---:|:---:|
| <img src="docs/screenshots/fr/05_stairs.png" width="360" alt="Volée de l'escalier" /> | <img src="docs/screenshots/fr/06_board.png" width="360" alt="Tableau des scores et classement" /> |
| *Visualisation globale des 19 marches (1..10..1), repère de manche active.* | *Podium 🥇🥈🥉, scores cumulés, taux de réussite et grille détaillée.* |

| 7️⃣ Graphique d'Évolution | 8️⃣ Mode Sombre & Réglages |
|:---:|:---:|
| <img src="docs/screenshots/fr/07_chart.png" width="360" alt="Graphique d'évolution des scores" /> | <img src="docs/screenshots/fr/08_settings_dark.png" width="360" alt="Paramètres et thème feutre sombre" /> |
| *Courbes interactives des scores au fil des manches par joueur.* | *Thème tapis feutre sombre, 6 langues, carnet de joueurs habituels.* |

</div>

---

## ✨ Fonctionnalités clés

### 🪜 L'Escalier entièrement éditable à tout moment
Le plan des manches est une volée de marches interactive :
- ➕ Insérer une manche n'importe où.
- 🔁 Modifier le nombre de cartes d'une donne.
- ⏭️ Sauter une manche ou avancer le curseur de jeu.
- 📐 Recalculer le reste de l'escalier selon un nouveau motif (montant, descendant, pyramide, aller-retour...).
- 🛡️ Les manches déjà jouées restent scrupuleusement préservées et ancrées dans l'historique.

### ⚖️ Deux phases de jeu étanches
1. **Phase 1 : Les Annonces** — Chaque joueur annonce son contrat dans l'ordre de parole (l'ouvreur en premier, le donneur en dernier).
2. **Phase 2 : Les Plis réalisés** — Saisie des plis remportés avec un compteur dynamique de contrôle qui doit tomber exactement à zéro pour valider la manche.

### 🚫 Règle du Donneur (« Screw the Dealer »)
- La règle interdisant au donneur d'annoncer un nombre de plis faisant tomber le total pile sur le nombre de cartes de la manche est appliquée automatiquement.
- Le chiffre interdit est **barré directement sur la puce du donneur**, évitant tout calcul mental à la table.
- Règle paramétrable (active à partir de $N$ cartes ou désactivable).

### 👥 Gestion des aléas de la table
- **Arrivée tardive** : intégrez un nouveau joueur en cours de partie avec un score personnalisé.
- **Départ anticipé** : mettez un joueur en retrait sans casser la somme des plis des manches déjà archivées.
- **Pause d'une manche** : faites sauter un tour à un joueur momentanément absent.
- **Ajustement ponctuel** : appliquez un bonus ou malus personnalisé sur une manche.
- **Changement de place** : réorganisez l'ordre de la table par simple glisser-déposer.

### 📇 Mémoire des joueurs habituels (Roster)
- Enregistrez vos partenaires de jeu habituels dans les réglages.
- Les joueurs cochés sont automatiquement installés à table à chaque nouvelle partie.
- L'autocomplétion intelligente mémorise les prénoms au fil de vos parties.

### 🧮 Barème de score personnalisable
Ajustez les règles de points avec un aperçu dynamique en temps réel :
- **Prime de contrat exact** (ex. +5 pts).
- **Points par pli réussi** (ex. +5 pts / pli).
- **Pénalité par pli d'écart** (ex. -5 pts par pli de différence).
- **Mode strict** (accorde ou non les points de pli en cas de contrat manqué).

---

## 🧮 Calcul des Scores

Le calcul des points suit la formule standard de l'Escalier / Oh Hell :

| Situation | Formule de calcul | Exemple (Prime=5, Pli=5, Malus=5) |
|:---|:---|:---|
| **Contrat réussi** $(A = P)$ | $\text{Prime} + (P \times \text{Pts/Pli})$ | Annonce 2, Réalisé 2 $\rightarrow 5 + (2 \times 5) = \mathbf{+15\text{ pts}}$ |
| **Contrat manqué** $(A \neq P)$ | $- (\lvert A - P \rvert \times \text{Pénalité})$ | Annonce 2, Réalisé 0 $\rightarrow - (2 \times 5) = \mathbf{-10\text{ pts}}$ |
| **Contrat manqué (Mode Strict)** | $- (\lvert A - P \rvert \times \text{Pénalité}) + (P \times \text{Pts/Pli})$ | Annonce 2, Réalisé 1 $\rightarrow -5 + 5 = \mathbf{0\text{ pt}}$ |

---

## 🌐 Support Multilingue

L'application est intégralement traduite dans **6 langues** avec gestion native des pluriels et formats régionaux via l'API `Intl` :

| Langue | Code | Documentation | Sélecteur |
|:---|:---:|:---:|:---:|
| 🇫🇷 **Français** | `fr` | [README.fr.md](README.fr.md) | Intégré (Détection auto ou forçage) |
| 🇬🇧 **English** | `en` | [README.md](README.md) | Built-in (Auto-detect or override) |
| 🇩🇪 **Deutsch** | `de` | [README.de.md](README.de.md) | Integriert |
| 🇪🇸 **Español** | `es` | [README.es.md](README.es.md) | Integrado |
| 🇮🇹 **Italiano** | `it` | [README.it.md](README.it.md) | Integrato |
| 🇵🇹 **Português (PT)** | `pt` | [README.pt.md](README.pt.md) | Integrado |

---

## 🎨 Deux Thèmes Soignés

- 📜 **Papier Carnet (Clair)** : style registre quadrillé élégant pour jouer en pleine journée.
- 🌲 **Tapis de Table (Sombre)** : ambiance feutre vert profond et or vieilli, idéal pour les soirées tamisées et pour préserver la batterie.

---

## 🚀 Utilisation & Lancement Local

Aucune étape de compilation ni installation complexe n'est requise. L'application utilise des modules JavaScript ES natifs purs :

```sh
# 1. Cloner le dépôt
git clone https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper.git
cd Escalier-Oh-Hell-Score-Keeper

# 2. Démarrer le serveur local
npm run serve
# ou directement avec Python :
# python -m http.server 8000
```

Ouvrez ensuite l'URL affichée (ex. `http://localhost:8000`) dans votre navigateur ou installez-la comme PWA sur votre smartphone.

---

## 🧪 Tests & Qualité

```sh
npm install            # Outils de dev uniquement (Playwright)
npm test               # Tests unitaires purs (Node test runner)
npm run test:e2e       # Tests E2E automatisés (Playwright)
npm run test:all       # Exécution de l'ensemble des tests
```

- **Tests unitaires** : moteur de calcul des scores, rotation du donneur, intégrité du cache offline du Service Worker, compression/décompression URL, export CSV.
- **Tests navigateurs** : cycle complet des manches, flux de saisie, verrouillage du contrat interdit, restauration hors-ligne.

---

## 🏗️ Structure du Code

```
Escalier-Oh-Hell-Score-Keeper/
├── assets/             # Polices locales (Fraunces, Instrument Sans) et icônes
├── docs/screenshots/   # Captures d'écran multilingues (en, fr, de, es, it, pt)
├── src/
│   ├── model.js        # Moteur logique pur (scores, rotations, validations)
│   ├── store.js        # Gestionnaire d'état réactif et actions
│   ├── i18n.js         # Moteur de traduction et pluriels Intl
│   ├── locales/        # Dictionnaires de traduction (fr, en, de, es, it, pt)
│   ├── share.js        # Compression URL (deflate-raw, base64url)
│   ├── export.js       # Formateurs d'export CSV et JSON
│   ├── dom.js          # Constructeur DOM sécurisé sans innerHTML
│   └── views/          # Vues modulaires (play, stairs, board, chart, setup...)
├── styles/app.css      # Feuille de style CSS moderne (variables, thèmes)
├── sw.js               # Service Worker PWA avec cache adressé par contenu
└── tools/              # Scripts de maintenance (serveur, build du SW, captures)
```

---

## 📜 Licence & Crédits

- **Code source** : sous licence [MIT](LICENSE).
- **Auteur** : **Erwin Mayer** ([github.com/mayerwin](https://github.com/mayerwin)).
- **Typographies** : [Fraunces](https://fonts.google.com/specimen/Fraunces) et [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) sous licence SIL Open Font License.
- **Inspiration** : inspiré des règles traditionnelles de l'Escalier et d'[oh-hell-score](https://github.com/bdhoine/oh-hell-score).

<div align="center">
<sub>Fait avec passion pour les joueurs de cartes autour de la table. 🃏✨</sub>
</div>
