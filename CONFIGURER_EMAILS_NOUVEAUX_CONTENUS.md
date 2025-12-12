# Configuration : Emails automatiques pour nouveaux contenus

## Vue d'ensemble

Une fonction Firebase Scheduled (`sendNewContentEmails`) s'exécute **quotidiennement à 8h (Europe/Paris)** pour envoyer automatiquement des emails aux clients lorsqu'un nouveau contenu devient disponible.

## Fonctionnement

### Produit "21jours"
- **Fréquence** : Un email par jour (jours 1 à 21)
- **Calcul** : Basé sur le nombre de jours depuis `startDate` dans le produit de l'utilisateur
- **Jour 1** : Premier jour après l'achat
- **Jour 21** : 21ème jour après l'achat

### Produit "complet"
- **Fréquence** : Un email par semaine (semaines 1 à 14)
- **Calcul** : Basé sur le nombre de semaines depuis `startDate` dans le produit de l'utilisateur
- **Semaine 1** : Première semaine après l'achat
- **Semaine 14** : 14ème semaine après l'achat

## Structure Firestore

### Collection `contentEmailsSent`

Cette collection track les emails déjà envoyés pour éviter les doublons :

```
contentEmailsSent/
  ├── {userId}_21jours_day_{day}
  │   ├── userId: string
  │   ├── email: string
  │   ├── product: "21jours"
  │   ├── day: number (1-21)
  │   └── sentAt: Timestamp
  │
  └── {userId}_complet_week_{week}
      ├── userId: string
      ├── email: string
      ├── product: "complet"
      ├── week: number (1-14)
      └── sentAt: Timestamp
```

## Prérequis

### 1. Secrets Firebase configurés

Assurez-vous que les secrets Mailjet sont configurés :

```bash
echo -n "VOTRE_CLE_API_MAILJET" | firebase functions:secrets:set MAILJET_API_KEY
echo -n "VOTRE_SECRET_API_MAILJET" | firebase functions:secrets:set MAILJET_API_SECRET
```

### 2. Contenu dans Firestore

Les contenus doivent exister dans la collection `protectedContent` :

- **21jours** : Documents avec ID `21jours-jour-1` à `21jours-jour-21`
- **complet** : Documents avec ID `complet-week-1` à `complet-week-14`

### 3. Utilisateurs avec produits actifs

Les utilisateurs doivent avoir :
- Un document dans la collection `users`
- Un tableau `products` avec au moins un produit contenant `name` et `startDate`

## Déploiement

### 1. Déployer la fonction

```bash
firebase deploy --only functions:sendNewContentEmails
```

### 2. Vérifier le schedule

La fonction est configurée pour s'exécuter tous les jours à 8h (Europe/Paris).

Pour modifier l'horaire, éditez le paramètre `schedule` dans `functions/index.js` :

```javascript
schedule: '0 8 * * *', // Format cron : minute heure jour mois jour-semaine
```

**Exemples de schedules :**
- `'0 8 * * *'` : Tous les jours à 8h
- `'0 10 * * 1'` : Tous les lundis à 10h
- `'0 */6 * * *'` : Toutes les 6 heures

### 3. Activer Cloud Scheduler (si nécessaire)

Firebase Scheduled Functions utilisent Cloud Scheduler. Vérifiez que Cloud Scheduler est activé dans votre projet Google Cloud :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Allez dans **APIs & Services** > **Enabled APIs**
4. Cherchez "Cloud Scheduler API" et activez-le si nécessaire

## Test manuel

Pour tester la fonction sans attendre le schedule :

### Option 1 : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. Allez dans **Functions** > **sendNewContentEmails**
4. Cliquez sur **Run** (si disponible)

### Option 2 : Via Cloud Scheduler

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Allez dans **Cloud Scheduler**
3. Trouvez le job `sendNewContentEmails`
4. Cliquez sur **Run now**

### Option 3 : Créer une fonction callable de test

Vous pouvez créer une fonction callable qui appelle la même logique :

