# Guide : Configurer les variables d'environnement Firebase Functions via CLI

## Méthode moderne : Secrets Firebase (recommandé)

Firebase recommande maintenant d'utiliser les **secrets** pour les données sensibles (clés API, secrets). C'est la méthode la plus sécurisée.

### Étape 1 : Créer les secrets

Pour chaque variable sensible, créez un secret :

```bash
# Secrets Mailjet
echo -n "VOTRE_CLE_API_MAILJET" | firebase functions:secrets:set MAILJET_API_KEY
echo -n "VOTRE_SECRET_API_MAILJET" | firebase functions:secrets:set MAILJET_API_SECRET

# Secrets Stripe (si utilisé)
echo -n "VOTRE_CLE_SECRETE_STRIPE" | firebase functions:secrets:set STRIPE_SECRET_KEY
echo -n "VOTRE_SECRET_WEBHOOK_STRIPE" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Secrets PayPal (si utilisé)
echo -n "VOTRE_CLIENT_ID_PAYPAL" | firebase functions:secrets:set PAYPAL_CLIENT_ID
echo -n "VOTRE_CLIENT_SECRET_PAYPAL" | firebase functions:secrets:set PAYPAL_CLIENT_SECRET
```

### Étape 2 : Mettre à jour le code pour utiliser les secrets

Le code doit être modifié pour utiliser `runWith({ secrets: [...] })` au lieu de `functions.config()`.

## Méthode alternative : Variables d'environnement (plus simple)

Si vous préférez une méthode plus simple pour commencer, vous pouvez utiliser les variables d'environnement via la console Firebase (méthode recommandée par Firebase) ou utiliser temporairement `functions.config()` qui fonctionne encore jusqu'en mars 2026.

### Option A : Via la console Firebase (méthode recommandée)

1. Allez sur https://console.firebase.google.com/project/fluance-protected-content/functions/config
2. Ajoutez les variables dans l'interface

### Option B : Via CLI (méthode legacy, fonctionne jusqu'en mars 2026)

```bash
firebase functions:config:set mailjet.api_key="VOTRE_CLE"
firebase functions:config:set mailjet.api_secret="VOTRE_SECRET"
firebase functions:config:set stripe.secret_key="VOTRE_CLE_STRIPE"
firebase functions:config:set stripe.webhook_secret="VOTRE_SECRET_WEBHOOK"
```

Puis redéployez :
```bash
firebase deploy --only functions
```

