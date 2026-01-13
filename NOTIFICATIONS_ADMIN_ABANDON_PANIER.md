# Notifications Admin et Système d'Abandon de Panier

Ce document décrit les notifications email envoyées à l'administrateur et le système d'abandon de panier pour les réservations.

## 📧 Notifications Admin

### 1. Nouvelle Réservation Confirmée (Cours Hebdomadaires)

**Quand** : À chaque fois qu'une réservation est confirmée (paiement réussi, espèces, pass, ou cours d'essai)

**Destinataire** : Email configuré dans le code (voir configuration ci-dessous)

**Contenu de l'email** :
- Nom et prénom
- Email et téléphone
- Informations du cours (titre, date, heure, lieu)
- Formule choisie
- Montant et mode de paiement
- Code partenaire (si applicable)
- Booking ID

**Emplacements où la notification est envoyée** :
- ✅ Réservation avec pass (Flow Pass ou Semestriel)
- ✅ Réservation avec paiement espèces
- ✅ Cours d'essai gratuit
- ✅ Réservation confirmée via webhook Stripe (paiement en ligne)

### 2. Inscription à la Liste d'Attente (Cours Hebdomadaires)

**Quand** : À chaque fois qu'une personne est ajoutée à la liste d'attente d'un cours complet

**Destinataire** : Email configuré dans le code (voir configuration ci-dessous)

**Contenu de l'email** :
- Nom et prénom
- Email et téléphone
- Informations du cours (titre, date, heure)
- Position dans la liste d'attente

**Emplacements où la notification est envoyée** :
- ✅ Ajout à la liste d'attente lors d'une tentative de réservation

### 3. Inscription à la Liste d'Attente des Stages

**Quand** : À chaque fois qu'une personne s'inscrit à la liste d'attente des prochains stages

**Destinataire** : Email configuré dans le code (voir configuration ci-dessous)

**Contenu de l'email** :
- Nom
- Email
- Région (si fournie)
- Langue (FR/EN)

**Emplacements où la notification est envoyée** :
- ✅ Inscription via `subscribeToStagesWaitingList`

---

## 🛒 Système d'Abandon de Panier

### Fonctionnement

Le système d'abandon de panier envoie automatiquement un email de relance aux personnes qui ont :
1. **Commencé une réservation mais ne l'ont pas finalisée** (statut `pending`)
2. **Échoué un paiement** (statut `payment_failed`)

### Délais

- **Délai avant envoi** : 1 heure après la création de la réservation ou l'échec du paiement
- **Fenêtre d'envoi** : Entre 1h et 48h après l'événement
- **Fréquence de vérification** : Toutes les heures (fonction scheduled)

### Fonction Scheduled

**Nom** : `sendCartAbandonmentEmails`

**Schedule** : `every 1 hours` (toutes les heures)

**Région** : `europe-west1`

**Secrets requis** :
- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`

### Types d'Abandon de Panier

#### 1. Réservation Non Complétée

**Condition** :
- Statut : `pending`
- Créée il y a entre 1h et 48h
- Email d'abandon pas encore envoyé

**Email envoyé** :
- Sujet : "Finalisez votre réservation Fluance"
- Contenu : Informations du cours + lien pour finaliser
- Lien : URL de réservation avec paramètre `retry=true` si `clientSecret` disponible

#### 2. Paiement Échoué

**Condition** :
- Statut : `payment_failed`
- Échec il y a entre 1h et 48h
- Email d'abandon pas encore envoyé

**Email envoyé** :
- Sujet : "Votre paiement n'a pas pu être traité - Finalisez votre réservation"
- Contenu : Informations du cours + lien pour réessayer
- Lien : URL de réservation avec paramètre `retry=true` si `clientSecret` disponible

**Note** : Un email est aussi envoyé **immédiatement** lors de l'échec du paiement (via webhook Stripe), en plus de la relance programmée.

### Champs Ajoutés aux Réservations

Les réservations incluent maintenant :
- `cartAbandonmentEmailSent` (boolean) : Indique si l'email d'abandon a été envoyé
- `cartAbandonmentEmailSentAt` (timestamp) : Date d'envoi de l'email
- `paymentFailedAt` (timestamp) : Date d'échec du paiement (pour `payment_failed`)

---

## ⚙️ Configuration

### Prérequis

Les secrets Firebase suivants doivent être configurés :
- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`
- `ADMIN_EMAIL` (optionnel, par défaut : `support@fluance.io`)

