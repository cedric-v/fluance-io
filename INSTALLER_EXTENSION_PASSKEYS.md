# Installation de l'extension Firebase WebAuthn pour les Passkeys

## Prérequis

- Firebase CLI installé (`npm install -g firebase-tools`)
- Projet Firebase configuré
- Authentification Firebase activée dans votre projet

## ⚠️ Important : Version de l'extension

**Utilisez la version 10.4.5 ou plus récente** (dernière version disponible) - Cette version supporte Node.js 20 (les versions antérieures à 10.4.4 utilisaient Node.js 18 qui est décommissioné).

> **⚠️ Dépréciation du service Firebase Extensions** : Google a annoncé la fin du service (décommission le 31 mars 2027). L'extension déjà installée continuera de fonctionner, mais plus aucune mise à jour/config modification ne sera possible après cette date. La documentation de migration (vers des fonctions auto-gérées) sera publiée en septembre 2026. Gardez l'extension à jour jusqu'au 31 mars 2027 et planifiez la migration. Voir [METTRE_A_JOUR_EXTENSION_PASSKEYS.md](./METTRE_A_JOUR_EXTENSION_PASSKEYS.md).

**Régions disponibles :**
- ✅ **us-central1** (Iowa, USA) - Région par défaut, bonne compatibilité
- ✅ **europe-west1** (Belgium) - Pour l'Europe
- ✅ **europe-west6** (Zurich, Suisse) - Pour la Suisse et l'Europe

Si vous rencontrez une erreur "Runtime nodejs18 is decommissioned", mettez à jour l'extension vers la version 10.4.4+ (voir [RESOUDRE_ERREUR_NODEJS18_EXTENSION.md](./RESOUDRE_ERREUR_NODEJS18_EXTENSION.md))

## Installation via Firebase CLI

### 1. Se connecter à Firebase

```bash
firebase login
```

### 2. Sélectionner le projet

```bash
firebase use fluance-protected-content
# ou votre projet Firebase
```

### 3. Installer l'extension

```bash
firebase ext:install gavinsawyer/firebase-web-authn
```

### 4. Configuration de l'extension

Lors de l'installation, vous devrez fournir :

#### Location (Région)
- **us-central1** (Iowa, USA) - Région par défaut
- **europe-west1** (Belgium) - Pour l'Europe
- **europe-west6** (Zurich, Suisse) - Pour la Suisse et l'Europe (latence minimale pour la Suisse)

**Note** : Toutes les régions fonctionnent avec la version 10.4.4+ de l'extension. Choisissez la région la plus proche de vos utilisateurs pour une meilleure latence.

#### Relying Party ID
- **Valeur recommandée** : `fluance.io` (votre domaine principal)
- **Alternative** : `www.fluance.io` si vous utilisez le sous-domaine www
- **Important** : Doit correspondre au domaine de votre site en production

#### Relying Party Name
- **Valeur recommandée** : `Fluance`
- Nom affiché lors de la création du passkey

#### Relying Party Origins
- **Valeurs recommandées** :
  - `https://fluance.io`
  - `https://www.fluance.io`
  - `http://localhost:8080` (pour le développement local)
- **Format** : Une origine par ligne
- **Important** : Doit inclure toutes les URLs où les passkeys seront utilisés

#### Authenticator Attachment
- **Valeur recommandée** : `any`
- **Options** :
  - `platform` : Uniquement les passkeys intégrés à l'appareil (empreinte, Face ID, etc.)
  - `cross-platform` : Uniquement les clés USB externes (YubiKey, etc.)
  - `any` : Les deux types (recommandé pour la flexibilité)
- **Recommandation** : `any` pour permettre aux utilisateurs d'utiliser soit leur appareil, soit une clé USB

#### Authenticator Attachment for Secondary Passkeys (2FA)
- **Valeur recommandée** : `platform`
- **Options disponibles** :
  - `platform` : Uniquement les passkeys intégrés à l'appareil (empreinte, Face ID, etc.)
  - `cross-platform` : Uniquement les clés USB externes (YubiKey, etc.)
- **Note** : L'option `any` n'est pas disponible pour les passkeys secondaires (2FA)
- **Recommandation** : `platform` pour une meilleure expérience utilisateur sur iOS et Android, où les passkeys intégrés sont les plus pratiques et courants

