# Mettre à jour l'extension Firebase WebAuthn vers la version 10.4.4+

## ✅ Problème résolu

La version **10.4.4** de l'extension Firebase WebAuthn supporte maintenant **Node.js 20** et résout le problème de déploiement.

## Mise à jour de l'extension

### Option 1 : Via Firebase CLI (Recommandé)

```bash
# 1. Se connecter à Firebase
firebase login

# 2. Sélectionner le projet
firebase use fluance-protected-content

# 3. Mettre à jour l'extension
firebase ext:update firebase-web-authn
```

Lors des prompts, sélectionnez la version **10.4.4** ou plus récente.

### Option 2 : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **Extensions**
4. Trouvez l'extension **Firebase WebAuthn**
5. Cliquez sur **Update** ou **Mettre à jour**
6. Sélectionnez la version **10.4.4** ou plus récente
7. Suivez les étapes de mise à jour

### Option 3 : Mettre à jour firebase.json

Si vous préférez spécifier la version explicitement, éditez `firebase.json` :

```json
{
  "extensions": {
    "firebase-web-authn": "gavinsawyer/firebase-web-authn@10.4.4"
  }
}
```

Puis déployez :

```bash
firebase deploy --only extensions
```

## Vérification après mise à jour

### 1. Vérifier les Cloud Functions

1. Allez dans Firebase Console > Functions > Functions
2. Vérifiez que les fonctions suivantes existent :
   - `ext-firebase-web-authn-api` (ou `webAuthn-checkExtension`)
   - `ext-firebase-web-authn-createUser` (ou `webAuthn-createUser`)
   - `ext-firebase-web-authn-signIn` (ou `webAuthn-signIn`)
   - `ext-firebase-web-authn-linkPasskey` (ou `webAuthn-linkPasskey`)

### 2. Vérifier le runtime Node.js

1. Cliquez sur une fonction `ext-firebase-web-authn-*`
2. Vérifiez la section **Configuration** > **Runtime**
3. Le runtime doit être **Node.js 20** ou plus récent

### 3. Tester les passkeys

1. Allez sur `/connexion-membre/`
2. Cliquez sur l'onglet **🔐 Clé d'accès**
3. Testez la création et la connexion avec un passkey

## Si la mise à jour échoue

Si vous rencontrez des erreurs lors de la mise à jour :

1. **Désinstaller puis réinstaller** :
   ```bash
   firebase ext:uninstall firebase-web-authn
   firebase ext:install gavinsawyer/firebase-web-authn
   ```
   Lors de l'installation, sélectionnez la version **10.4.4** ou plus récente.

2. **Vérifier les logs** dans Firebase Console > Extensions > Firebase WebAuthn > Logs

3. **Vérifier la région** : Toutes les régions fonctionnent avec Node.js 20, y compris `europe-west6` (Zurich)

## Notes

- ⏳ La mise à jour peut prendre 5-10 minutes
- ✅ L'onglet "Clé d'accès" est maintenant activé dans l'interface
- ✅ Toutes les fonctionnalités passkeys sont disponibles avec la version 10.4.4+

## Support

Si vous rencontrez des problèmes :
- Vérifiez la [documentation de l'extension](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
- Consultez [RESOUDRE_ERREUR_NODEJS18_EXTENSION.md](./RESOUDRE_ERREUR_NODEJS18_EXTENSION.md)
