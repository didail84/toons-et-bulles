# Toons & Bulles

Toons & Bulles rassemble les dessins animés (Disney, Pixar, Warner, Cartoon, séries du Club Dorothée et de Récré A2…), les BD et les livres jeunesse : une fiche par titre avec affiche ou couverture, résumé en français et liens pour regarder gratuitement sur des sites légaux, et ta collection familiale (profils des enfants, vus / à voir, listes, sagas, prêts, scan des ISBN).

- **Gratuit et open source** (licence MIT), sans publicité ni compte à créer.
- **Hors ligne** pour le catalogue et ta collection ; Internet sert seulement pour les affiches, résumés et liens.
- **Tes données restent sur ton ordinateur.**
- **Chercher un livre** dans Google Livres et l'ajouter à ta base avec sa couverture.
- **Profils enfants** : âge, envies et « Ce soir, on fait quoi ? ».
- **Bandes-annonces et musique** : bande-annonce officielle (en VF quand elle existe) et extraits de 30 secondes de la bande originale.
- **Séries de livres à collectionner** : la liste des livres de chaque série (Monsieur Madame, Max et Lili, Babar, Cornebidouille, Astérix, Tintin…) à cocher « On l'a » et « Lu », les livres manquants à imprimer, et l'ajout de titres à la main ou depuis Google Livres.
- **Quiz** : un quiz de 10 questions se débloque quand un titre est vu ou lu (96 grands classiques avec un quiz sur l'histoire), quiz musical, quiz des chansons, étoiles, trophées et défi famille.

## Installer

Va dans **[Releases](https://github.com/didail84/toons-et-bulles/releases/latest)** et télécharge le fichier qui correspond à ton ordinateur :

| Ordinateur | Fichier |
|---|---|
| Windows 10 ou 11 | `ToonsEtBulles-x.y.z-win-x64.exe` |
| Mac Intel (jusqu'à 2020) | `ToonsEtBulles-x.y.z-mac-x64.dmg` |
| Mac Apple Silicon (M1, M2, M3, M4…) | `ToonsEtBulles-x.y.z-mac-arm64.dmg` |

macOS 12 (Monterey) ou plus récent est nécessaire.

### Windows
1. Double-clique sur le fichier `.exe`.
2. Si Windows affiche « Windows a protégé votre ordinateur » : clique sur **Informations complémentaires**, puis **Exécuter quand même**. Ce message apparaît parce que l'appli n'est pas signée par un certificat payant ; elle n'est pas dangereuse pour autant.
3. Suis l'installation. Un raccourci « Toons & Bulles » est créé sur le Bureau et dans le menu Démarrer.

### Mac
1. Ouvre le fichier `.dmg` et fais glisser **Toons & Bulles** dans le dossier **Applications**.
2. La première fois, dans Applications, fais **clic droit (ou Ctrl + clic) › Ouvrir**, puis **Ouvrir** dans la fenêtre qui s'affiche.
3. Si macOS refuse quand même (« l'app est endommagée ») : ouvre le Terminal et tape
   `xattr -cr "/Applications/Toons & Bulles.app"`, puis relance l'appli.

### Mises à jour
Au démarrage, l'appli regarde s'il existe une nouvelle version sur cette page et te propose de la télécharger. Ta collection est conservée.

### Récupérer une collection existante
Si tu utilisais déjà Toons & Bulles (ancienne version installée ou page Claude) : dans l'ancienne version, **Réglages › Exporter une sauvegarde**, puis dans la nouvelle, **Réglages › Restaurer une sauvegarde**.

## Passer d'un ordinateur à l'autre

Dans **Réglages**, « Exporter une sauvegarde » crée un fichier ; « Restaurer une sauvegarde » le recharge sur l'autre ordinateur ou sur ta page Claude.
La sauvegarde emporte aussi tes clés TMDB et Claude (si tu en as saisi) : garde ce fichier pour toi et ne le publie pas.

## Pour les curieux et les développeurs

L'appli est une page web (`app/index.html`) emballée avec [Electron](https://www.electronjs.org).

```bash
npm install          # une seule fois
npm start            # lancer l'appli
npm run dist:win     # fabriquer l'installateur Windows
npm run dist:mac     # fabriquer l'installateur Mac (sur un Mac)
```

Les installateurs officiels sont fabriqués automatiquement par GitHub Actions (`.github/workflows/release.yml`) à chaque nouvelle étiquette de version :

```bash
npm version patch    # 1.0.0 → 1.0.1
git push --follow-tags
```

Electron est figé en version 43 : c'est la dernière qui fonctionne encore sur macOS 12.

## Licence

Code sous licence MIT — voir [LICENSE](LICENSE). Données du catalogue et bibliothèques tierces : voir [NOTICE.md](NOTICE.md).