#### User Verification Requirement
- **Valeur recommandée** : `preferred`
- **Options** :
  - `required` : Vérification utilisateur obligatoire (biométrie, PIN) - Plus sécurisé mais moins flexible
  - `preferred` : Vérification préférée mais pas obligatoire - **Équilibre entre sécurité et flexibilité**
  - `discouraged` : Pas de vérification - Non recommandé pour la sécurité
- **Recommandation** : `preferred` pour un bon équilibre entre sécurité et expérience utilisateur, en utilisant la vérification quand elle est disponible sans bloquer les utilisateurs

### 5. Vérifier l'installation

Après l'installation, vérifiez que les Cloud Functions suivantes ont été créées :
- `webAuthn-checkExtension`
- `webAuthn-createUser`
- `webAuthn-signIn`
- `webAuthn-linkPasskey`

Vous pouvez vérifier dans la console Firebase : Functions > Functions

## Installation via Console Firebase

### 1. Accéder à la console Firebase

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionnez votre projet `fluance-protected-content`

### 2. Ouvrir Extensions

1. Dans le menu de gauche, cliquez sur **Extensions**
2. Cliquez sur **Browse** ou **Parcourir**

### 3. Rechercher l'extension

1. Recherchez "WebAuthn" ou "firebase-web-authn"
2. Cliquez sur l'extension **Firebase WebAuthn** par gavinsawyer

### 4. Installer l'extension

1. Cliquez sur **Install** ou **Installer**
2. Suivez les étapes de configuration (voir section 4 ci-dessus)

## Configuration post-installation

### Vérifier les Cloud Functions

Les fonctions suivantes doivent être disponibles :
- `webAuthn-checkExtension` : Vérifie si l'extension est installée
- `webAuthn-createUser` : Crée un utilisateur avec passkey
- `webAuthn-signIn` : Connexion avec passkey
- `webAuthn-linkPasskey` : Lie un passkey à un compte existant

### Tester l'installation

1. Allez sur votre page de connexion : `/connexion-membre`
2. Cliquez sur l'onglet **🔐 Passkey**
3. Entrez un email
4. Cliquez sur "Connexion avec passkey"

Si l'extension est correctement installée :
- Le navigateur proposera de créer/utiliser un passkey
- La connexion se fera automatiquement

Si l'extension n'est pas installée :
- Un message d'erreur s'affichera : "L'extension Firebase WebAuthn n'est pas encore installée"

## Dépannage

### Erreur : "functions/not-found"

**Cause** : L'extension n'est pas installée ou les Cloud Functions ne sont pas déployées.

**Solution** :
1. Vérifiez que l'extension est installée dans Firebase Console
2. Attendez quelques minutes pour que les fonctions soient déployées
3. Vérifiez dans Firebase Console > Functions que les fonctions existent

### Erreur : "Passkeys are not supported"

**Cause** : Le navigateur ne supporte pas WebAuthn/Passkeys.

**Solution** :
- Utilisez Chrome, Safari, Edge ou Firefox récent
- Vérifiez que vous êtes en HTTPS (requis pour WebAuthn)
- Vérifiez que votre système d'exploitation supporte les passkeys

### Erreur : "Invalid relying party"

**Cause** : Le domaine configuré ne correspond pas à l'URL actuelle.

**Solution** :
1. Vérifiez que le Relying Party ID correspond à votre domaine
2. Vérifiez que toutes les origines sont configurées dans l'extension
3. Pour le développement local, ajoutez `http://localhost:8080` aux origines

## Mise à jour de l'extension

Pour mettre à jour l'extension :

```bash
firebase ext:update gavinsawyer/firebase-web-authn
```

## Désinstallation

Si vous souhaitez désinstaller l'extension :

```bash
firebase ext:uninstall gavinsawyer/firebase-web-authn
```

**Attention** : Cela supprimera toutes les Cloud Functions associées et les utilisateurs ne pourront plus utiliser leurs passkeys.

## Support

- [Documentation de l'extension](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
- [Documentation WebAuthn MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [Firebase Extensions Hub](https://extensions.dev/)

## Notes importantes

- Les passkeys nécessitent **HTTPS** en production (déjà en place pour votre site)
- Les passkeys peuvent être synchronisés via iCloud Keychain (iOS/Mac) ou Google Password Manager
- Les utilisateurs peuvent avoir plusieurs méthodes d'authentification (email/password, passwordless, passkey) pour le même compte
- L'extension est compatible avec votre infrastructure Firebase Auth existante

