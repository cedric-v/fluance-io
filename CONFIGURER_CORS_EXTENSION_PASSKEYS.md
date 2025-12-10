# Configuration CORS pour l'extension Firebase WebAuthn

## Problème

Lors de l'utilisation des clés d'accès, vous pouvez rencontrer une erreur CORS :

```
Access to fetch at 'https://us-central1-fluance-protected-content.cloudfunctions.net/webAuthn-checkExtension' 
from origin 'https://fluance.io' has been blocked by CORS policy
```

## Solution

L'extension Firebase WebAuthn doit être configurée pour accepter les requêtes depuis votre domaine.

### 1. Vérifier la configuration de l'extension

1. Allez dans la [Console Firebase](https://console.firebase.google.com)
2. Sélectionnez votre projet `fluance-protected-content`
3. Allez dans **Extensions** > **Firebase WebAuthn**
4. Vérifiez la section **Configuration**

### 2. Configurer les origines autorisées

Dans la configuration de l'extension, assurez-vous que les **Relying Party Origins** incluent :

```
https://fluance.io
https://www.fluance.io
http://localhost:8080
```

**Important :** 
- Les origines doivent être exactes (avec `https://` ou `http://`)
- Pas de slash final (`/`)
- Une origine par ligne

### 3. Vérifier la région des Cloud Functions

L'extension déploie des Cloud Functions. Par défaut, elles sont dans `us-central1`, mais vous pouvez les déployer dans `europe-west1` si vous préférez.

Pour vérifier la région :
1. Allez dans **Functions** > **Functions**
2. Cherchez les fonctions `webAuthn-*`
3. Notez la région indiquée

### 4. Mettre à jour la configuration de l'extension

Si vous devez modifier la configuration :

1. Dans **Extensions** > **Firebase WebAuthn**, cliquez sur **Reconfigure**
2. Mettez à jour les **Relying Party Origins** avec toutes vos origines
3. Sauvegardez

**Note :** Après la reconfiguration, les Cloud Functions peuvent prendre quelques minutes à se mettre à jour.

### 5. Vérifier que les fonctions sont déployées

1. Allez dans **Functions** > **Functions**
2. Vérifiez que les fonctions suivantes existent :
   - `webAuthn-checkExtension`
   - `webAuthn-createUser`
   - `webAuthn-signIn`
   - `webAuthn-linkPasskey`

Si elles n'existent pas, l'extension n'est pas correctement installée.

### 6. Vérifier les permissions CORS dans les Cloud Functions

Si le problème persiste, vous pouvez vérifier manuellement les CORS dans les Cloud Functions :

1. Allez dans **Functions** > **Functions**
2. Cliquez sur une fonction `webAuthn-*`
3. Vérifiez la section **Configuration** > **CORS**

Les fonctions doivent accepter les requêtes depuis :
- `https://fluance.io`
- `https://www.fluance.io`

## Code actuel

Le code dans `firebase-auth.js` essaie automatiquement deux régions :
1. `us-central1` (région par défaut de l'extension)
2. `europe-west1` (si us-central1 échoue)

Cela permet une meilleure compatibilité, mais le problème CORS doit être résolu dans la configuration de l'extension.

## Test

Après avoir configuré l'extension :

1. Rechargez la page de connexion
2. Cliquez sur l'onglet "Clé d'accès"
3. Entrez un email
4. Cliquez sur "Se connecter avec une clé d'accès"

Si l'erreur CORS persiste, vérifiez :
- Que les origines sont correctement configurées dans l'extension
- Que les Cloud Functions sont bien déployées
- Que vous utilisez le bon domaine (https://fluance.io)

## Support

Si le problème persiste après avoir suivi ces étapes, vérifiez :
- Les logs des Cloud Functions dans la console Firebase
- La documentation de l'extension : https://extensions.dev/extensions/gavinsawyer/firebase-web-authn
