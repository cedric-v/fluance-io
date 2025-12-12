# Configuration des notifications par email pour les nouveaux commentaires

Ce guide explique comment configurer les notifications par email qui sont envoyées automatiquement lorsqu'un nouveau commentaire est ajouté sur le site.

## 📧 Fonctionnalité

La fonction `notifyNewComment` écoute automatiquement les nouveaux commentaires dans Firestore et envoie un email de notification contenant :
- Le prénom de l'auteur du commentaire
- Le texte du commentaire
- Un lien direct vers la page concernée

## ⚙️ Configuration

### Étape 1 : Créer le secret Firebase

Configurez l'adresse email qui recevra les notifications via Firebase Secrets :

```bash
echo -n "votre-email@example.com" | firebase functions:secrets:set NOTIFICATION_EMAIL
```

**Remplacez** `votre-email@example.com` par votre adresse email réelle.

**Note** : Utilisez `echo -n` pour éviter d'ajouter un saut de ligne à la fin de l'email.

### Étape 2 : Redéployer la fonction

Après avoir configuré le secret, redéployez la fonction :

```bash
firebase deploy --only functions:notifyNewComment
```

### Étape 3 : Vérifier la configuration

Pour vérifier que le secret est bien configuré :

```bash
firebase functions:secrets:access NOTIFICATION_EMAIL
```

Cela devrait afficher votre adresse email.

## 🔧 Comment ça fonctionne

1. **Déclencheur** : La fonction `notifyNewComment` écoute automatiquement les nouveaux documents créés dans la collection `comments/{pageId}/messages` de Firestore.

2. **Extraction des données** : Lorsqu'un nouveau commentaire est détecté, la fonction extrait :
   - Le prénom (`name`)
   - Le texte du commentaire (`text`)
   - L'URL de la page (`pageId` décodé)

3. **Envoi de l'email** : Un email est envoyé via Mailjet à l'adresse configurée dans `NOTIFICATION_EMAIL`.

## 📝 Format de l'email

L'email de notification contient :
- **Sujet** : "Nouveau commentaire de [Prénom]"
- **Contenu** :
  - Prénom de l'auteur
  - Texte du commentaire (dans une boîte mise en évidence)
  - URL de la page concernée
  - Bouton pour accéder directement à la page

## ⚠️ Important

- Si le secret `NOTIFICATION_EMAIL` n'est pas configuré, les notifications seront désactivées (la fonction se terminera silencieusement sans erreur).
- L'email est envoyé depuis `support@actu.fluance.io` via Mailjet.
- Les notifications sont envoyées en temps réel dès qu'un commentaire est ajouté.

## 🆘 Dépannage

### Je ne reçois pas les notifications

1. **Vérifier que le secret est configuré** :
   ```bash
   firebase functions:secrets:access NOTIFICATION_EMAIL
   ```

2. **Vérifier les logs de la fonction** :
   ```bash
   firebase functions:log --only notifyNewComment
   ```

3. **Vérifier que la fonction est déployée** :
   ```bash
   firebase functions:list
   ```
   Vous devriez voir `notifyNewComment` dans la liste.

4. **Vérifier les emails dans Mailjet** : Les emails envoyés apparaissent dans l'historique Mailjet du contact.

### Erreur : "NOTIFICATION_EMAIL secret not configured"

Cette erreur signifie que le secret n'est pas configuré. Configurez-le avec la commande ci-dessus.

## 🔒 Sécurité

- L'adresse email est stockée dans Firebase Secrets (chiffrée)
- L'adresse email n'apparaît jamais dans le code source
- Seule la fonction `notifyNewComment` a accès à ce secret

## 📚 Voir aussi

- [Configuration des variables d'environnement](./CONFIGURATION_VARIABLES_ENV.md)
- [Migration vers les secrets Firebase](./MIGRATION_SECRETS_FIREBASE.md)
