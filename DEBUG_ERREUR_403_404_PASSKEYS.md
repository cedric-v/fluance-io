# Dépannage : Erreurs 403 et 404 avec les Passkeys

## Problèmes identifiés

### Erreur 403 : "Requests from referer https://fluance-protected-content.firebaseapp.com/ are blocked"

**Cause** : Le domaine Firebase par défaut n'est pas autorisé dans les restrictions HTTP referrer de la clé API Firebase.

**Solution** : Ajouter le domaine Firebase aux restrictions de la clé API.

### Erreur 404 : La fonction Cloud `webAuthn-checkExtension` n'existe pas

**Cause** : L'extension Firebase WebAuthn n'est pas installée ou les Cloud Functions ne sont pas déployées.

**Solution** : Installer l'extension Firebase WebAuthn.

## Solution complète

### Étape 1 : Corriger l'erreur 403 (Restrictions de la clé API)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, allez dans **APIs & Services** > **Credentials**
4. Trouvez votre clé API (celle utilisée dans `firebase-auth.mjs`)
5. Cliquez sur le nom de la clé pour l'éditer
6. Dans la section **Application restrictions**, sélectionnez **HTTP referrers (web sites)**
7. **Ajoutez** le domaine Firebase :
   ```
   https://fluance-protected-content.firebaseapp.com/*
   ```
8. Assurez-vous que vous avez aussi :
   ```
   fluance.io/*
   *.fluance.io/*
   ```
9. Cliquez sur **Save**
10. Attendez 2-3 minutes pour que les changements prennent effet

### Étape 2 : Vérifier si l'extension Firebase WebAuthn est installée

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, cliquez sur **Extensions**
4. Vérifiez si l'extension **Firebase WebAuthn** (par gavinsawyer) est installée

**Si l'extension n'est PAS installée** : Voir [INSTALLER_EXTENSION_PASSKEYS.md](./INSTALLER_EXTENSION_PASSKEYS.md)

**Si l'extension est installée** : Vérifiez les Cloud Functions (étape 3)

### Étape 3 : Vérifier les Cloud Functions

1. Dans Firebase Console, allez dans **Functions** > **Functions**
2. Vérifiez que les fonctions suivantes existent :
   - `webAuthn-checkExtension`
   - `webAuthn-createUser`
   - `webAuthn-signIn`
   - `webAuthn-linkPasskey`

**Si les fonctions n'existent pas** :
- L'extension n'est pas correctement installée
- Réinstallez l'extension (voir [INSTALLER_EXTENSION_PASSKEYS.md](./INSTALLER_EXTENSION_PASSKEYS.md))
- Attendez 5-10 minutes pour que les fonctions soient déployées

**Si les fonctions existent** : Vérifiez la configuration CORS (étape 4)

### Étape 4 : Vérifier la configuration CORS de l'extension

1. Dans Firebase Console, allez dans **Extensions** > **Firebase WebAuthn**
2. Cliquez sur **Reconfigure** ou **Configurer**
3. Vérifiez la section **Relying Party Origins**
4. Assurez-vous que les origines suivantes sont configurées :
   ```
   https://fluance.io
   https://www.fluance.io
   https://fluance-protected-content.firebaseapp.com
   ```
5. Si nécessaire, ajoutez les origines manquantes
6. Sauvegardez la configuration
7. Attendez 5-10 minutes pour que les changements prennent effet

### Étape 5 : Tester

1. Rechargez la page `/connexion-membre/`
2. Ouvrez la console du navigateur (F12)
3. Cliquez sur l'onglet **🔐 Clé d'accès**
4. Entrez un email
5. Cliquez sur "Se connecter avec une clé d'accès"

**Résultats attendus** :
- ✅ Pas d'erreur 403 dans la console
- ✅ Pas d'erreur 404 dans la console
- ✅ Soit la connexion fonctionne, soit un message clair indique que l'extension n'est pas installée

## Vérification rapide

### Vérifier les restrictions de la clé API

```bash
# Dans Google Cloud Console > APIs & Services > Credentials
# Vérifiez que votre clé API a ces restrictions HTTP referrer :
- fluance.io/*
- *.fluance.io/*
- https://fluance-protected-content.firebaseapp.com/*
```

### Vérifier l'installation de l'extension

```bash
# Dans Firebase Console > Extensions
# Vérifiez que "Firebase WebAuthn" par gavinsawyer est installée
```

### Vérifier les Cloud Functions

```bash
# Dans Firebase Console > Functions > Functions
# Vérifiez que ces fonctions existent :
- webAuthn-checkExtension
- webAuthn-createUser
- webAuthn-signIn
- webAuthn-linkPasskey
```

## Messages d'erreur courants

### "L'extension Firebase WebAuthn n'est pas encore installée"

**Cause** : L'extension n'est pas installée ou les Cloud Functions ne sont pas déployées.

**Solution** :
1. Installez l'extension (voir [INSTALLER_EXTENSION_PASSKEYS.md](./INSTALLER_EXTENSION_PASSKEYS.md))
2. Attendez 5-10 minutes pour que les fonctions soient déployées
3. Vérifiez dans Firebase Console > Functions que les fonctions existent

### "Requests from referer https://fluance-protected-content.firebaseapp.com/ are blocked"

**Cause** : Le domaine Firebase n'est pas autorisé dans les restrictions de la clé API.

**Solution** :
1. Allez dans Google Cloud Console > APIs & Services > Credentials
2. Éditez votre clé API
3. Ajoutez `https://fluance-protected-content.firebaseapp.com/*` aux restrictions HTTP referrer
4. Sauvegardez et attendez 2-3 minutes

### "Preflight response is not successful. Status code: 404"

**Cause** : La fonction Cloud n'existe pas ou n'est pas accessible.

**Solution** :
1. Vérifiez que l'extension est installée
2. Vérifiez que les Cloud Functions sont déployées
3. Vérifiez la configuration CORS de l'extension

## Support

Si le problème persiste après avoir suivi ces étapes :

1. Vérifiez les logs des Cloud Functions dans Firebase Console > Functions > Logs
2. Vérifiez les logs de la console du navigateur pour d'autres erreurs
3. Consultez la documentation de l'extension : https://extensions.dev/extensions/gavinsawyer/firebase-web-authn
