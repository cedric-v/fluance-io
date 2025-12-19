# Relance automatique pour opt-ins non confirmés

## 📋 Vue d'ensemble

Ce système envoie automatiquement une **relance unique** aux utilisateurs qui se sont inscrits mais n'ont pas confirmé leur email (double opt-in) après **3-4 jours**.

## ✅ Conformité RGPD

Cette relance est **conforme au RGPD** car :
- ✅ L'utilisateur a déjà donné son consentement initial (inscription)
- ✅ La relance sert uniquement à finaliser ce consentement
- ✅ Une seule relance est envoyée (pas de spam)
- ✅ Option claire de ne plus recevoir de relances
- ✅ Arrêt automatique après expiration du token (7 jours)

## 🔧 Fonctionnement technique

### Fonction scheduled

La fonction `sendOptInReminders` s'exécute **quotidiennement à 9h** (Europe/Paris) et :

1. **Récupère** tous les opt-ins non confirmés (`confirmed: false`) qui n'ont pas encore reçu de relance (`reminderSent: false`)
2. **Vérifie** que :
   - Le token n'a pas expiré (7 jours)
   - L'inscription date de 3-4 jours
3. **Envoie** l'email de relance avec le même token de confirmation
4. **Marque** `reminderSent: true` et `reminderSentAt` pour éviter les relances multiples

### Structure Firestore

Les documents dans `newsletterConfirmations` contiennent maintenant :

```javascript
{
  email: "user@example.com",
  name: "Prénom",
  createdAt: Timestamp,
  expiresAt: Timestamp, // 7 jours après création
  confirmed: false,
  reminderSent: false, // Nouveau champ
  reminderSentAt: Timestamp, // Nouveau champ (ajouté lors de la relance)
  sourceOptin: "2pratiques" | "5joursofferts"
}
```

### Template email

Le template `relance-confirmation-optin.mjml` est utilisé pour générer l'email de relance. Il contient :
- Un message personnalisé selon le type d'opt-in (2 pratiques ou 5 jours)
- Le lien de confirmation (même token, valide 7 jours)
- La date d'expiration du lien
- Une option claire pour ignorer l'email

## 📊 Index Firestore requis

Pour que la requête fonctionne efficacement, un **index composite** est nécessaire dans Firestore :

**Collection** : `newsletterConfirmations`

**Champs indexés** :
- `confirmed` (Ascending)
- `reminderSent` (Ascending)

### Créer l'index

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `fluance-protected-content`
3. Allez dans **Firestore Database** > **Indexes**
4. Cliquez sur **Créer un index**
5. Collection ID : `newsletterConfirmations`
6. Ajoutez les champs :
   - `confirmed` (Ascending)
   - `reminderSent` (Ascending)
7. Cliquez sur **Créer**

**OU** utilisez le lien d'erreur qui apparaîtra lors de la première exécution de la fonction.

## 🚀 Déploiement

### 1. Déployer la fonction

```bash
firebase deploy --only functions:sendOptInReminders
```

### 2. Vérifier le déploiement

```bash
firebase functions:log --only sendOptInReminders
```

### 3. Tester manuellement (optionnel)

Pour tester la fonction manuellement avant d'attendre le prochain run scheduled :

```bash
# Via Firebase Console > Functions > sendOptInReminders > Test
# Ou via gcloud CLI
gcloud functions call sendOptInReminders --region=europe-west1
```

## 📈 Monitoring

### Logs à surveiller

- `📧 Starting scheduled job for opt-in reminders` : Début de l'exécution
- `📋 Found X unconfirmed opt-ins to check` : Nombre d'opt-ins à vérifier
- `✅ Reminder sent to email (source, X days after signup)` : Relance envoyée
- `⏰ Token has expired, skipping reminder` : Token expiré (normal)
- `📊 Reminders summary: X sent, Y skipped, Z errors` : Résumé

### Métriques importantes

- **Taux de confirmation après relance** : Comparer les confirmations avant/après relance
- **Taux d'erreurs** : Surveiller les erreurs d'envoi
- **Temps de traitement** : Vérifier que la fonction s'exécute rapidement

## 🔍 Dépannage

### La fonction ne s'exécute pas

1. Vérifier que la fonction est bien déployée
2. Vérifier les logs Firebase Functions
3. Vérifier que le scheduler est actif dans Firebase Console

### Les relances ne sont pas envoyées

1. Vérifier que les opt-ins ont bien `reminderSent: false`
2. Vérifier que les opt-ins ont entre 3-4 jours
3. Vérifier que les tokens ne sont pas expirés
4. Vérifier les logs pour les erreurs Mailjet

### Erreur d'index Firestore

Si vous voyez une erreur d'index manquant :
1. Cliquez sur le lien dans l'erreur
2. Ou créez l'index manuellement (voir section "Index Firestore requis")

## 📝 Modifications apportées

### Fichiers modifiés

1. **`functions/index.js`** :
   - Ajout du champ `reminderSent: false` lors de la création des tokens
   - Nouvelle fonction `sendOptInReminders` (scheduled)

2. **`src/emails/relance-confirmation-optin.mjml`** :
   - Nouveau template d'email de relance

### Fichiers générés

- `functions/emails/relance-confirmation-optin.html` : Template HTML compilé

## 🎯 Résultat attendu

Après déploiement :
- Les utilisateurs non confirmés recevront **automatiquement** une relance 3-4 jours après leur inscription
- **Une seule relance** sera envoyée par opt-in
- Le taux de confirmation devrait **augmenter** significativement
- Conformité RGPD **maintenue** avec une seule relance raisonnable

## 📚 Ressources

- [Firebase Functions Scheduler](https://firebase.google.com/docs/functions/schedule-functions)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- [RGPD et consentement](https://www.cnil.fr/fr/le-consentement)
