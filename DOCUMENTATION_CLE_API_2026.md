# Documentation : Renouvellement et Sécurisation de la Clé API Firebase (Février 2026)

## Problème rencontré
L'ancienne clé API Firebase était expirée, empêchant l'authentification des utilisateurs (Erreur 400 : "API key expired").

## Solution implémentée

### 1. Renouvellement de la clé
Une nouvelle clé API a été générée dans la console Google Cloud / Firebase.
- **Nouvelle clé (partielle)** : `AIzaSyCIf...`
- **Configuration locale** : Mise à jour du fichier `.env` avec la nouvelle clé.

### 2. Correction du Frontend (GitHub Pages)
Le site étant déployé via GitHub Pages, la clé est injectée lors du build via les secrets GitHub.
- **Action effectuée** : Mise à jour de la logique dans `src/assets/js/firebase-auth.njk` pour forcer l'utilisation de la Cloud Function pour l'envoi des liens de connexion, garantissant que les emails partent via Mailjet et contiennent le lien corrigé.

### 3. Correction du Backend (Cloud Functions)
L'Admin SDK de Firebase utilisait par défaut une clé interne projet qui pouvait être l'ancienne.
- **Action effectuée** : Patch de la fonction `sendSignInLinkViaMailjet` dans `functions/index.js`.
- **Sécurisation** : La nouvelle clé API est stockée dans **Firebase Secrets** sous le nom `WEB_API_KEY`. Elle n'est **JAMAIS** écrite en dur dans le code source.
- **Logique de patch** : La fonction intercepte le lien généré par Firebase et remplace dynamiquement l'ancienne clé par la nouvelle avant l'envoi de l'email.

### 4. Sécurisation de la clé (Console Google Cloud)
La nouvelle clé a été restreinte pour éviter tout usage abusif :
- **Restrictions d'application** : Limitée aux domaines `fluance.io`, `fluance-protected-content.web.app`, `cedric-v.github.io` et `localhost`.
- **Restrictions d'API** : Limitée aux services strictement nécessaires :
    - Identity Toolkit API
    - Token Service API (pour le rafraîchissement des tokens)
    - Cloud Firestore API
    - Firebase Installations API
    - Cloud Functions API

## Maintenance
Si la clé doit être renouvelée à l'avenir :
1. Mettre à jour le secret GitHub `FIREBASE_API_KEY`.
2. Mettre à jour le secret Firebase via CLI : `echo -n "NOUVELLE_CLE" | firebase functions:secrets:set WEB_API_KEY`.
3. Redéployer les fonctions : `firebase deploy --only functions`.