### Configuration de l'Email Admin

L'email destinataire des notifications admin est configuré via le secret Firebase `ADMIN_EMAIL`. Si ce secret n'est pas configuré, l'email par défaut `support@fluance.io` sera utilisé.

**Pour configurer l'email admin :**

```bash
echo -n "votre-email@example.com" | firebase functions:secrets:set ADMIN_EMAIL
```

**Remplacez** `votre-email@example.com` par votre adresse email réelle.

**Note** : Utilisez `echo -n` pour éviter d'ajouter un saut de ligne à la fin de l'email.

**Pour vérifier que le secret est configuré :**

```bash
firebase functions:secrets:access ADMIN_EMAIL
```

Après avoir configuré le secret, redéployez les fonctions pour que le changement prenne effet.

### Déploiement

Après avoir ajouté le code, déployez les fonctions :

```bash
cd functions
npm run deploy
```

La fonction scheduled `sendCartAbandonmentEmails` sera automatiquement créée dans Cloud Scheduler.

---

## 📊 Monitoring

### Logs

Les notifications et emails d'abandon sont loggés dans les logs Firebase Functions :

```bash
firebase functions:log --only sendCartAbandonmentEmails
```

### Vérification

Pour vérifier que les notifications sont envoyées :
1. Vérifiez les logs Firebase Functions
2. Vérifiez votre boîte email configurée dans le code
3. Vérifiez les emails dans Mailjet Dashboard

---

## 🔧 Personnalisation

### Modifier le délai avant envoi

Dans `sendCartAbandonmentEmails`, modifiez :
```javascript
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 heure
```

### Modifier la fenêtre d'envoi

Modifiez la condition :
```javascript
if (hoursSinceCreation < 1 || hoursSinceCreation > 48) {
```

### Modifier la fréquence de vérification

Dans la définition de la fonction scheduled :
```javascript
schedule: 'every 1 hours', // Modifier ici (ex: 'every 30 minutes')
```

---

## 📝 Notes Importantes

- Les notifications admin sont envoyées **en plus** des emails de confirmation aux clients
- Les emails d'abandon de panier ne sont envoyés **qu'une seule fois** par réservation
- Les emails d'abandon sont envoyés uniquement pour les réservations créées dans les **48 dernières heures**
- Le système évite les doublons en vérifiant le champ `cartAbandonmentEmailSent`
- Les erreurs d'envoi ne bloquent pas le processus de réservation

---

## 🆘 Dépannage

### Je ne reçois pas les notifications admin

1. Vérifiez que les secrets Mailjet sont configurés
2. Vérifiez les logs Firebase Functions
3. Vérifiez votre boîte email configurée dans le code (y compris les spams)
4. Vérifiez que l'adresse email dans le code correspond à votre adresse

### Les emails d'abandon ne sont pas envoyés

1. Vérifiez que la fonction scheduled est déployée :
   ```bash
   firebase functions:list
   ```

2. Vérifiez les logs :
   ```bash
   firebase functions:log --only sendCartAbandonmentEmails
   ```

3. Vérifiez que les réservations ont le bon statut (`pending` ou `payment_failed`)

4. Vérifiez que les réservations sont dans la fenêtre d'envoi (1h-48h)

### Erreur : "Mailjet credentials not configured"

Configurez les secrets :
```bash
firebase functions:secrets:set MAILJET_API_KEY
firebase functions:secrets:set MAILJET_API_SECRET
```

Puis redéployez :
```bash
cd functions
npm run deploy
```
