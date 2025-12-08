# Guide : Migration vers les secrets Firebase (méthode moderne)

Ce guide explique comment migrer vos variables d'environnement vers les secrets Firebase, la méthode moderne qui fonctionnera après mars 2026.

## ✅ Code mis à jour

Le code a été mis à jour pour utiliser les secrets Firebase au lieu de `functions.config()`. Toutes les fonctions utilisent maintenant `runWith({ secrets: [...] })` et accèdent aux secrets via `process.env.SECRET_NAME`.

## 📋 Étapes de migration

### Étape 1 : Créer les secrets Firebase

Migrez vos variables existantes vers les secrets Firebase :

```bash
# Récupérer les valeurs actuelles
firebase functions:config:get

# Créer les secrets Mailjet
# ⚠️ Remplacez les valeurs par vos vraies clés API Mailjet
echo -n "VOTRE_CLE_API_MAILJET" | firebase functions:secrets:set MAILJET_API_KEY
echo -n "VOTRE_SECRET_API_MAILJET" | firebase functions:secrets:set MAILJET_API_SECRET

# Créer les secrets Stripe (si vous les utilisez)
# echo -n "VOTRE_CLE_STRIPE" | firebase functions:secrets:set STRIPE_SECRET_KEY
# echo -n "VOTRE_SECRET_WEBHOOK" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Créer les secrets PayPal (si vous les utilisez)
# echo -n "VOTRE_CLIENT_ID" | firebase functions:secrets:set PAYPAL_CLIENT_ID
# echo -n "VOTRE_CLIENT_SECRET" | firebase functions:secrets:set PAYPAL_CLIENT_SECRET
```

**Note** : Remplacez les valeurs par vos vraies clés API. Utilisez `echo -n` pour éviter d'ajouter un saut de ligne.

### Étape 2 : Vérifier que les secrets sont créés

```bash
firebase functions:secrets:access MAILJET_API_KEY
```

Cela devrait afficher votre clé API (sans le saut de ligne).

### Étape 3 : Redéployer les fonctions

Une fois les secrets créés, redéployez les fonctions :

```bash
firebase deploy --only functions
```

Firebase va automatiquement :
1. Récupérer les secrets configurés
2. Les injecter dans les fonctions via `process.env`
3. Les rendre disponibles uniquement aux fonctions qui les déclarent dans `runWith({ secrets: [...] })`

### Étape 4 : Tester les fonctions

Testez que tout fonctionne correctement :

1. **Test de création de token** : Utilisez la fonction `createUserToken` via la console Firebase
2. **Test de webhook** : Envoyez un test depuis Stripe/PayPal
3. **Vérifier les logs** : `firebase functions:log`

### Étape 5 : Supprimer les anciennes variables (optionnel)

Une fois que tout fonctionne avec les secrets, vous pouvez supprimer les anciennes variables :

```bash
firebase functions:config:unset mailjet
firebase functions:config:unset stripe
firebase functions:config:unset paypal
```

## 🔒 Sécurité des secrets

Les secrets Firebase sont :
- ✅ **Chiffrés** au repos
- ✅ **Accessibles uniquement** aux fonctions qui les déclarent
- ✅ **Non visibles** dans les logs par défaut
- ✅ **Versionnés** (vous pouvez avoir plusieurs versions)

## 📝 Structure du code mis à jour

### Avant (méthode dépréciée)
```javascript
const mailjetConfig = {
  api_key: functions.config().mailjet?.api_key,
  api_secret: functions.config().mailjet?.api_secret,
};

exports.myFunction = functions.https.onRequest(async (req, res) => {
  // Utilise mailjetConfig.api_key
});
```

### Après (méthode moderne)
```javascript
exports.myFunction = functions.runWith({
  secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
}).https.onRequest(async (req, res) => {
  // Utilise process.env.MAILJET_API_KEY
});
```

## 🎯 Avantages de la migration

1. **Fonctionne après mars 2026** : Pas de problème de dépréciation
2. **Plus sécurisé** : Secrets chiffrés et accessibles uniquement aux fonctions déclarées
3. **Meilleure gestion** : Versionning des secrets, rotation facile
4. **Performance** : Pas de surcharge de `functions.config()`

## ⚠️ Notes importantes

- Les secrets doivent être créés **avant** de déployer les fonctions
- Si un secret n'existe pas, la fonction échouera au démarrage
- Les secrets sont **sensibles à la casse** : `MAILJET_API_KEY` ≠ `mailjet_api_key`
- Vous pouvez avoir plusieurs versions d'un secret et choisir laquelle utiliser

## 🆘 Dépannage

### Erreur : "Secret not found"
- Vérifiez que le secret existe : `firebase functions:secrets:access SECRET_NAME`
- Vérifiez l'orthographe exacte du nom du secret
- Assurez-vous que le secret est créé dans le bon projet Firebase

### Erreur : "Permission denied"
- Vérifiez que vous avez les permissions nécessaires sur le projet
- Vérifiez que vous êtes connecté : `firebase login:list`

### Les fonctions ne démarrent pas
- Vérifiez les logs : `firebase functions:log`
- Vérifiez que tous les secrets déclarés dans `runWith({ secrets: [...] })` existent

## 📚 Documentation officielle

- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Migration Guide](https://firebase.google.com/docs/functions/config-env#migrate-to-dotenv)

