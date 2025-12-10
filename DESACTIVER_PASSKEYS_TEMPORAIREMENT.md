# Désactiver temporairement l'onglet "Clé d'accès"

## Contexte

L'extension Firebase WebAuthn (version 10.4.2) utilise Node.js 18 qui est décommissioné. En attendant une mise à jour de l'extension, l'onglet "Clé d'accès" a été temporairement désactivé.

## État actuel

L'onglet "Clé d'accès" est **masqué** dans l'interface de connexion (`src/fr/connexion-firebase.md`).

## Réactiver l'onglet "Clé d'accès"

Une fois que l'extension Firebase WebAuthn sera mise à jour pour supporter Node.js 20 :

### Étape 1 : Retirer la classe `hidden`

Éditez `src/fr/connexion-firebase.md` et trouvez le bouton de l'onglet "Clé d'accès" :

**Avant (désactivé) :**
```html
<button
  id="tab-passkey"
  class="hidden flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-transparent text-[#1f1f1f]/60 hover:text-fluance hover:border-fluance/30"
  onclick="switchTab('passkey')"
>
  🔐 Clé d'accès
</button>
```

**Après (activé) :**
```html
<button
  id="tab-passkey"
  class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-transparent text-[#1f1f1f]/60 hover:text-fluance hover:border-fluance/30"
  onclick="switchTab('passkey')"
>
  🔐 Clé d'accès
</button>
```

### Étape 2 : Vérifier que l'extension est installée

1. Allez dans Firebase Console > Extensions
2. Vérifiez que l'extension **Firebase WebAuthn** est installée
3. Vérifiez que les Cloud Functions sont déployées dans Functions > Functions

### Étape 3 : Tester

1. Rechargez la page `/connexion-firebase/`
2. Vérifiez que l'onglet "Clé d'accès" est visible
3. Testez la connexion avec une clé d'accès

## Vérifier si l'extension supporte Node.js 20

Pour vérifier si une nouvelle version de l'extension supporte Node.js 20 :

```bash
# Vérifier les versions disponibles
firebase ext:info gavinsawyer/firebase-web-authn

# Vérifier sur extensions.dev
# https://extensions.dev/extensions/gavinsawyer/firebase-web-authn
```

Si une version plus récente existe avec Node.js 20 :

1. Mettez à jour l'extension :
   ```bash
   firebase ext:update firebase-web-authn
   ```

2. Réinstallez l'extension si nécessaire

3. Réactivez l'onglet "Clé d'accès" (voir Étape 1)

## Notes

- L'onglet est masqué avec la classe CSS `hidden` (Tailwind CSS)
- Le code JavaScript continue de fonctionner, mais l'onglet n'est pas visible
- Les autres méthodes d'authentification (mot de passe, connexion par email) continuent de fonctionner normalement
