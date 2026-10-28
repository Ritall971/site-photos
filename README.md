# Rebecca FAVA — Photographe

Site portfolio : galerie photo, calendrier de disponibilités relié à Google Agenda, et formulaire de contact (prise de rendez-vous ou demande d'information).

Site statique (HTML, CSS, JavaScript), sans compilation : il suffit d'ouvrir `index.html` ou d'héberger le dossier tel quel (GitHub Pages, Netlify…).

## Contenu

| Fichier | Rôle |
|---|---|
| `config.js` | **Tout ce qui se personnalise** : textes, coordonnées, photos, agenda, jours de repos |
| `index.html` | Structure de la page |
| `style.css` | Thème sombre et mise en page |
| `script.js` | Galerie, calendrier, formulaire |
| `google-apps-script/` | Script Google qui reçoit les demandes et gère les rendez-vous |
| `photos/` | Tes photos (à créer), référencées dans `config.js` |

## Fonctionnement

- **Galerie** : filtres par catégorie, affichage plein écran avec navigation au clavier.
- **Disponibilités** : le calendrier lit l'agenda Google « Photos » (mode « disponibilités seulement », les noms des clients restent privés).
  - événement sur la journée entière, ou au moins 6 h de rendez-vous → *Réservé*
  - rendez-vous plus courts → *Quelques créneaux*
  - des dates peuvent aussi être ajoutées à la main dans `config.js`
- **Contact** :
  - *Demande d'information* → email à la photographe, « Répondre » écrit directement au client.
  - *Prise de rendez-vous* → email avec boutons **Confirmer** / **Refuser**. À la confirmation, l'événement est créé dans Google Agenda, le client reçoit un email et le site affiche le jour comme occupé.

## Mise en place

1. **Agenda Google** : créer un agenda dédié, le rendre public en « disponibilités seulement », créer une clé API Google Calendar, puis renseigner `googleAgenda` dans `config.js`.
2. **Script des demandes** : suivre les étapes en haut de `google-apps-script/Code.gs`, puis coller l'URL `/exec` obtenue dans `urlScriptGoogle` (`config.js`).
3. **Photos** : déposer les images dans `photos/` et mettre à jour la liste `photos` de `config.js`.

> La clé API Google est visible dans le code du site, c'est normal pour ce type de clé. Restreins-la dans Google Cloud à la seule « Google Calendar API » et à l'adresse de ton site.

## Mise en ligne avec GitHub Pages

Dans le dépôt GitHub : **Settings → Pages → Source : Deploy from a branch → Branch : `main` / `(root)` → Save**. Le site est publié en quelques minutes à l'adresse indiquée.
