# Migrations en attente

## firebase-admin v13 → v14

**Ouvert :** PRs #101, #104, #105
**Bloqué par :** `firebase-functions@7.2.5` a pour peer dependency :
```
firebase-admin: "^11.10.0 || ^12.0.0 || ^13.0.0"
```

**Quand ce sera OK :** Dès que `firebase-functions` publiera une version stable incluant `firebase-admin@^14.0.0` dans ses peer dependencies. Vérifier avec :
```bash
npm view firebase-functions@latest peerDependencies
```

**Breaking changes v14** (automatiquement compatibles) :
- Instance ID service supprimé → non utilisé
- Legacy namespace supprimé → non utilisé
- Legacy FCM types supprimés → non utilisés
- Node.js 18/20 non supportés → déjà sur Node 22
- Error Handling revamp → compatible

**Migration à exécuter quand le blocage sera levé :**
- `functions/package.json` : `firebase-admin: "^13.10.0"` → `"^14.0.0"`
- `package.json` (root) : `firebase-admin: "^13.10.0"` → `"^14.0.0"`
- `firebase-functions` : mettre à jour vers la version qui supporte v14
- `npm install` dans `functions/` et à la racine
- Tester avec `npm --prefix functions test` et `npm run build`
