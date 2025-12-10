# Corriger les erreurs 403 et 404 avec les Passkeys

## Erreurs identifiées

### Erreur 403 : "Requests from referer https://fluance-protected-content.firebaseapp.com/ are blocked"

**Cause** : Le domaine Firebase n'est pas autorisé dans les restrictions HTTP referrer de la clé API Firebase.

**Solution** : Ajouter le domaine aux restrictions de la clé API.

### Erreur 404 : La fonction `webAuthn-checkExtension` n'existe pas

**Cause** : Le code utilise un nom de fonction incorrect. L'extension crée des fonctions avec le préfixe `ext-firebase-web-authn-`.

**Solution** : Vérifier les noms exacts des fonctions créées par l'extension et mettre à jour le code.

## Solutions

### Solution 1 : Corriger l'erreur 403 (Restrictions de la clé API)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, allez dans **APIs & Services** > **Credentials**
4. Trouvez votre clé API (celle utilisée dans `firebase-auth.js`)
5. Cliquez sur le nom de la clé pour l'éditer
6. Dans la section **Application restrictions**, sélectionnez **HTTP referrers (web sites)**
7. **Vérifiez que vous avez** :
   ```
   fluance.io/*
   *.fluance.io/*
   https://fluance-protected-content.firebaseapp.com/*
   ```
8. Si le domaine Firebase manque, ajoutez-le
9. Cliquez sur **Save**
10. Attendez 2-3 minutes pour que les changements prennent effet

### Solution 2 : Vérifier les noms des fonctions de l'extension

Les fonctions créées par l'extension peuvent avoir des noms différents selon la version. Vérifiez dans Firebase Console :

1. Allez dans Firebase Console > Functions > Functions
2. Cherchez les fonctions commençant par `ext-firebase-web-authn-`
3. Notez les noms exacts des fonctions

**Noms possibles** :
- `ext-firebase-web-authn-api` (fonction principale)
- `ext-firebase-web-authn-checkExtension`
- `webAuthn-checkExtension` (ancien nom, peut ne plus exister)

### Solution 3 : Mettre à jour le code si nécessaire

Si les fonctions ont des noms différents, il faut mettre à jour `src/assets/js/firebase-auth.js` pour utiliser les bons noms.

**Option A : Si les fonctions s'appellent `ext-firebase-web-authn-*`**

Il faut utiliser les noms complets avec le préfixe `ext-firebase-web-authn-`.

**Option B : Si l'extension expose une fonction via le rewrite**

L'extension peut être accessible via le rewrite `/firebase-web-authn-api` configuré dans `firebase.json`. Dans ce cas, il faut peut-être utiliser une approche différente.

## Vérification rapide

1. **Vérifier les fonctions déployées** :
   - Firebase Console > Functions > Functions
   - Cherchez les fonctions `ext-firebase-web-authn-*`

2. **Vérifier les restrictions de la clé API** :
   - Google Cloud Console > APIs & Services > Credentials
   - Vérifiez que `https://fluance-protected-content.firebaseapp.com/*` est autorisé

3. **Tester après corrections** :
   - Rechargez `/connexion-membre/`
   - Ouvrez la console du navigateur
   - Vérifiez que les erreurs 403 et 404 ont disparu
