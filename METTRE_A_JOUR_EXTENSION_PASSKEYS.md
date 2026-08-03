# Mettre à jour l'extension Firebase WebAuthn

## ✅ Version actuelle

La version **10.4.5** (dernière version disponible) est installée sur `fluance-protected-content`. Elle supporte **Node.js 20** et résout le problème de déploiement (les versions antérieures à 10.4.4 utilisaient Node.js 18, décommissionné).

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

Lors des prompts, sélectionnez la version **10.4.5** (ou la dernière disponible).

### Option 2 : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **Extensions**
4. Trouvez l'extension **Firebase WebAuthn**
5. Cliquez sur **Update** ou **Mettre à jour**
6. Sélectionnez la version **10.4.5** (ou la dernière disponible)
7. Suivez les étapes de mise à jour

### Option 3 : Mettre à jour firebase.json

Si vous préférez spécifier la version explicitement, éditez `firebase.json` :

```json
{
  "extensions": {
    "firebase-web-authn-fu06": "gavinsawyer/firebase-web-authn@10.4.5"
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
   Lors de l'installation, sélectionnez la version **10.4.5** (ou la dernière disponible).

2. **Vérifier les logs** dans Firebase Console > Extensions > Firebase WebAuthn > Logs

3. **Vérifier la région** : Toutes les régions fonctionnent avec Node.js 20, y compris `europe-west6` (Zurich)

## Notes

- ⏳ La mise à jour peut prendre 5-10 minutes
- ✅ L'onglet "Clé d'accès" est maintenant activé dans l'interface
- ✅ Toutes les fonctionnalités passkeys sont disponibles avec la version 10.4.5

## ⚠️ Dépréciation du service Firebase Extensions

Google a annoncé la **dépréciation du service Firebase Extensions** (mail reçu le 3 août 2026).

**Dates clés :**
- **Septembre 2026** : publication de la documentation, des outils et des options de migration (vers des fonctions auto-gérées avec comportement équivalent).
- **31 mars 2027** : dernière date pour installer de nouvelles extensions ou redéployer/mettre à jour des instances existantes.
- **Après le 31 mars 2027** : les instances déjà installées **continuent de fonctionner**, mais plus aucune modification de configuration, mise à jour ou patch de sécurité ne sera possible via le service. La désinstallation devra se faire manuellement (suppression des ressources Cloud associées : fonctions, secrets, comptes de service).

**Action requise :**
1. Garder l'extension à jour (dernière version : **10.4.5**) jusqu'au 31 mars 2027.
2. **Septembre 2026** : suivre la documentation de migration de Google et prévoir la migration vers des fonctions auto-gérées.
3. Avant la migration, **récupérer la configuration** de l'instance (`firebase ext:info firebase-web-authn-fu06` / console) qui servira de base.

**Voir aussi :** [FAQ officielle Firebase Extensions Deprecation](https://firebase.google.com/support/faq#extensions)

## Support

Si vous rencontrez des problèmes :
- Vérifiez la [documentation de l'extension](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
- Consultez [RESOUDRE_ERREUR_NODEJS18_EXTENSION.md](./RESOUDRE_ERREUR_NODEJS18_EXTENSION.md)
