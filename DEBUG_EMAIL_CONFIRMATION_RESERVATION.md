# Debug : Email de confirmation de réservation non reçu

## Problème

L'email `cedricjourney+testauth@gmail.com` n'a pas reçu d'email de confirmation de réservation.

## Explication du système

Le système utilise un **double opt-in** pour les nouveaux contacts. Voici le flux :

### Pour un nouveau contact (première réservation)

1. **Réservation effectuée** → `bookCourse` est appelé
2. **Vérification du statut opt-in** :
   - Si l'email n'est **pas confirmé** → `handleDoubleOptInForBooking` est appelé
   - Si l'email est **déjà confirmé** → Email de confirmation envoyé immédiatement

3. **Si nouveau contact** :
   - Un email de **double opt-in** est envoyé (pas de confirmation de réservation)
   - L'utilisateur doit cliquer sur le lien de confirmation
   - **Seulement après confirmation** → L'email de confirmation de réservation est envoyé

### Pour un contact déjà confirmé

- L'email de confirmation de réservation est envoyé **immédiatement** après la réservation

## Vérifications à faire

### 1. Vérifier si l'email a été ajouté à la collection `mail`

Dans Firebase Console > Firestore > Collection `mail` :
- Chercher l'email `cedricjourney+testauth@gmail.com`
- Vérifier si un document existe avec le template `booking-confirmation`

### 2. Vérifier le statut de double opt-in

Dans Firebase Console > Firestore > Collection `newsletterConfirmations` :
- Chercher l'email `cedricjourney+testauth@gmail.com`
- Vérifier :
  - Si un document existe
  - Si `confirmed === true` ou `false`
  - Si `bookingId` est présent (indique qu'une réservation est liée)

### 3. Vérifier les logs Firebase Functions

```bash
firebase functions:log | grep -i "cedricjourney+testauth"
```

Chercher :
- `📧 Double opt-in email sent` = Email de double opt-in envoyé
- `📧 Course confirmation email sent` = Email de confirmation envoyé après opt-in
- `📧 Confirmation email sent` = Email de confirmation envoyé directement

### 4. Vérifier l'extension Trigger Email

Dans Firebase Console > Extensions > Trigger Email :
- Vérifier que l'extension est active
- Vérifier les logs de l'extension
- Vérifier les erreurs éventuelles

## Solutions selon le cas

### Cas 1 : Email de double opt-in envoyé mais pas confirmé

**Symptôme** : L'utilisateur a reçu l'email de double opt-in mais n'a pas cliqué sur le lien

**Solution** :
1. L'utilisateur doit cliquer sur le lien de confirmation dans l'email de double opt-in
2. Après confirmation, l'email de confirmation de réservation sera envoyé automatiquement

### Cas 2 : Aucun email envoyé

**Symptôme** : Aucun email dans la collection `mail`

**Causes possibles** :
1. L'extension Trigger Email n'est pas configurée
2. Erreur lors de l'ajout à la collection `mail`
3. Le template `booking-confirmation` n'existe pas

**Solution** :
1. Vérifier les logs Firebase Functions pour voir les erreurs
2. Vérifier que l'extension Trigger Email est installée et active
3. Vérifier que le template `booking-confirmation` existe dans `src/emails/`

### Cas 3 : Email dans `mail` mais pas reçu

**Symptôme** : Document existe dans `mail` mais l'utilisateur n'a pas reçu l'email

**Causes possibles** :
1. Problème avec l'extension Trigger Email
2. Email dans les spams
3. Problème de configuration SMTP

**Solution** :
1. Vérifier les logs de l'extension Trigger Email
2. Vérifier la configuration SMTP (Mailjet, SendGrid, etc.)
3. Demander à l'utilisateur de vérifier ses spams

## Commandes utiles

```bash
# Voir les logs pour un email spécifique
firebase functions:log | grep -i "cedricjourney+testauth"

# Voir tous les emails dans la collection mail
# (via Firebase Console > Firestore > Collection mail)

# Voir les confirmations d'opt-in
# (via Firebase Console > Firestore > Collection newsletterConfirmations)
```

## Pour forcer l'envoi d'un email de confirmation

Si vous voulez envoyer manuellement un email de confirmation :

1. **Vérifier que le double opt-in est confirmé** :
   - Dans Firestore > `newsletterConfirmations`
   - Trouver le document avec l'email
   - Vérifier que `confirmed === true`

2. **Si confirmé mais email non reçu** :
   - Vérifier la collection `mail` pour voir si le document existe
   - Si le document existe, vérifier les logs de l'extension Trigger Email
   - Si le document n'existe pas, il y a eu une erreur lors de la création

3. **Créer manuellement un email** :
   - Dans Firebase Console > Firestore > Collection `mail`
   - Ajouter un document avec :
     ```json
     {
       "to": "cedricjourney+testauth@gmail.com",
       "template": {
         "name": "booking-confirmation",
         "data": {
           "firstName": "...",
           "courseName": "...",
           "courseDate": "...",
           "courseTime": "...",
           "location": "...",
           "bookingId": "...",
           "cancellationUrl": "..."
         }
       }
     }
     ```

## Prochaines étapes

1. Vérifier dans Firestore si un document existe dans `mail` pour cet email
2. Vérifier le statut de double opt-in dans `newsletterConfirmations`
3. Vérifier les logs Firebase Functions
4. Vérifier les logs de l'extension Trigger Email

Une fois ces vérifications faites, on pourra identifier précisément le problème.
