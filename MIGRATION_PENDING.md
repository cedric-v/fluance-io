# Migrations de dépendances

## ✅ firebase-admin v13 → v14 (terminée)

**Statut :** migration effectuée.

`firebase-functions@7.3.2` déclare désormais `firebase-admin: "^11.10.0 || ^12.0.0 || ^13.0.0 || ^14.0.0"`
dans ses peer dependencies, le blocage est donc levé.

Versions actuelles :
- `functions/package.json` : `firebase-admin: "^14.2.0"` (installé : `14.4.0`) ✅
- `package.json` (root) : `firebase-admin: "^14.2.0"` (installé : `14.4.0`) ✅
- `firebase-functions` : `^7.3.2` ✅

**Breaking changes v14 (déjà compatibles) :**
- Instance ID service supprimé → non utilisé
- Legacy namespace supprimé → non utilisé
- Legacy FCM types supprimés → non utilisés
- Node.js 18/20 non supportés → le projet est sur Node 24
- Error Handling revamp → compatible

**Vérification :**
```bash
npm view firebase-functions@latest peerDependencies
npm --prefix functions test
npm run build
```
