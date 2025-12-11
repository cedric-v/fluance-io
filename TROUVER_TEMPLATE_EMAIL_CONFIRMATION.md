# Guide : Trouver le template d'email de confirmation dans MailJet

## 🔍 Problème

L'email de confirmation reçu ne correspond pas au template ID 7571938 mentionné dans le code, et vous ne savez pas où le retrouver dans MailJet.

## ✅ Solutions

### Méthode 1 : Via MailJet Dashboard (Recommandé)

1. **Accéder à l'historique des emails** :
   - Allez sur [MailJet Dashboard](https://app.mailjet.com/)
   - Allez dans **Statistics** > **Email activity**
   - Recherchez l'email envoyé à votre adresse (ex: `c.vonlanthen@gmail.com`)
   - Cliquez sur l'email pour voir les détails

2. **Voir le template utilisé** :
   - Dans les détails de l'email, vous verrez :
     - **Template ID** : Le numéro du template utilisé
     - **Template Name** : Le nom du template
     - **Subject** : Le sujet de l'email
     - **Variables** : Les variables passées au template

3. **Accéder au template** :
   - Cliquez sur le **Template ID** ou le nom du template
   - Vous serez redirigé vers la page d'édition du template
   - Ou utilisez directement : `https://app.mailjet.com/template/TEMPLATE_ID`

### Méthode 2 : Via l'API MailJet (Scripts)

#### Script 1 : Lister tous les templates

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node list-mailjet-templates.js
```

Ce script liste tous vos templates MailJet et indique lequel correspond au template ID 7571938.

#### Script 2 : Vérifier l'historique des emails

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node check-mailjet-email-history.js EMAIL
```

Ce script affiche l'historique des emails envoyés à un contact.

**Note** : L'API REST des messages ne retourne pas toujours le TemplateID. Utilisez plutôt le Dashboard MailJet pour voir ces informations.

### Méthode 3 : Vérifier les logs Firebase

Les logs Firebase peuvent indiquer quel template a été utilisé :

```bash
firebase functions:log --only subscribeToNewsletter | grep -E "(TemplateID|7571938|MailJet response)"
```

Cherchez les lignes contenant :
- `Sending confirmation email with payload:` - Le payload envoyé à MailJet
- `MailJet response:` - La réponse de MailJet avec les détails

## 🔧 Vérifier le template dans le code

Le template utilisé est défini dans `functions/index.js` :

```javascript
TemplateID: 7571938,
TemplateLanguage: true,
Subject: 'Dernière étape indispensable [[data:firstname:""]]',
Variables: {
  token: confirmationToken,
  email: contactData.Email,
  firstname: name || '',
},
```

## 📋 Checklist de vérification

- [ ] Le template 7571938 existe dans MailJet (vérifié avec `list-mailjet-templates.js`)
- [ ] Le template est actif et publié
- [ ] Le template contient les variables `{{var:token}}`, `{{var:email}}`, `{{var:firstname}}`
- [ ] Le lien de confirmation dans le template est : `https://fluance.io/confirm?email={{var:email}}&token={{var:token}}`
- [ ] L'expéditeur `support@actu.fluance.io` est vérifié dans MailJet
- [ ] Les logs Firebase montrent que le template 7571938 a été envoyé

## 🐛 Problèmes courants

### Le template ID n'apparaît pas dans l'historique

**Cause** : L'API REST des messages ne retourne pas toujours le TemplateID pour les emails transactionnels.

**Solution** : Utilisez le Dashboard MailJet pour voir les détails complets.

### L'email reçu ne correspond pas au template

**Causes possibles** :
1. MailJet a utilisé un template par défaut si le template demandé n'existe pas
2. Le template a une erreur et MailJet a utilisé un fallback
3. Un autre template a été utilisé par erreur

**Solution** :
1. Vérifier dans MailJet Dashboard quel template a été réellement utilisé
2. Vérifier les logs Firebase pour voir si une erreur s'est produite
3. Vérifier que le template 7571938 existe et est actif

### Le template existe mais n'est pas utilisé

**Causes possibles** :
1. Le template n'est pas publié/actif
2. Le template n'est pas accessible avec votre compte MailJet
3. Une erreur dans le payload envoyé à MailJet

**Solution** :
1. Vérifier le statut du template dans MailJet Dashboard
2. Vérifier les logs Firebase pour voir les erreurs
3. Tester l'envoi manuel avec curl (voir `VERIFIER_ENVOI_EMAIL_CONFIRMATION.md`)

## 📚 Ressources

- [MailJet Dashboard - Email Activity](https://app.mailjet.com/statistics/email)
- [MailJet Dashboard - Templates](https://app.mailjet.com/template)
- [Documentation MailJet API Templates](https://dev.mailjet.com/email/reference/templates/)
- Guide : `VERIFIER_ENVOI_EMAIL_CONFIRMATION.md`

## 🔗 Liens directs

- **Template 7571938** : https://app.mailjet.com/template/7571938
- **Email Activity** : https://app.mailjet.com/statistics/email
- **Templates** : https://app.mailjet.com/template
