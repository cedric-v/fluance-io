# Dépannage : Email de confirmation newsletter non reçu

## 🔍 Vérifier les logs Firebase Functions

Pour voir les logs détaillés de l'envoi d'email :

```bash
firebase functions:log --only subscribeToNewsletter
```

Cherchez les lignes contenant :
- `Sending confirmation email with payload:` - Le payload envoyé à MailJet
- `Confirmation email sent successfully` - Succès
- `Error sending confirmation email` - Erreur

## ✅ Vérifications à faire

### 1. Vérifier que le template MailJet existe

1. Allez sur [MailJet Dashboard](https://app.mailjet.com/)
2. Allez dans **Email** > **Templates**
3. Vérifiez que le template avec l'ID **7571938** existe
4. Vérifiez que le template est **actif** et **publié**

### 2. Vérifier les variables du template

Dans le template MailJet 7571938, vérifiez que les variables suivantes sont utilisées :
- `{{var:token}}` - Pour le token de confirmation
- `{{var:email}}` - Pour l'email du contact
- `{{var:firstname}}` - Pour le prénom

Le lien de confirmation dans le template doit être :
```
https://fluance.io/confirm?email={{var:email}}&token={{var:token}}
```

### 3. Vérifier l'expéditeur

L'email est envoyé depuis `support@actu.fluance.io`. Vérifiez que :
- Ce domaine est vérifié dans MailJet
- L'expéditeur est autorisé à envoyer des emails
- Les enregistrements SPF/DKIM/DMARC sont configurés

### 4. Vérifier les logs MailJet

1. Allez sur [MailJet Dashboard](https://app.mailjet.com/)
2. Allez dans **Statistics** > **Email activity**
3. Cherchez les emails envoyés avec le template 7571938
4. Vérifiez le statut (delivered, bounced, blocked, etc.)

### 5. Vérifier les spams

- Vérifiez le dossier spam/courriers indésirables
- Vérifiez les filtres de votre boîte email
- Ajoutez `support@actu.fluance.io` à vos contacts

## 🐛 Erreurs courantes

### Template ID invalide

**Symptôme** : Erreur 400 dans les logs avec "Template not found"

**Solution** : Vérifiez que l'ID du template (7571938) est correct dans MailJet

### Variables manquantes

**Symptôme** : Email envoyé mais avec des variables vides

**Solution** : Vérifiez que toutes les variables utilisées dans le template sont passées dans l'API :
```javascript
Variables: {
  token: confirmationToken,
  email: contactData.Email,
  firstname: name || '',
}
```

### Domaine non vérifié

**Symptôme** : Email bloqué par MailJet

**Solution** : Vérifiez que `actu.fluance.io` est vérifié dans MailJet Dashboard > Sender domains

### Rate limiting

**Symptôme** : Erreur 429 (Too Many Requests)

**Solution** : Attendez quelques minutes avant de réessayer

## 📝 Tester manuellement l'envoi

Vous pouvez tester l'envoi d'email avec le template via curl :

```bash
curl -X POST \
  https://api.mailjet.com/v3.1/send \
  -u "$MAILJET_API_KEY:$MAILJET_API_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "Messages":[
      {
        "From": {
          "Email": "support@actu.fluance.io",
          "Name": "Cédric de Fluance"
        },
        "To": [
          {
            "Email": "VOTRE_EMAIL@example.com",
            "Name": "Test"
          }
        ],
        "TemplateID": 7571938,
        "TemplateLanguage": true,
        "Subject": "Dernière étape indispensable [[data:firstname:""]]",
        "Variables": {
          "token": "test-token-123",
          "email": "VOTRE_EMAIL@example.com",
          "firstname": "Test"
        }
      }
    ]
  }'
```

Remplacez :
- `$MAILJET_API_KEY` et `$MAILJET_API_SECRET` par vos clés
- `VOTRE_EMAIL@example.com` par votre email de test

## 🔧 Améliorations apportées

Le code a été amélioré pour :
- Logger le payload complet envoyé à MailJet
- Logger la réponse complète de MailJet
- Ajouter `TemplateErrorDeliver: true` pour recevoir les emails même en cas d'erreur de template
- Ajouter `TemplateErrorReporting` pour recevoir les erreurs de template par email
- Retourner plus d'informations dans la réponse (emailSent, emailError)

## 📚 Ressources

- [Documentation MailJet API v3.1](https://dev.mailjet.com/email/guides/send-api-v31/)
- [MailJet Templating Language](https://documentation.mailjet.com/hc/en-us/articles/16886347025947-Mailjet-Templating-Language)
