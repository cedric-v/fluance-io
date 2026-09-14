# Note sur la version de Node.js

## ⚠️ Warning lors de l'installation

Si vous voyez ce warning lors de `npm install` dans `functions/` :

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'fluance-functions@1.0.0',
npm warn EBADENGINE   required: { node: '24' },
npm warn EBADENGINE   current: { node: 'v26.8.2', npm: '...' }
npm warn EBADENGINE }
```

**C'est normal et vous pouvez l'ignorer !**

## 📝 Explication

- **Firebase Functions** utilise Node 24 en production (`functions/package.json` → `"engines": { "node": "24" }`)
- Votre machine locale peut utiliser une version différente (Node 24, 26, etc.)
- Le warning apparaît car `package.json` spécifie `"node": "24"` pour correspondre à l'environnement de production
- **Le package s'installe correctement** malgré le warning

## ✅ Vérification

Pour vérifier que tout est OK :

```bash
cd functions
npm list stripe
```

Vous devriez voir `stripe@x.x.x` dans la liste.

## 🔧 Optionnel : Utiliser Node 24 en développement

Si vous voulez éviter le warning, vous pouvez utiliser `nvm` pour basculer vers Node 24 :

```bash
# Installer nvm (si pas déjà installé)
# Voir : https://github.com/nvm-sh/nvm

# Utiliser Node 24
nvm install 24
nvm use 24

# Puis installer les dépendances
cd functions
npm install
```

**Note** : Ce n'est pas nécessaire, c'est juste pour éviter le warning.

## 🚀 Déploiement

Lors du déploiement, Firebase utilisera automatiquement Node 24, donc pas de problème :

```bash
firebase deploy --only functions
```

## 📚 Voir aussi

- [Firebase Functions Node.js version](https://firebase.google.com/docs/functions/manage-functions#set_nodejs_version)
