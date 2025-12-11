# Guide : Vérifier le statut double opt-in dans MailJet

## 📧 Méthode 1 : Via l'interface MailJet Dashboard

### Étape 1 : Accéder au contact

1. Connectez-vous à [MailJet Dashboard](https://app.mailjet.com/)
2. Allez dans **Contacts** > **Contact management**
3. Recherchez le contact par email dans la barre de recherche
4. Cliquez sur le contact pour voir ses détails

### Étape 2 : Vérifier le statut d'opt-in

Dans la page de détails du contact, vous verrez :

- **Opt-in status** : 
  - ✅ **Opt-in** : Le contact a confirmé son inscription (double opt-in complété)
  - ⏳ **Opt-in pending** : Le contact n'a pas encore confirmé (en attente de confirmation)
  - ❌ **Opt-out** : Le contact s'est désinscrit

- **IsOptInPending** : 
  - `false` : Le contact a confirmé son inscription
  - `true` : Le contact n'a pas encore confirmé (en attente)

### Étape 3 : Vérifier l'historique

Dans la page de détails du contact, vous pouvez voir :
- **Activity timeline** : Historique des actions (création, confirmation, etc.)
- **Email activity** : Historique des emails envoyés et leur statut

## 🔍 Méthode 2 : Via l'API MailJet

Vous pouvez vérifier le statut via l'API REST MailJet :

```bash
curl -X GET \
  "https://api.mailjet.com/v3/REST/contact/VOTRE_EMAIL@example.com" \
  -u "$MAILJET_API_KEY:$MAILJET_API_SECRET"
```

La réponse contiendra :
```json
{
  "Data": [
    {
      "Email": "contact@example.com",
      "IsOptInPending": false,  // false = confirmé, true = en attente
      "IsExcludedFromCampaigns": false,
      "Name": "Nom du contact",
      ...
    }
  ]
}
```

### Interprétation de `IsOptInPending`

- **`IsOptInPending: false`** : 
  - Le contact a confirmé son inscription (double opt-in complété)
  - OU le contact a été créé sans double opt-in requis
  - Le contact peut recevoir des emails

- **`IsOptInPending: true`** :
  - Le contact n'a pas encore confirmé son inscription
  - Le contact est en attente de confirmation
  - Le contact ne devrait pas recevoir d'emails marketing (sauf l'email de confirmation)

## 📊 Méthode 3 : Via les listes MailJet

1. Allez dans **Contacts** > **Contact lists**
2. Sélectionnez la liste où le contact devrait être ajouté
3. Recherchez le contact dans la liste
4. Le statut d'opt-in est affiché à côté du contact

## ⚠️ Notes importantes

### Comportement de MailJet avec le double opt-in

MailJet gère automatiquement `IsOptInPending` :
- **Lors de la création** : Vous ne pouvez pas définir `IsOptInPending` directement
- **Lors de la confirmation** : MailJet met automatiquement `IsOptInPending` à `false` quand le contact clique sur le lien de confirmation dans l'email
- **Via l'API** : Vous ne pouvez pas modifier `IsOptInPending` directement via l'API REST

### Vérification dans notre système

Dans notre système Firebase/Firestore, le statut de confirmation est stocké dans la collection `newsletterConfirmations` :

- **`confirmed: false`** : Le contact n'a pas encore confirmé
- **`confirmed: true`** : Le contact a confirmé son inscription

Pour vérifier dans Firestore :
1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `fluance-protected-content`
3. Allez dans **Firestore Database**
4. Ouvrez la collection `newsletterConfirmations`
5. Recherchez le document avec le token de confirmation
6. Vérifiez le champ `confirmed`

## 🔄 Synchronisation MailJet / Firestore

Notre système :
1. **Crée le contact** dans MailJet (sans définir `IsOptInPending`)
2. **Envoie l'email de confirmation** avec un lien unique
3. **Stocke le token** dans Firestore avec `confirmed: false`
4. **Lors de la confirmation** :
   - Marque le token comme `confirmed: true` dans Firestore
   - Ajoute le contact à la liste MailJet
   - MailJet met automatiquement `IsOptInPending` à `false` (géré automatiquement)

## 📝 Exemple de vérification complète

Pour vérifier qu'un contact a bien complété le double opt-in :

1. **Dans MailJet Dashboard** :
   - Vérifier que `IsOptInPending: false`
   - Vérifier que le contact est dans la liste configurée

2. **Dans Firestore** :
   - Vérifier que le token a `confirmed: true`
   - Vérifier que `confirmedAt` est défini

3. **Dans l'historique MailJet** :
   - Vérifier que l'email de confirmation a été envoyé
   - Vérifier que l'email de confirmation a été ouvert (si disponible)

## 🐛 Dépannage

### Le contact est dans MailJet mais `IsOptInPending: true`

**Causes possibles** :
- Le contact n'a pas cliqué sur le lien de confirmation
- Le lien de confirmation a expiré (7 jours)
- Le contact a supprimé l'email de confirmation

**Solution** :
- Renvoyer un email de confirmation
- Vérifier que le lien de confirmation fonctionne
- Vérifier les logs Firebase pour voir si la confirmation a été tentée

### Le contact a confirmé mais n'est pas dans la liste

**Causes possibles** :
- `MAILJET_LIST_ID` n'est pas configuré
- Erreur lors de l'ajout à la liste (vérifier les logs Firebase)

**Solution** :
- Vérifier que `MAILJET_LIST_ID` est configuré dans Firebase Secrets
- Vérifier les logs Firebase pour voir les erreurs
- Ajouter manuellement le contact à la liste dans MailJet Dashboard

## 📚 Ressources

- [Documentation MailJet Contacts API](https://dev.mailjet.com/email/reference/contacts/contact-management/)
- [MailJet Double Opt-in](https://dev.mailjet.com/email/guides/double-opt-in/)
- [Firebase Console](https://console.firebase.google.com/)
