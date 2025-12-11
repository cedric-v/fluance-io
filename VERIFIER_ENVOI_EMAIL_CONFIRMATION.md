# Guide : Vérifier pourquoi l'email de confirmation n'est pas envoyé

## 🔍 Étape 1 : Vérifier les logs Firebase Functions

Pour voir les détails de l'envoi d'email :

```bash
firebase functions:log --only subscribeToNewsletter
```

Cherchez les lignes contenant :
- `Sending confirmation email with payload:` - Le payload envoyé à MailJet
- `✅ Confirmation email sent successfully` - Succès
- `❌ Error sending confirmation email` - Erreur
- `⚠️ Template may not exist` - Le template n'existe pas

## ✅ Vérifications à faire

### 1. Vérifier que le template MailJet existe et est actif

1. Allez sur [MailJet Dashboard](https://app.mailjet.com/)
2. Allez dans **Email** > **Templates**
3. Cherchez le template avec l'ID **7571938**
4. Vérifiez que :
   - Le template existe
   - Le template est **actif** (statut "Published" ou "Active")
   - Le template est accessible avec votre compte MailJet

### 2. Vérifier l'expéditeur

L'email est envoyé depuis `support@actu.fluance.io`. Vérifiez que :
- Ce domaine est vérifié dans MailJet Dashboard > **Senders & Domains**
- L'expéditeur `support@actu.fluance.io` existe et est vérifié
- Les enregistrements SPF/DKIM/DMARC sont configurés pour ce domaine

**Si le domaine n'est pas vérifié**, MailJet peut bloquer l'envoi.

### 3. Vérifier les variables du template

Dans le template MailJet 7571938, vérifiez que les variables suivantes sont utilisées :
- `{{var:token}}` - Pour le token de confirmation
- `{{var:email}}` - Pour l'email du contact
- `{{var:firstname}}` - Pour le prénom

Le lien de confirmation dans le template doit être :
```
https://fluance.io/confirm?email={{var:email}}&token={{var:token}}
```

### 4. Vérifier les logs MailJet

1. Allez sur [MailJet Dashboard](https://app.mailjet.com/)
2. Allez dans **Statistics** > **Email activity**
3. Cherchez les emails envoyés avec :
   - Expéditeur : `support@actu.fluance.io`
   - Template ID : 7571938
4. Vérifiez le statut :
   - **Queued** : En attente d'envoi
   - **Sent** : Envoyé
   - **Bounced** : Rejeté
   - **Blocked** : Bloqué
   - **Spam** : Marqué comme spam

### 5. Vérifier les secrets Firebase

Vérifiez que les secrets MailJet sont bien configurés :

```bash
firebase functions:secrets:access MAILJET_API_KEY
firebase functions:secrets:access MAILJET_API_SECRET
```

## 🐛 Erreurs courantes

### Template ID invalide (404)

**Symptôme** : Erreur 404 dans les logs avec "Template not found"

**Solution** : 
- Vérifiez que l'ID du template (7571938) est correct
- Vérifiez que le template est accessible avec votre compte MailJet
- Vérifiez que vous utilisez le bon compte MailJet (pas un compte de test)

### Domaine non vérifié

**Symptôme** : Erreur 400 avec "Sender domain not verified"

**Solution** : 
- Vérifiez que `actu.fluance.io` est vérifié dans MailJet
- Vérifiez les enregistrements DNS (SPF, DKIM, DMARC)
- Utilisez temporairement un domaine vérifié pour tester

### Variables manquantes dans le template

**Symptôme** : Email envoyé mais avec des variables vides

**Solution** : 
- Vérifiez que toutes les variables utilisées dans le template sont passées dans l'API
- Vérifiez la syntaxe des variables dans le template (`{{var:token}}` et non `{{token}}`)

### Rate limiting

**Symptôme** : Erreur 429 (Too Many Requests)

**Solution** : Attendez quelques minutes avant de réessayer

## 🔧 Améliorations apportées

Le code a été amélioré pour :
- ✅ Logger le payload complet envoyé à MailJet
- ✅ Logger la réponse complète de MailJet (même en cas d'erreur)
- ✅ Ajouter un email de fallback si le template échoue
- ✅ Vérifier les erreurs dans la réponse MailJet même si le statut HTTP est 200
- ✅ Retourner plus d'informations (emailSent, emailError)

## 📝 Email de fallback

Si le template MailJet échoue (erreur 400 ou 404), le système essaie automatiquement d'envoyer un email simple avec le lien de confirmation. Cet email de fallback :
- Utilise du HTML simple (pas de template)
- Contient le lien de confirmation
- Utilise le même expéditeur

## 🧪 Tester manuellement l'envoi

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

## 📚 Ressources

- [Documentation MailJet API v3.1](https://dev.mailjet.com/email/guides/send-api-v31/)
- [MailJet Templating Language](https://documentation.mailjet.com/hc/en-us/articles/16886347025947-Mailjet-Templating-Language)
- [Vérifier les domaines MailJet](https://app.mailjet.com/account/sender)
