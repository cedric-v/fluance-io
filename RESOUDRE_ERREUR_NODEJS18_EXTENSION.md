# Résoudre l'erreur Node.js 18 décommissioné pour l'extension Firebase WebAuthn

## Problème

L'extension Firebase WebAuthn essaie d'utiliser Node.js 18 qui est décommissioné. L'erreur indique :

```
Runtime nodejs18 is decommissioned and no longer allowed. 
Please use the latest Node.js runtime for Cloud Functions.
```

## Solutions

### Solution 1 : Changer la région (Recommandé)

La région `europe-west6` peut avoir des limitations. Utilisez une région mieux supportée comme `us-central1` ou `europe-west1`.

#### Étape 1 : Désinstaller l'extension actuelle

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **Extensions**
4. Trouvez l'extension **Firebase WebAuthn**
5. Cliquez sur **Uninstall** ou **Désinstaller**
6. Confirmez la désinstallation

**OU via CLI :**

```bash
firebase ext:uninstall firebase-web-authn
```

#### Étape 2 : Mettre à jour le fichier de configuration

Éditez le fichier `extensions/firebase-web-authn.env` et changez la région :

**Avant :**
```
LOCATION=europe-west6
```

**Après :**
```
LOCATION=us-central1
```

**OU :**
```
LOCATION=europe-west1
```

#### Étape 3 : Réinstaller l'extension

**Via Firebase Console :**

1. Allez dans **Extensions** > **Browse**
2. Recherchez "Firebase WebAuthn" par gavinsawyer
3. Cliquez sur **Install**
4. Lors de la configuration :
   - **Location** : Sélectionnez `us-central1` ou `europe-west1` (pas `europe-west6`)
   - **Relying Party ID** : `fluance.io`
   - **Relying Party Name** : `Fluance`
   - **Relying Party Origins** : 
     ```
     https://fluance.io
     https://www.fluance.io
     https://fluance-protected-content.firebaseapp.com
     ```
   - **Authenticator Attachment** : `any`
   - **Authenticator Attachment for Secondary Passkeys (2FA)** : `platform`
   - **User Verification Requirement** : `preferred`

**OU via CLI :**

```bash
firebase ext:install gavinsawyer/firebase-web-authn
```

Lors des prompts, sélectionnez `us-central1` ou `europe-west1` pour la région.

### Solution 2 : Mettre à jour l'extension

Vérifiez si une version plus récente de l'extension supporte Node.js 20 :

```bash
# Vérifier les versions disponibles
firebase ext:info gavinsawyer/firebase-web-authn

# Mettre à jour l'extension
firebase ext:update firebase-web-authn
```

Puis mettez à jour `firebase.json` si nécessaire :

```json
{
  "extensions": {
    "firebase-web-authn": "gavinsawyer/firebase-web-authn@latest"
  }
}
```

### Solution 3 : Vérifier la configuration dans firebase.json

Assurez-vous que votre `firebase.json` spécifie le bon runtime pour les fonctions (même si cela ne s'applique pas directement aux extensions, cela peut aider) :

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run lint"
    ]
  }
}
```

## Régions recommandées

Les régions suivantes sont bien supportées pour Firebase Functions :

- ✅ **us-central1** (Iowa, USA) - **Recommandé** (région par défaut, meilleure compatibilité)
- ✅ **europe-west1** (Belgium) - Bon pour l'Europe
- ✅ **asia-east1** (Taiwan) - Pour l'Asie
- ⚠️ **europe-west6** - Peut avoir des limitations

## Vérification après installation

1. Allez dans **Functions** > **Functions**
2. Vérifiez que les fonctions suivantes existent :
   - `ext-firebase-web-authn-api` (ou `webAuthn-checkExtension`)
   - `ext-firebase-web-authn-createUser` (ou `webAuthn-createUser`)
   - `ext-firebase-web-authn-signIn` (ou `webAuthn-signIn`)
   - `ext-firebase-web-authn-linkPasskey` (ou `webAuthn-linkPasskey`)

3. Vérifiez que le runtime est Node.js 20 ou plus récent :
   - Cliquez sur une fonction
   - Vérifiez la section **Configuration** > **Runtime**

## Mise à jour du code si nécessaire

Si vous changez de région, vous devrez peut-être mettre à jour le code dans `firebase-auth.js` pour utiliser la bonne région. Le code actuel essaie déjà `us-central1` puis `europe-west1`, donc si vous utilisez `us-central1`, cela devrait fonctionner automatiquement.

## Si le problème persiste

1. **Vérifiez les logs** dans Firebase Console > Functions > Logs
2. **Vérifiez la version de l'extension** : L'extension doit être à jour
3. **Contactez le support** : Si l'extension ne supporte toujours pas Node.js 20, contactez le développeur de l'extension ou utilisez une alternative

## Alternative : Utiliser une autre extension

Si l'extension Firebase WebAuthn continue à avoir des problèmes, vous pouvez :
- Attendre une mise à jour de l'extension
- Implémenter WebAuthn manuellement avec Cloud Functions
- Utiliser une autre solution d'authentification

## Notes importantes

- ⚠️ **Ne supprimez pas** l'extension sans sauvegarder la configuration
- ⚠️ **Attendez** 5-10 minutes après l'installation pour que les fonctions soient déployées
- ✅ **Testez** après l'installation sur `/connexion-firebase/`
