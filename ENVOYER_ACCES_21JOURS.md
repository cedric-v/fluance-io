# Guide : Envoyer les accès au cours 21 jours via Mailjet

Ce guide vous explique comment envoyer les emails d'accès au cours en 21 jours à vos clients via Mailjet.

## 📋 Prérequis

1. **Secrets Mailjet configurés** dans Firebase Functions
2. **Compte admin** configuré dans Firebase Auth
3. **Firebase Functions déployées**

## 🔧 Étape 1 : Vérifier la configuration Mailjet

Vérifiez que les secrets Mailjet sont configurés :

```bash
firebase functions:secrets:access MAILJET_API_KEY
firebase functions:secrets:access MAILJET_API_SECRET
```

Si les secrets n'existent pas, configurez-les :

```bash
echo -n "VOTRE_CLE_API_MAILJET" | firebase functions:secrets:set MAILJET_API_KEY
echo -n "VOTRE_SECRET_API_MAILJET" | firebase functions:secrets:set MAILJET_API_SECRET
```

Puis redéployez les fonctions :

```bash
firebase deploy --only functions
```

## 👤 Étape 2 : Configurer un compte admin

Pour utiliser la fonction `createUserToken`, vous devez avoir un compte Firebase Auth avec le claim `admin: true`.

### Option A : Via Firebase CLI

```bash
# Trouver votre User ID dans Firebase Console > Authentication
firebase auth:users:set-claims VOTRE_USER_ID --claims '{"admin": true}'
```

### Option B : Via Firebase Console

1. Allez dans [Firebase Console](https://console.firebase.google.com/) > **Authentication**
2. Trouvez votre utilisateur (ou créez-en un)
3. Notez l'**UID** de l'utilisateur
4. Utilisez la commande CLI ci-dessus

## 📧 Étape 3 : Envoyer les accès

### Méthode 1 : Via le script Node.js (recommandé)

Utilisez le script `send-access-21jours.js` fourni :

```bash
node send-access-21jours.js
```

Le script vous demandera :
- Les emails des clients (un par ligne)
- La durée de validité du token (défaut : 365 jours pour l'accès complet)

### Méthode 2 : Via Firebase Console (méthode manuelle)

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Allez dans **Firestore Database**
4. Créez un document dans la collection `registrationTokens` :
   - **Document ID** : Générez un ID aléatoire de 32 caractères hex
   - **Champs** :
     - `email` (string) : L'email du client
     - `product` (string) : `21jours` ⚠️ **IMPORTANT : exactement "21jours"**
     - `createdAt` (timestamp) : Maintenant
     - `expiresAt` (timestamp) : Dans 365 jours (ou la durée souhaitée)
     - `used` (boolean) : `false`
5. Copiez l'ID du document (c'est le token)
6. Envoyez manuellement l'email avec le lien : `https://fluance.io/creer-compte?token=TOKEN`

### Méthode 3 : Via Firebase Functions (programmatique)

Si vous avez un compte admin configuré, vous pouvez appeler la fonction directement depuis la console du navigateur sur votre site :

```javascript
// Se connecter d'abord avec votre compte admin
const createUserToken = firebase.functions().httpsCallable('createUserToken');

// Envoyer l'accès à un client
const result = await createUserToken({
  email: 'client@example.com',
  product: '21jours',
  expirationDays: 365 // 1 an pour l'accès complet
});

console.log('Token créé:', result.data.token);
console.log('Email envoyé à:', 'client@example.com');
```

## 📝 Informations nécessaires

Pour envoyer les accès, j'ai besoin de :

1. **Les emails des 2 clients** :
   - Client 1 : `?`
   - Client 2 : `?`

2. **Durée de validité du token** (défaut : 365 jours pour l'accès complet au cours 21 jours)

3. **Confirmation que les secrets Mailjet sont configurés** :
   - Si oui, utilisez la méthode 1 (script Node.js) ou la méthode 3 (interface HTML)
   - Si non, je vous guiderai pour les configurer

## 🚀 Méthodes disponibles

### Méthode 1 : Script Node.js (recommandé pour envoi automatique)

```bash
node send-access-21jours.js
```

Ce script :
- ✅ Crée les tokens dans Firestore
- ✅ Génère les URLs de création de compte
- ⚠️ N'envoie PAS automatiquement les emails (nécessite Mailjet configuré)

### Méthode 2 : Interface HTML (recommandé pour envoi via Mailjet)

1. Ouvrez `send-email-via-function.html` dans votre navigateur
2. Connectez-vous avec votre compte admin
3. Entrez les emails des clients
4. Cliquez sur "Envoyer les accès"

Cette méthode :
- ✅ Crée les tokens dans Firestore
- ✅ Envoie automatiquement les emails via Mailjet
- ✅ Nécessite un compte admin configuré

## 🔓 Étape 4 : Donner l'accès complet immédiat (optionnel)

Si vous souhaitez que les clients aient accès à **tous les jours (0-22) immédiatement** au lieu de l'accès progressif jour par jour, utilisez le script `grant-full-access-21jours.js` :

```bash
# ⚠️ IMPORTANT : Les clients doivent d'abord avoir créé leur compte
node grant-full-access-21jours.js email1@example.com email2@example.com
```

Ce script :
- ✅ Met à jour la `registrationDate` des utilisateurs (il y a 22 jours)
- ✅ Donne accès immédiat à tous les jours (0-22)
- ✅ Ajoute un flag `fullAccessGranted: true` pour traçabilité

**Note** : Si vous n'exécutez pas ce script, les clients auront un accès progressif normal (jour 0 immédiatement, puis jour 1 le lendemain, etc.).

## ✅ Vérification

Après l'envoi, vérifiez que :

1. ✅ Les emails sont bien arrivés dans les boîtes de réception
2. ✅ Les tokens sont créés dans Firestore (`registrationTokens`)
3. ✅ Les clients peuvent créer leur compte via le lien reçu
4. ✅ Si vous avez exécuté `grant-full-access-21jours.js`, les clients ont accès à tous les jours

## 🆘 Dépannage

### Les emails ne sont pas envoyés

1. Vérifiez les logs Firebase Functions : `firebase functions:log`
2. Vérifiez que les secrets Mailjet sont corrects
3. Vérifiez que le domaine `fluance.io` est vérifié dans Mailjet

### Erreur "Admin access required"

1. Vérifiez que votre compte a le claim `admin: true`
2. Vérifiez que vous êtes bien connecté avec ce compte

### Les emails arrivent en spam

1. Vérifiez la configuration SPF/DKIM/DMARC dans Mailjet
2. Vérifiez que le domaine est bien vérifié