```javascript
exports.testSendNewContentEmails = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (request) => {
      // Vérifier l'authentification admin
      if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError('permission-denied', 'Admin access required');
      }
      
      // Appeler la même logique que la fonction scheduled
      // (copier le code de sendNewContentEmails)
    }
);
```

## Logs et monitoring

### Voir les logs

```bash
firebase functions:log --only sendNewContentEmails
```

### Logs dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Allez dans **Functions** > **sendNewContentEmails** > **Logs**

### Métriques importantes

La fonction log :
- `📊 Found X users to check` : Nombre d'utilisateurs traités
- `✅ Email sent to {email} for {product} {day/week}` : Emails envoyés avec succès
- `⏭️ Email already sent` : Emails ignorés (déjà envoyés)
- `⚠️ Content not found` : Contenu manquant dans Firestore
- `❌ Error` : Erreurs rencontrées

## Personnalisation des emails

Les templates d'emails sont dans la fonction `sendNewContentEmails` dans `functions/index.js`.

### Modifier le sujet

Cherchez `emailSubject` et modifiez le texte :

```javascript
const emailSubject = `Jour ${currentDay} de votre défi 21 jours - ${contentData.title || 'Nouveau contenu disponible'}`;
```

### Modifier le contenu HTML

Cherchez `emailHtml` et modifiez le template HTML.

### Utiliser des templates Mailjet

Pour utiliser des templates Mailjet au lieu de HTML inline :

1. Créez un template dans Mailjet
2. Remplacez `sendMailjetEmail` par un appel avec `TemplateID` :

```javascript
const emailPayload = {
  Messages: [{
    From: { Email: 'support@actu.fluance.io', Name: 'Fluance' },
    To: [{ Email: email }],
    TemplateID: 1234567, // ID de votre template Mailjet
    TemplateLanguage: true,
    Variables: {
      day: currentDay,
      title: contentData.title,
      link: 'https://fluance.io/membre/',
    },
  }],
};
```

## Dépannage

### Les emails ne sont pas envoyés

1. **Vérifier les logs** : `firebase functions:log --only sendNewContentEmails`
2. **Vérifier les secrets** : Les secrets Mailjet sont-ils configurés ?
3. **Vérifier le schedule** : Le job Cloud Scheduler est-il actif ?
4. **Vérifier les contenus** : Les documents `protectedContent` existent-ils ?
5. **Vérifier les utilisateurs** : Les utilisateurs ont-ils des produits avec `startDate` ?

### Emails envoyés en double

La collection `contentEmailsSent` devrait empêcher les doublons. Si cela se produit :

1. Vérifiez que les documents `contentEmailsSent` sont créés correctement
2. Vérifiez les logs pour voir si l'email a déjà été envoyé

### Contenu non trouvé

Si vous voyez `⚠️ Content not found` :

1. Vérifiez que les documents existent dans `protectedContent`
2. Vérifiez que les IDs correspondent :
   - `21jours-jour-{day}` pour 21jours
   - `complet-week-{week}` pour complet
3. Vérifiez que le champ `product` correspond

## Notes importantes

- ⚠️ **Fuseau horaire** : La fonction utilise `Europe/Paris`. Ajustez si nécessaire.
- ⚠️ **Limites** : Firebase Functions a des limites de temps d'exécution. Pour de très nombreux utilisateurs, vous devrez peut-être paginer.
- ⚠️ **Coûts** : Chaque exécution consomme des ressources. Surveillez les coûts dans Google Cloud Console.
- ✅ **Idempotence** : La fonction est idempotente grâce à `contentEmailsSent`. Vous pouvez l'exécuter plusieurs fois sans risque de doublons.

## Exemples de logs

```
📧 Starting scheduled email job for new content
📊 Found 150 users to check
✅ Email sent to user@example.com for 21jours day 5
✅ Email sent to client@example.com for complet week 2
⏭️ Email already sent to existing@example.com for 21jours day 3
⚠️ Content not found: 21jours-jour-15
📧 Email job completed: 12 sent, 5 skipped, 1 errors
```
