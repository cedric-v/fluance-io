# Guide : Configurer la configuration Firebase (Sécurisé)

## 🔧 Nouvelle méthode : Variables d'environnement

Depuis la mise à jour de sécurité, la configuration Firebase n'est plus écrite en dur dans les fichiers JavaScript. Elle est injectée dynamiquement lors de la génération du site (build) via Eleventy.

### Étape 1 : Créer ou mettre à jour votre fichier `.env` local

À la racine du projet `fluance-io`, créez un fichier `.env` (s'il n'existe pas) et ajoutez-y votre configuration complète :

```bash
# Configuration Firebase (Copier depuis la console Firebase)
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=fluance-protected-content.firebaseapp.com
FIREBASE_PROJECT_ID=fluance-protected-content
FIREBASE_STORAGE_BUCKET=fluance-protected-content.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=173938686776
FIREBASE_APP_ID=1:173938686776:web:891caf76098a42c3579fcd
```

### Étape 2 : Configurer GitHub pour le déploiement

Pour que le site fonctionne une fois déployé sur GitHub Pages, vous devez ajouter ces mêmes variables dans les **Secrets** de votre dépôt GitHub :

1. Allez dans **Settings > Secrets and variables > Actions**.
2. Cliquez sur **New repository secret**.
3. Ajoutez chacune des variables ci-dessus (ex: `FIREBASE_API_KEY`, etc.).

### Étape 3 : Fonctionnement technique

Le projet utilise maintenant :
- Un shortcode Eleventy `{% firebaseConfig %}` (défini dans `eleventy.config.js`) qui lit ces variables.
- Ce shortcode injecte la configuration dans `window.FLUANCE_FIREBASE_CONFIG` via le layout `base.njk`.
- Les scripts du site (comme l'authentification ou le paiement) utilisent cette variable globale au lieu de valeurs en dur.

## ⚠️ Important : Restrictions de clé

Même si la clé est maintenant gérée par variables d'environnement, elle finit par être visible dans le code source du navigateur (c'est inhérent aux applications web).

**Vous DEVEZ restreindre votre clé API** dans la [Console Google Cloud](https://console.cloud.google.com/apis/credentials) :
1. Sélectionnez la clé API utilisée.
2. Sous **Restrictions relatives aux applications**, choisissez **Référents HTTP**.
3. Ajoutez vos domaines autorisés :
   - `fluance.io/*`
   - `*.fluance.io/*`
   - `cedricv.com/*` (si partagée)
   - `localhost:8080/*` (pour le développement local)
4. Sous **Restrictions relatives aux API**, limitez la clé aux services utilisés :
   - Identity Toolkit API
   - Cloud Firestore API
   - Cloud Functions API

## 📋 Où trouver ces valeurs ?

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Cliquez sur **Paramètres du projet** (icône ⚙️).
4. La configuration se trouve en bas de page dans la section **Vos applications**.


