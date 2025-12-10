# Guide : Configurer la liste MailJet pour les opt-in

Ce guide explique comment configurer l'ajout automatique des contacts à une liste MailJet spécifique lors de l'opt-in via la pop-up.

## 📋 Prérequis

- Compte MailJet actif
- Liste MailJet créée dans votre compte
- Secrets MailJet déjà configurés (`MAILJET_API_KEY` et `MAILJET_API_SECRET`)

## 🔍 Étape 1 : Obtenir l'ID de votre liste MailJet

### Méthode 1 : Via l'interface MailJet (recommandé)

1. Connectez-vous à votre compte [MailJet](https://app.mailjet.com/)
2. Allez dans **Contacts** > **Listes**
3. Cliquez sur la liste à laquelle vous voulez ajouter les contacts
4. L'ID de la liste se trouve dans l'URL ou dans les détails de la liste
   - Exemple d'URL : `https://app.mailjet.com/contacts/lists/123456`
   - L'ID est le nombre à la fin : `123456`

### Méthode 2 : Via l'API MailJet

Vous pouvez aussi récupérer l'ID via l'API :

```bash
curl -X GET \
  https://api.mailjet.com/v3/REST/contactslist \
  -u "VOTRE_API_KEY:VOTRE_API_SECRET"
```

La réponse contiendra toutes vos listes avec leurs IDs :

```json
{
  "Count": 1,
  "Data": [
    {
      "ID": 123456,
      "Name": "Newsletter Fluance",
      "Address": "...",
      ...
    }
  ]
}
```

## ⚙️ Étape 2 : Configurer le secret Firebase

Une fois que vous avez l'ID de votre liste, configurez-le comme secret Firebase :

```bash
echo -n "123456" | firebase functions:secrets:set MAILJET_LIST_ID
```

⚠️ **Important** : Remplacez `123456` par l'ID réel de votre liste MailJet.

## 🚀 Étape 3 : Redéployer les fonctions

Après avoir configuré le secret, redéployez les fonctions Firebase :

```bash
firebase deploy --only functions
```

## ✅ Étape 4 : Vérifier la configuration

Pour vérifier que le secret est bien configuré :

```bash
firebase functions:secrets:access MAILJET_LIST_ID
```

## 🧪 Tester l'ajout à la liste

1. Testez l'inscription via la pop-up newsletter sur votre site
2. Vérifiez dans MailJet que le contact a bien été ajouté à la liste spécifiée
3. Vérifiez les logs Firebase Functions pour voir si tout s'est bien passé :

```bash
firebase functions:log --only subscribeToNewsletter
```

## 📝 Notes importantes

- **L'ID de liste doit être un nombre** : MailJet utilise des IDs numériques
- **Le contact est créé même si la liste n'est pas configurée** : Si `MAILJET_LIST_ID` n'est pas défini, le contact sera quand même ajouté à MailJet mais pas à une liste spécifique
- **Gestion des doublons** : Si un contact est déjà dans la liste, l'erreur est ignorée (ce n'est pas critique)
- **Contact existant** : Si un contact existe déjà dans MailJet, il sera quand même ajouté à la liste spécifiée

## 🔧 Dépannage

### Le contact n'est pas ajouté à la liste

1. Vérifiez que `MAILJET_LIST_ID` est bien configuré :
   ```bash
   firebase functions:secrets:access MAILJET_LIST_ID
   ```

2. Vérifiez que l'ID de liste est correct (doit être un nombre)

3. Vérifiez les logs Firebase Functions pour voir les erreurs :
   ```bash
   firebase functions:log --only subscribeToNewsletter
   ```

### Erreur "ListID must be a number"

L'ID de liste doit être un nombre. Vérifiez que vous n'avez pas mis de guillemets ou d'espaces dans le secret.

### Le contact est créé mais pas ajouté à la liste

- Vérifiez que le secret `MAILJET_LIST_ID` est bien configuré
- Vérifiez que l'ID de liste existe dans votre compte MailJet
- Vérifiez les logs pour voir s'il y a des erreurs lors de l'ajout à la liste

## 📚 Ressources

- [Documentation MailJet API - Contacts](https://dev.mailjet.com/email/guides/contacts/)
- [Documentation MailJet API - Listes](https://dev.mailjet.com/email/guides/contacts/#manage-contacts-lists)
- [Documentation Firebase Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
