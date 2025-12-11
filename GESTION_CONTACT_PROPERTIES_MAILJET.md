# Guide : Gestion des Contact Properties MailJet

## 📋 Vue d'ensemble

Le système utilise maintenant une **liste unique MailJet (10524140)** et des **contact properties** pour suivre chaque contact et communiquer de façon appropriée.

## 🏷️ Contact Properties disponibles

Les properties suivantes sont gérées automatiquement :

| Property | Type | Description | Valeurs possibles |
|----------|------|-------------|-------------------|
| `statut` | String | Statut du contact | `"prospect"`, `"client"`, `"ancien_client"` |
| `source_optin` | String | Source de l'inscription | `"2pratiques"`, `"5joursofferts"`, etc. (peut être multiple, séparé par virgules) |
| `date_optin` | Date | Date d'inscription | Format: `JJ/MM/AAAA` |
| `produits_achetes` | String | Produits achetés | Liste séparée par virgules: `"21jours,complet"` |
| `date_premier_achat` | Date | Date du premier achat | Format: `JJ/MM/AAAA` |
| `date_dernier_achat` | Date | Date du dernier achat | Format: `JJ/MM/AAAA` |
| `valeur_client` | Decimal | Montant total dépensé | Montant en CHF (format: `"123.45"`) |
| `nombre_achats` | Integer | Nombre total de commandes | Nombre entier |
| `est_client` | Boolean | Indicateur client | `"True"` ou `"False"` |

## 🔄 Flux d'intégration

### 1. Opt-in "2 pratiques offertes"

**Fonction** : `subscribeToNewsletter`

**Actions** :
- Ajoute le contact à la liste **10524140**
- Définit les properties :
  - `statut`: `"prospect"`
  - `source_optin`: `"2pratiques"`
  - `date_optin`: Date actuelle (format `JJ/MM/AAAA`)
  - `est_client`: `"False"`

**Code** : `functions/index.js` ligne ~905-951

### 2. Opt-in "5 jours offerts"

**Fonction** : `subscribeTo5Days`

**Actions** :
- Ajoute le contact à la liste **10524140**
- Définit les properties :
  - `statut`: `"prospect"`
  - `source_optin`: `"5joursofferts"` (ajouté à la liste si déjà présent)
  - `date_optin`: Date actuelle (ou conserve la plus ancienne si existe)
  - `est_client`: `"False"`

**Note** : Si le contact a déjà `source_optin="2pratiques"`, il aura `source_optin="2pratiques,5joursofferts"`

**Code** : `functions/index.js` ligne ~1403-1510

### 3. Achat via Stripe ou PayPal

**Fonctions** : `webhookStripe`, `webhookPayPal`

**Actions** :
- Met à jour les properties :
  - `statut`: `"client"`
  - `produits_achetes`: Ajoute le produit à la liste (ex: `"21jours"` ou `"21jours,complet"`)
  - `date_dernier_achat`: Date actuelle
  - `date_premier_achat`: Date actuelle (si premier achat)
  - `valeur_client`: Montant total (somme de tous les achats)
  - `nombre_achats`: Incrémente de 1
  - `est_client`: `"True"`
- Ajoute le contact à la liste **10524140** si pas déjà dedans

**Code** : `functions/index.js` ligne ~165-315 (fonction `createTokenAndSendEmail`)

## 🔧 Fonction helper

### `updateMailjetContactProperties(email, properties, apiKey, apiSecret)`

Met à jour les contact properties MailJet pour un contact.

**Paramètres** :
- `email`: Email du contact
- `properties`: Objet avec les properties à mettre à jour
- `apiKey`: Clé API MailJet
- `apiSecret`: Secret API MailJet

**Fonctionnement** :
1. Récupère les properties actuelles du contact
2. Fusionne avec les nouvelles properties
3. Met à jour via l'API MailJet REST `/v3/REST/contactdata/{email}`

