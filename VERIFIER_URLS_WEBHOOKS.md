# Vérification des URLs des webhooks

## 🔍 Comment obtenir les URLs exactes de vos webhooks

### Méthode 1 : Via Firebase CLI

```bash
# Lister toutes les fonctions déployées
firebase functions:list

# Obtenir l'URL d'une fonction spécifique
firebase functions:config:get
```

### Méthode 2 : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `fluance-protected-content`
3. Allez dans **Functions** (Fonctions)
4. Cliquez sur la fonction `webhookStripe` ou `webhookPayPal`
5. L'URL complète est affichée dans la section **Trigger**

### Méthode 3 : Format standard pour Firebase Functions v2

Pour les fonctions Firebase v2 déployées dans la région `europe-west1`, le format est :

```
https://europe-west1-[PROJECT-ID].cloudfunctions.net/[FUNCTION-NAME]
```

Pour votre projet `fluance-protected-content` :

- **Webhook Stripe** :
  ```
  https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe
  ```

- **Webhook PayPal** :
  ```
  https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal
  ```

## ✅ Vérification

### Vérifier que les fonctions sont déployées

```bash
firebase functions:list
```

Vous devriez voir :
- `webhookStripe` (europe-west1)
- `webhookPayPal` (europe-west1)

### Tester les URLs

Vous pouvez tester les URLs avec `curl` (elles devraient retourner une erreur car elles attendent des données spécifiques) :

```bash
# Test webhook Stripe
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe

# Test webhook PayPal
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal
```

Si vous obtenez une réponse (même une erreur), c'est que l'URL est correcte.

## 🔐 Sécurité

⚠️ **Important** : Ces URLs sont publiques mais doivent être configurées dans Stripe/PayPal Dashboard pour être sécurisées. Les webhooks vérifient les signatures des requêtes.

## 📝 Configuration dans Stripe/PayPal

Utilisez ces URLs exactes lors de la configuration des webhooks dans les dashboards Stripe et PayPal.

Voir `CONFIGURATION_WEBHOOKS_COMPLETE.md` pour les instructions détaillées.
