# Solution finale pour l'erreur "Unauthenticated" avec l'extension WebAuthn

## Problème identifié

L'extension Firebase WebAuthn rejette systématiquement les utilisateurs anonymes avec une erreur `401 Unauthenticated`, même si :
- ✅ L'authentification anonyme est activée dans Firebase Console
- ✅ L'utilisateur est bien authentifié anonymement
- ✅ Le token est présent et valide

## Cause probable

La fonction Cloud Function de l'extension (`ext-firebase-web-authn-fu06-api`) vérifie probablement le type d'authentification et rejette explicitement les utilisateurs anonymes, même si la documentation indique qu'elle devrait les accepter.

## Solutions possibles

### Solution 1 : Vérifier la configuration de l'extension

1. Allez dans Firebase Console > Extensions > firebase-web-authn-fu06
2. Vérifiez la configuration, notamment :
   - Les origines autorisées (Relying Party Origins)
   - Les paramètres d'authentification
   - Les règles de sécurité

### Solution 2 : Vérifier les règles de sécurité de la fonction

La fonction Cloud Function peut avoir des règles de sécurité qui rejettent les utilisateurs anonymes. Vérifiez dans :
- Firebase Console > Functions > ext-firebase-web-authn-fu06-api > Configuration
- Google Cloud Console > Cloud Functions > ext-firebase-web-authn-fu06-api > Permissions

### Solution 3 : Contacter le développeur de l'extension

Le problème peut être un bug dans l'extension. Contactez le développeur :
- GitHub : https://github.com/gavinsawyer/firebase-web-authn
- Issues : https://github.com/gavinsawyer/firebase-web-authn/issues

### Solution 4 : Utiliser une authentification non-anonyme

Si l'extension ne supporte vraiment pas l'authentification anonyme, il faudra peut-être :
1. Créer un compte temporaire avec email/password
2. Utiliser ce compte pour créer/lier le passkey
3. Puis permettre à l'utilisateur de se connecter avec le passkey

### Solution 5 : Vérifier la version de l'extension

Assurez-vous d'utiliser la dernière version de l'extension (10.4.4+) qui supporte Node.js 20 :

```bash
firebase ext:update firebase-web-authn-fu06
```

## État actuel

- ✅ Extension installée et déployée (version 10.4.4)
- ✅ Fonction Cloud Function déployée avec Node.js 22
- ✅ Authentification anonyme activée
- ✅ Base Firestore `ext-firebase-web-authn` créée
- ❌ La fonction rejette toujours les utilisateurs anonymes

## Prochaines étapes recommandées

1. **Vérifier les logs détaillés** de la fonction dans Firebase Console pour comprendre exactement pourquoi elle rejette l'appel
2. **Contacter le développeur** de l'extension pour signaler le problème
3. **Tester avec un utilisateur non-anonyme** pour voir si le problème persiste
4. **Vérifier la documentation** de l'extension pour voir si l'authentification anonyme est vraiment supportée

## Note importante

Le package `@firebase-web-authn/browser` n'est pas disponible via CDN unpkg, donc on ne peut pas l'utiliser directement dans le navigateur sans un bundler. Le code utilise actuellement la méthode directe (appels callable) avec un fallback si la bibliothèque était disponible.