**Code** : `functions/index.js` ligne ~29-108

## 📊 Exemples de valeurs

### Prospect après opt-in 2 pratiques
```json
{
  "statut": "prospect",
  "source_optin": "2pratiques",
  "date_optin": "11/12/2025",
  "est_client": "False"
}
```

### Prospect après opt-in 5 jours (déjà inscrit aux 2 pratiques)
```json
{
  "statut": "prospect",
  "source_optin": "2pratiques,5joursofferts",
  "date_optin": "10/12/2025",  // Conserve la date la plus ancienne
  "est_client": "False"
}
```

### Client après achat
```json
{
  "statut": "client",
  "source_optin": "2pratiques",
  "date_optin": "10/12/2025",
  "produits_achetes": "21jours",
  "date_premier_achat": "11/12/2025",
  "date_dernier_achat": "11/12/2025",
  "valeur_client": "19.00",
  "nombre_achats": 1,
  "est_client": "True"
}
```

### Client avec plusieurs achats
```json
{
  "statut": "client",
  "source_optin": "2pratiques,5joursofferts",
  "date_optin": "10/12/2025",
  "produits_achetes": "21jours,complet",
  "date_premier_achat": "11/12/2025",
  "date_dernier_achat": "15/12/2025",
  "valeur_client": "49.00",
  "nombre_achats": 2,
  "est_client": "True"
}
```

## 🎯 Utilisation pour les campagnes MailJet

Avec ces properties, vous pouvez créer des segments dans MailJet :

### Segment : Prospects
- `statut` = `"prospect"`

### Segment : Clients actifs
- `est_client` = `"True"`
- `date_dernier_achat` >= Date récente (ex: 6 derniers mois)

### Segment : Clients inactifs
- `est_client` = `"True"`
- `date_dernier_achat` < Date ancienne (ex: > 6 mois)

### Segment : Opt-in 2 pratiques uniquement
- `source_optin` contient `"2pratiques"`
- `source_optin` ne contient pas `"5joursofferts"`

### Segment : Opt-in 5 jours
- `source_optin` contient `"5joursofferts"`

### Segment : Clients premium
- `valeur_client` >= Montant (ex: >= 50 CHF)

## 🔍 Vérifier les properties d'un contact

Utilisez le script `check-mailjet-contact.js` :

```bash
export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)
export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)
node check-mailjet-contact.js EMAIL
```

Pour voir les contact properties, vous devrez utiliser l'API MailJet directement ou le Dashboard MailJet.

## 📝 Notes importantes

1. **Liste unique** : Tous les contacts sont dans la liste **10524140**
2. **Properties multiples** : `source_optin` et `produits_achetes` peuvent contenir plusieurs valeurs séparées par des virgules
3. **Dates** : Format `JJ/MM/AAAA` (ex: `11/12/2025`)
4. **Montants** : Toujours en CHF, format décimal avec 2 décimales (ex: `"19.00"`)
5. **Conversion de devise** : Les webhooks convertissent automatiquement EUR/USD en CHF (taux approximatifs)

## 🐛 Dépannage

### Les properties ne sont pas mises à jour

1. Vérifier les logs Firebase :
   ```bash
   firebase functions:log --only subscribeToNewsletter,subscribeTo5Days,webhookStripe,webhookPayPal
   ```

2. Vérifier que les properties existent dans MailJet Dashboard

3. Vérifier le format des dates (JJ/MM/AAAA)

### Erreur lors de la mise à jour des properties

Les erreurs sont loggées mais n'empêchent pas le processus principal. Vérifiez les logs pour voir les détails.

## 📚 Ressources

- [Documentation MailJet Contact Data API](https://dev.mailjet.com/email/reference/contacts/contact-management/#v3_rest_contactdata)
- [MailJet Dashboard - Contacts](https://app.mailjet.com/contacts)
- [MailJet Dashboard - Segments](https://app.mailjet.com/segments)
