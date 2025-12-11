# Guide : Trouver un message MailJet par son ID

## 🔍 Problème

Vous avez un message ID (`GAcbpCBha4`) mais ne savez pas comment retrouver les détails du message, notamment quel template a été utilisé.

## 📋 Types d'ID MailJet

MailJet utilise différents types d'ID selon le contexte :

1. **Message ID (API REST)** : Numérique, ex: `576460786395697000`
2. **Campaign ID** : Alphanumérique, ex: `GAcbpCBha4`
3. **Template ID** : Numérique, ex: `7571938`
4. **Send API Message ID** : Format spécifique pour l'API Send

## ✅ Solutions

### Méthode 1 : Via MailJet Dashboard (Recommandé)

1. **Accéder à l'historique des emails** :
   - Allez sur [MailJet Dashboard](https://app.mailjet.com/)
   - Allez dans **Statistics** > **Email activity**
   - Utilisez la recherche pour trouver le message

2. **Si vous avez un Campaign ID** :
   - Allez dans **Campaigns** > **All campaigns**
   - Recherchez le Campaign ID
   - Cliquez sur la campagne pour voir tous les messages associés

3. **Voir les détails du message** :
   - Cliquez sur le message pour voir :
     - **Template ID** utilisé
     - **Subject** de l'email
     - **Variables** passées au template
     - **Statut** de l'email (envoyé, délivré, ouvert, etc.)

### Méthode 2 : Via l'API MailJet

#### Script 1 : Rechercher par email du destinataire

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node check-mailjet-email-history.js EMAIL
```

#### Script 2 : Rechercher par message ID

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node get-mailjet-message-details.js MESSAGE_ID
```

**Note** : Si le message ID n'est pas reconnu, utilisez plutôt l'historique par email.

### Méthode 3 : Via les logs Firebase

Si le message a été envoyé via Firebase Functions, vérifiez les logs :

```bash
firebase functions:log --only subscribeToNewsletter | grep -E "(MailJet response|TemplateID|email sent)"
```

## 🔧 Pour le message ID `GAcbpCBha4`

Cet ID ressemble à un **Campaign ID** plutôt qu'à un Message ID. Pour le trouver :

1. **Dans MailJet Dashboard** :
   - Allez dans **Campaigns** > **All campaigns**
   - Recherchez `GAcbpCBha4`
   - Ou allez directement : `https://app.mailjet.com/campaign/GAcbpCBha4`

2. **Voir les messages de la campagne** :
   - Dans les détails de la campagne, vous verrez tous les messages envoyés
   - Chaque message affichera son Template ID

3. **Alternative - Recherche par email** :
   - Utilisez l'historique des emails du contact :
   ```bash
   node check-mailjet-email-history.js c.vonlanthen@gmail.com
   ```

## 📊 Informations disponibles selon le type d'ID

### Message ID (API REST)
- Template ID ✅
- Subject ✅
- Variables ✅
- Statut ✅
- Expéditeur/Destinataire ✅

### Campaign ID
- Liste des messages ✅
- Template ID (via les messages) ✅
- Statistiques globales ✅

### Template ID
- Détails du template ✅
- Variables disponibles ✅
- Contenu du template ✅

## 🐛 Problèmes courants

### L'API ne trouve pas le message

**Causes** :
- L'ID est un Campaign ID, pas un Message ID
- L'ID est dans un format différent
- Le message est trop ancien (limite de l'API)

**Solutions** :
- Utiliser le Dashboard MailJet
- Rechercher par email du destinataire
- Vérifier le type d'ID (Campaign vs Message)

### Le Template ID n'apparaît pas

**Causes** :
- L'API REST ne retourne pas toujours le TemplateID
- Le message a été envoyé sans template
- Le template a été supprimé

**Solutions** :
- Utiliser le Dashboard MailJet (plus fiable)
- Vérifier les logs Firebase
- Vérifier l'historique des templates

## 📚 Ressources

- [MailJet Dashboard - Email Activity](https://app.mailjet.com/statistics/email)
- [MailJet Dashboard - Campaigns](https://app.mailjet.com/campaign)
- [Documentation MailJet API Messages](https://dev.mailjet.com/email/reference/messages/)

## 🔗 Liens directs

- **Email Activity** : https://app.mailjet.com/statistics/email
- **Campaigns** : https://app.mailjet.com/campaign
- **Templates** : https://app.mailjet.com/template
