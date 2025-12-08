# Configuration sécurisée des variables d'environnement Firebase

## ⚠️ IMPORTANT : Sécurité

**JAMAIS** de clés API, secrets ou mots de passe dans le code source !  
Ce projet est public sur GitHub. Toutes les informations sensibles doivent être configurées via les variables d'environnement Firebase.

## Méthode recommandée : Variables d'environnement Firebase (moderne)

Firebase Functions supporte les variables d'environnement depuis la version 2. Cette méthode est la plus sécurisée et la plus simple.

### Étape 1 : Configurer via la console Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Dans le menu de gauche, cliquez sur **Functions**
4. Cliquez sur l'onglet **Configuration**
5. Cliquez sur **Ajouter une variable** ou **Add variable**

### Étape 2 : Ajouter les variables nécessaires

Ajoutez les variables suivantes une par une :

#### Variables Mailjet (obligatoires)
- **Nom** : `MAILJET_API_KEY`  
  **Valeur** : Votre clé API Mailjet

- **Nom** : `MAILJET_API_SECRET`  
  **Valeur** : Votre secret API Mailjet

#### Variables Stripe (si vous utilisez Stripe)
- **Nom** : `STRIPE_SECRET_KEY`  
  **Valeur** : Votre clé secrète Stripe (commence par `sk_`)

- **Nom** : `STRIPE_WEBHOOK_SECRET`  
  **Valeur** : Le secret de signature de votre webhook Stripe (commence par `whsec_`)

#### Variables PayPal (si vous utilisez PayPal)
- **Nom** : `PAYPAL_CLIENT_ID`  
  **Valeur** : Votre Client ID PayPal

- **Nom** : `PAYPAL_CLIENT_SECRET`  
  **Valeur** : Votre Client Secret PayPal

### Étape 3 : Redéployer les fonctions

Après avoir ajouté les variables, redéployez les fonctions :

```bash
firebase deploy --only functions
```

## Méthode alternative : Configuration legacy (non recommandée)

Si vous préférez utiliser l'ancienne méthode via la CLI :

```bash
firebase functions:config:set mailjet.api_key="VOTRE_API_KEY"
firebase functions:config:set mailjet.api_secret="VOTRE_API_SECRET"
firebase functions:config:set stripe.secret_key="VOTRE_SECRET_KEY"
firebase functions:config:set stripe.webhook_secret="VOTRE_WEBHOOK_SECRET"
```

⚠️ **Note** : Cette méthode est dépréciée. Utilisez plutôt les variables d'environnement via la console.

## Vérification

Pour vérifier que les variables sont bien configurées :

```bash
# Voir toutes les variables d'environnement
firebase functions:config:get

# Ou via la console Firebase > Functions > Configuration
```

## Comment le code accède aux variables

Le code dans `functions/index.js` utilise automatiquement les variables d'environnement :

```javascript
// Le code vérifie d'abord process.env (variables d'environnement modernes)
// Puis functions.config() (méthode legacy)
const mailjetConfig = functions.config().mailjet || {
  api_key: process.env.MAILJET_API_KEY,
  api_secret: process.env.MAILJET_API_SECRET
};
```

## Sécurité du code source

✅ **Ce qui est SÉCURISÉ** :
- Les variables d'environnement ne sont **jamais** commitées dans Git
- Le fichier `.gitignore` exclut les fichiers `.env`
- Les secrets sont stockés uniquement dans Firebase (chiffrés)

✅ **Ce qui est dans le code (public)** :
- Seulement des noms de variables (`MAILJET_API_KEY`, etc.)
- Des valeurs d'exemple ou des placeholders (`"YOUR_API_KEY"`)
- Aucune vraie clé API ou secret

## Checklist avant de commiter

Avant de faire un commit, vérifiez que :

- [ ] Aucune clé API réelle n'est dans le code
- [ ] Aucun secret n'est dans le code
- [ ] Les fichiers `.env` sont dans `.gitignore`
- [ ] Les variables d'environnement sont configurées dans Firebase Console
- [ ] Les fonctions ont été redéployées après configuration

## En cas d'exposition accidentelle

Si vous avez accidentellement commité une clé API ou un secret :

1. **Révocation immédiate** : Révoquez la clé exposée dans le service concerné (Mailjet, Stripe, etc.)
2. **Génération d'une nouvelle clé** : Créez une nouvelle clé et configurez-la dans Firebase
3. **Nettoyage Git** : Utilisez `git filter-branch` ou contactez GitHub pour supprimer l'historique (si nécessaire)

## Support

Pour plus d'informations :
- [Documentation Firebase Functions - Variables d'environnement](https://firebase.google.com/docs/functions/config-env)
- [Bonnes pratiques de sécurité Firebase](https://firebase.google.com/docs/functions/best-practices)

