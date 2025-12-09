# Guide : Créer un utilisateur de test pour le produit "21 jours"

Ce guide vous explique comment créer un utilisateur de test pour valider l'affichage du produit "21 jours" avec l'accès progressif jour par jour.

## 📋 Prérequis

- Firebase Functions déployées
- Firestore activé
- Authentication activé (Email/Password)
- Accès à Firebase Console

## 🎯 Démarche complète

### Étape 1 : Créer un token de test dans Firestore

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Allez dans **Firestore Database**
4. Si la collection `registrationTokens` n'existe pas, créez-la :
   - Cliquez sur **Commencer la collection** / **Start collection**
   - Nom : `registrationTokens`
5. Cliquez sur **Ajouter un document** / **Add document**
6. **Document ID** : Utilisez un ID aléatoire de 32 caractères hex (ou générez-en un avec la console JavaScript) :
   ```javascript
   Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
   ```
   Exemple : `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
7. Ajoutez ces champs :

| Champ | Type | Valeur |
|-------|------|--------|
| `email` | string | `test-21jours@example.com` (ou votre email de test) |
| `product` | string | `21jours` ⚠️ **IMPORTANT : exactement "21jours"** |
| `createdAt` | timestamp | Cliquez sur l'icône horloge → "now" |
| `expiresAt` | timestamp | Cliquez sur l'icône horloge → Ajoutez 30 jours |
| `used` | boolean | `false` |

8. Cliquez sur **Enregistrer** / **Save**
9. **Copiez l'ID du document** - c'est votre token de test

### Étape 2 : Créer le compte utilisateur

1. Allez sur : `https://fluance.io/creer-compte?token=VOTRE_TOKEN`
   (Remplacez `VOTRE_TOKEN` par l'ID du document créé à l'étape 1)

2. Remplissez le formulaire :
   - **Email** : L'email utilisé dans le token (ex: `test-21jours@example.com`)
   - **Mot de passe** : Choisissez un mot de passe (minimum 6 caractères)
   - **Confirmer le mot de passe** : Répétez le mot de passe

3. Cliquez sur **Créer mon compte**

4. ✅ Si tout fonctionne :
   - Vous serez automatiquement connecté
   - Un document sera créé dans `users` avec `product: "21jours"` et `registrationDate`
   - Le token sera marqué comme utilisé (`used: true`)

### Étape 3 : Vérifier la création de l'utilisateur

Dans Firebase Console, vérifiez :

1. **Firestore > users** :
   - Un document doit exister avec votre email
   - Le champ `product` doit être `"21jours"`
   - Le champ `registrationDate` doit être présent (timestamp)

2. **Firestore > registrationTokens** :
   - Le token doit avoir `used: true`
   - Le champ `userId` doit être rempli

3. **Authentication > Users** :
   - Un utilisateur doit exister avec votre email

### Étape 4 : Créer du contenu de test pour "21 jours"

Pour tester l'affichage, vous devez créer au moins quelques jours de contenu :

#### Option A : Créer le jour 0 (Déroulé) - Accès immédiat

1. Dans **Firestore Database**, créez la collection `protectedContent` si elle n'existe pas
2. Cliquez sur **Ajouter un document** / **Add document**
3. **Document ID** : `21jours-jour-0`
4. Ajoutez ces champs :

| Champ | Type | Valeur |
|-------|------|--------|
| `product` | string | `21jours` ⚠️ **Exactement "21jours"** |
| `day` | number | `0` |
| `title` | string | `Déroulé` |
| `content` | string | `<div class="protected-video-content"><h2 class="text-2xl font-bold mb-4">Déroulé - 21 jours pour remettre du mouvement</h2><p class="mb-4">Bienvenue dans votre programme de 21 jours !</p><p class="mb-4">Ce déroulé vous donne accès à toutes les informations sur le programme.</p><div class="bg-green-50 border border-green-200 rounded-lg p-4"><p class="text-green-800">✅ Contenu de test pour le produit 21jours - Jour 0</p></div></div>` |

5. Cliquez sur **Enregistrer**

#### Option B : Créer plusieurs jours (pour tester l'accès progressif)

Pour tester l'accès progressif, créez au moins les jours 1, 2, 3 :

**Jour 1 :**
- Document ID : `21jours-jour-1`
- `product`: `21jours`
- `day`: `1`
- `title`: `Ancrage et épaules`
- `content`: `<div class="protected-video-content"><h2 class="text-2xl font-bold mb-4">Jour 1 : Ancrage et épaules</h2><p class="mb-4">Contenu de test pour le jour 1.</p></div>`

**Jour 2 :**
- Document ID : `21jours-jour-2`
- `product`: `21jours`
- `day`: `2`
- `title`: `Dos et hanches avec le 8`
- `content`: `<div class="protected-video-content"><h2 class="text-2xl font-bold mb-4">Jour 2 : Dos et hanches avec le 8</h2><p class="mb-4">Contenu de test pour le jour 2.</p></div>`

