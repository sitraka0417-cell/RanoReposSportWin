# Rano & Repos & Sport pour Windows

Pauses régulières, rappels pour boire de l'eau et suivi du sport, avec synchronisation Google (mêmes données que l'application Android).
Application Electron, installateur Windows (`.exe`) construit automatiquement par GitHub Actions.

## Liens à partager

| | Lien |
|---|---|
| **Téléchargement direct** | https://github.com/sitraka0417-cell/RanoReposSportWin/releases/latest/download/RanoReposSport-Setup.exe |
| **Page de téléchargement** | https://sitraka0417-cell.github.io/RanoReposSportWin/telecharger.html |
| Toutes les versions | https://github.com/sitraka0417-cell/RanoReposSportWin/releases |

Le lien « direct » pointe toujours vers la dernière version publiée : il n'a jamais besoin d'être changé.

## Mise en ligne (une seule fois)

1. Sur GitHub, créez un dépôt **vide** nommé `RanoReposSportWin` (compte `sitraka0417-cell`).
2. Envoyez-y ce dossier (voir les commandes Termux plus bas). Dès le premier envoi, l'action **Installateur Windows Rano Repos Sport** se lance et publie la version `v1.0.0` dans *Releases*.
3. Activez la page web : **Settings → Pages → Build and deployment → Deploy from a branch → `main` → dossier `/docs` → Save**.
4. Configurez la connexion Google (section suivante).

### Commandes Termux

```bash
cd ~ && rm -rf tmp-rrs && mkdir tmp-rrs
unzip -o /storage/emulated/0/Download/RanoReposSportWin.zip -d ~/tmp-rrs
cd ~/tmp-rrs/RanoReposSportWin && pwd
git init -b main
git config user.name "sitraka0417-cell"
git config user.email "sitraka0417@gmail.com"
git add -A
git commit -m "Rano & Repos & Sport pour Windows 1.0.0"
git remote add origin https://github.com/sitraka0417-cell/RanoReposSportWin.git
git push -u origin main
```

## Connexion Google et synchronisation (Firebase)

L'application utilise le projet Firebase `ranorepo-sitraka` (celui de l'application Android).

1. **Domaine autorisé** : Firebase → Authentication → Paramètres → Domaines autorisés → ajoutez `sitraka0417-cell.github.io`.
2. **Clé API** : `config.json` contient déjà la clé de l'application Android. Si la connexion échoue avec un message de clé refusée : Firebase → Paramètres du projet → *Vos applications* → **Ajouter une application Web**, puis copiez `apiKey` et `appId` dans `config.json`.
3. **Règles Firestore** (Firestore → Règles). La collection `sports` doit être autorisée comme `repos` et `waters` :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Fonctionnement : le bouton « Se connecter avec Google » ouvre `docs/auth.html` dans le navigateur ; après la connexion, la page renvoie les jetons à l'application par une adresse locale (`127.0.0.1`, protégée par un jeton `state` aléatoire).

## Publier une mise à jour

1. Changez `"version"` dans `package.json` (ex. `1.0.1`).
2. Envoyez sur `main` : l'action construit l'installateur et publie la nouvelle version.
3. Les utilisateurs réinstallent par-dessus : leurs données sont conservées. Dans *Réglages → À propos*, « Vérifier les mises à jour » signale la nouvelle version.

## Développement

```bash
npm install
npm start        # construit l'interface puis lance l'application
npm run dist     # produit release/RanoReposSport-Setup.exe
```

Structure : `main.js` (fenêtre, zone de notification, connexion), `preload.js` (pont sécurisé), `src/` (interface et moteur des chronomètres), `renderer/` (HTML et CSS), `docs/` (pages GitHub Pages).

## Fonctionnalités

- **Repos** : durées au choix, cycle automatique travail / repos, alarme, historique jour / semaine / mois / année.
- **Eau** : objectif de verres, taille du verre (125 ml par défaut), rappels automatiques.
- **Sport** : objectif hebdomadaire (150 min par défaut), chronomètre ou compte à rebours, répartition par jour (automatique ou personnalisée), série de jours actifs.
- **Zone de notification**, notifications Windows, alarme sonore, lancement avec Windows.
- **Sécurité** : code PIN, verrouillage automatique (inactivité, session Windows), Ctrl+L.
- Raccourcis : `Ctrl+1` à `Ctrl+4` pour changer de section.
