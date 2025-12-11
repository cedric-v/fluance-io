# Guide : Modifier l'email de confirmation double opt-in

## 📧 Où est configuré l'email de confirmation ?

L'email de confirmation double opt-in est configuré dans **deux endroits** :

### 1. Dans le code Firebase Functions

**Fichier** : `functions/index.js`  
**Fonction** : `subscribeToNewsletter`  
**Lignes** : ~778-801

```javascript
const emailPayload = {
  Messages: [
    {
      From: {
        Email: 'support@actu.fluance.io',
        Name: 'Cédric de Fluance',
      },
      To: [
        {
          Email: contactData.Email,
          Name: name || contactData.Email,
        },
      ],
      TemplateID: 7571938,  // ← Template ID MailJet
      TemplateLanguage: true,
      TemplateErrorDeliver: true,
      TemplateErrorReporting: 'support@actu.fluance.io',
      Subject: 'Dernière étape indispensable [[data:firstname:""]]',
      Variables: {
        token: confirmationToken,
        email: contactData.Email,
        firstname: name || '',
      },
    },
  ],
};
```

### 2. Dans MailJet Dashboard (le contenu du template)

**Template ID** : `7571938`  
**Nom** : "confirmation double opt-in Fluance particuliers"  
**Lien direct** : https://app.mailjet.com/template/7571938

## 🔧 Comment modifier l'email de confirmation

### Option 1 : Modifier le template MailJet (Recommandé)

C'est la méthode la plus simple et ne nécessite pas de redéployer le code.

1. **Accéder au template** :
   - Allez sur https://app.mailjet.com/template/7571938
   - Ou : MailJet Dashboard > **Email** > **Templates** > Cherchez le template 7571938

2. **Modifier le contenu** :
   - Cliquez sur **Edit** pour modifier le template
   - Vous pouvez modifier :
     - Le texte de l'email
     - Le design/formatage
     - Les images
     - Le lien de confirmation

3. **Variables disponibles** :
   Le template peut utiliser ces variables :
   - `{{var:token}}` - Le token de confirmation unique
   - `{{var:email}}` - L'email du contact
   - `{{var:firstname}}` - Le prénom du contact

4. **Lien de confirmation** :
   Le lien doit être au format :
   ```
   https://fluance.io/confirm?email={{var:email}}&token={{var:token}}
   ```

5. **Publier le template** :
   - Cliquez sur **Save** puis **Publish**
   - Les modifications seront appliquées immédiatement aux prochains emails

### Option 2 : Utiliser un autre template MailJet

Si vous voulez utiliser un template différent :

1. **Créer/modifier un template dans MailJet** :
   - Allez sur https://app.mailjet.com/template
   - Créez un nouveau template ou modifiez un existant
   - Notez le **Template ID** (ex: 7571938)

2. **Modifier le code** :
   - Ouvrez `functions/index.js`
   - Trouvez la ligne avec `TemplateID: 7571938`
   - Remplacez par le nouveau Template ID :
   ```javascript
   TemplateID: VOTRE_NOUVEAU_TEMPLATE_ID,
   ```

3. **Vérifier les variables** :
   - Assurez-vous que le nouveau template utilise les mêmes variables :
     - `{{var:token}}`
     - `{{var:email}}`
     - `{{var:firstname}}`

4. **Déployer** :
   ```bash
   firebase deploy --only functions:subscribeToNewsletter
   ```

### Option 3 : Modifier le sujet de l'email

Le sujet est défini dans le code :

```javascript
Subject: 'Dernière étape indispensable [[data:firstname:""]]',
```

Pour le modifier :
1. Ouvrez `functions/index.js`
2. Trouvez la ligne avec `Subject:`
3. Modifiez le texte
4. Déployez : `firebase deploy --only functions:subscribeToNewsletter`

### Option 4 : Modifier l'expéditeur

L'expéditeur est défini dans le code :

```javascript
From: {
  Email: 'support@actu.fluance.io',
  Name: 'Cédric de Fluance',
},
```

**⚠️ Important** : L'email `support@actu.fluance.io` doit être vérifié dans MailJet.

Pour modifier :
1. Ouvrez `functions/index.js`
2. Trouvez la section `From:`
3. Modifiez l'email et/ou le nom
4. Vérifiez que le nouvel email est vérifié dans MailJet
5. Déployez : `firebase deploy --only functions:subscribeToNewsletter`

## 📋 Checklist pour modifier le template MailJet

- [ ] Le template utilise `{{var:token}}` pour le token de confirmation
- [ ] Le template utilise `{{var:email}}` pour l'email du contact
- [ ] Le template utilise `{{var:firstname}}` pour le prénom
- [ ] Le lien de confirmation est : `https://fluance.io/confirm?email={{var:email}}&token={{var:token}}`
- [ ] Le template est publié/actif dans MailJet
- [ ] Le template est accessible avec votre compte MailJet

## 🧪 Tester les modifications

### Test 1 : Vérifier le template dans MailJet

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node list-mailjet-templates.js
```

### Test 2 : Tester l'envoi manuel

Vous pouvez tester l'envoi avec curl (voir `VERIFIER_ENVOI_EMAIL_CONFIRMATION.md`).

### Test 3 : Tester avec un vrai opt-in

1. Allez sur votre site
2. Faites un opt-in avec un email de test
3. Vérifiez que l'email reçu correspond au nouveau template

## 🔍 Variables disponibles dans le template

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{var:token}}` | Token de confirmation unique | `8580bc30ad69dfd06db78e7f7778ae72625827bdeeb5fe47e73cfdd0b0c7805c` |
| `{{var:email}}` | Email du contact | `c.vonlanthen@gmail.com` |
| `{{var:firstname}}` | Prénom du contact | `Cédric` |

## 📝 Exemple de lien de confirmation dans le template

```html
<a href="https://fluance.io/confirm?email={{var:email}}&token={{var:token}}">
  Confirmer mon inscription
</a>
```

Ou en texte brut :
```
https://fluance.io/confirm?email={{var:email}}&token={{var:token}}
```

## ⚠️ Points importants

1. **Le template doit être publié** : Un template non publié ne peut pas être utilisé
2. **Les variables sont sensibles à la casse** : Utilisez exactement `{{var:token}}`, pas `{{var:Token}}`
3. **Le lien de confirmation** : Doit pointer vers `https://fluance.io/confirm` (pas `/fr/confirm` ou `/en/confirm`)
4. **L'expéditeur doit être vérifié** : `support@actu.fluance.io` doit être vérifié dans MailJet

## 🔗 Liens utiles

- **Template 7571938** : https://app.mailjet.com/template/7571938
- **Tous les templates** : https://app.mailjet.com/template
- **Email Activity** : https://app.mailjet.com/statistics/email
- **Senders & Domains** : https://app.mailjet.com/account/sender

## 📚 Documentation

- [MailJet Templating Language](https://documentation.mailjet.com/hc/en-us/articles/16886347025947-Mailjet-Templating-Language)
- [MailJet Send API v3.1](https://dev.mailjet.com/email/guides/send-api-v31/)
- Guide : `VERIFIER_ENVOI_EMAIL_CONFIRMATION.md`