**Jour 3 :**
- Document ID : `21jours-jour-3`
- `product`: `21jours`
- `day`: `3`
- `title`: `Rotation pour accroître la mobilité`
- `content`: `<div class="protected-video-content"><h2 class="text-2xl font-bold mb-4">Jour 3 : Rotation pour accroître la mobilité</h2><p class="mb-4">Contenu de test pour le jour 3.</p></div>`

> 💡 **Astuce** : Pour créer tous les jours rapidement, utilisez le script `scripts/import-21jours-videos.js` (voir `STRUCTURE_21JOURS.md`)

### Étape 5 : Tester l'affichage

1. **Se connecter** (si vous n'êtes pas déjà connecté) :
   - Allez sur `https://fluance.io/connexion-firebase/`
   - Connectez-vous avec votre email et mot de passe

2. **Accéder à la page membre** :
   - Allez sur `https://fluance.io/membre/`
   - Vous devriez voir la navigation par jour pour le produit "21 jours"

3. **Tester l'accès progressif** :
   - **Jour 0** : Accessible immédiatement après création du compte
   - **Jour 1** : Accessible le jour suivant l'inscription
   - **Jour 2** : Accessible 2 jours après l'inscription
   - etc.

4. **Page spécifique "21 jours"** :
   - Allez sur `https://fluance.io/cours-en-ligne/21jours/`
   - Vous devriez voir la navigation jour par jour avec les jours disponibles

### Étape 6 : Tester l'accès progressif (optionnel)

Pour tester l'accès progressif sans attendre les jours réels, vous pouvez modifier temporairement la `registrationDate` dans Firestore :

1. Allez dans **Firestore > users > [votre userId]**
2. Modifiez le champ `registrationDate` :
   - Pour tester le jour 1 : Mettez la date à **hier**
   - Pour tester le jour 2 : Mettez la date à **il y a 2 jours**
   - Pour tester le jour 3 : Mettez la date à **il y a 3 jours**
   - etc.

3. Rafraîchissez la page `/cours-en-ligne/21jours/` ou `/membre/`
4. Les jours correspondants devraient maintenant être accessibles

## ✅ Checklist de validation

- [ ] Token créé dans `registrationTokens` avec `product: "21jours"`
- [ ] Compte créé via `/creer-compte?token=...`
- [ ] Document utilisateur créé dans `users` avec `product: "21jours"` et `registrationDate`
- [ ] Contenu créé dans `protectedContent` avec au moins `21jours-jour-0`
- [ ] Connexion réussie
- [ ] Page `/membre/` affiche la navigation par jour
- [ ] Page `/cours-en-ligne/21jours/` affiche le contenu
- [ ] Jour 0 accessible immédiatement
- [ ] Accès progressif fonctionne (jours suivants selon `registrationDate`)

## 🔍 Vérification dans Firebase Console

### Collection `users`
```
users/
  └── {userId}
      ├── email: "test-21jours@example.com"
      ├── product: "21jours"
      ├── registrationDate: Timestamp (date d'inscription)
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

### Collection `protectedContent`
```
protectedContent/
  ├── 21jours-jour-0
  │   ├── product: "21jours"
  │   ├── day: 0
  │   ├── title: "Déroulé"
  │   └── content: "<div>...</div>"
  ├── 21jours-jour-1
  │   ├── product: "21jours"
  │   ├── day: 1
  │   ├── title: "Ancrage et épaules"
  │   └── content: "<div>...</div>"
  └── ...
```

## 🐛 Dépannage

### Le jour 0 ne s'affiche pas
- Vérifiez que le document `21jours-jour-0` existe dans `protectedContent`
- Vérifiez que `product: "21jours"` (exactement, sans espaces)
- Vérifiez que `day: 0` (nombre, pas string)

### Les jours suivants ne sont pas accessibles
- Vérifiez que `registrationDate` existe dans le document `users`
- Vérifiez que la date est correcte (pas dans le futur)
- Le jour N est accessible N jours après `registrationDate`

### Erreur "Contenu non trouvé"
- Vérifiez que les documents existent avec les IDs exacts : `21jours-jour-0`, `21jours-jour-1`, etc.
- Vérifiez que le champ `product` est exactement `"21jours"` (pas `"21 jours"` ou autre)

### La navigation par jour ne s'affiche pas
- Vérifiez que vous êtes connecté
- Vérifiez que votre document `users` a `product: "21jours"`
- Vérifiez la console du navigateur pour les erreurs JavaScript

## 📝 Exemple complet

1. **Token** : `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
2. **Email** : `test-21jours@example.com`
3. **Créer le compte** : `https://fluance.io/creer-compte?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
4. **Se connecter** : `https://fluance.io/connexion-firebase/`
5. **Voir le contenu** : `https://fluance.io/cours-en-ligne/21jours/` ou `https://fluance.io/membre/`

## 🔗 Ressources

- **Structure complète** : Voir `STRUCTURE_21JOURS.md` pour la liste complète des 22 jours
- **Import en masse** : Utiliser `scripts/import-21jours-videos.js` pour créer tous les jours
- **Guide général** : Voir `TESTER_LOGIN_CONTENU_PROTEGE.md` pour les tests généraux

---

**Date de création** : 2025-12-09

