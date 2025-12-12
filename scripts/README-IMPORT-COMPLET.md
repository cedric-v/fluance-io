# Guide : Importer le contenu du produit "complet"

Ce script permet d'importer les contenus du produit "Approche Fluance Complète" dans Firestore.

## Prérequis

1. **Service Account Key** : Téléchargez le fichier `serviceAccountKey.json` depuis Firebase Console
   - Allez sur [Firebase Console](https://console.firebase.google.com/)
   - Sélectionnez le projet : **fluance-protected-content**
   - Allez dans **Project Settings** > **Service Accounts**
   - Cliquez sur **Generate new private key**
   - Enregistrez le fichier JSON dans `functions/serviceAccountKey.json`

## Structure des contenus

Le script importe les contenus avec cette structure :
- **Bonus** (week: 0) : Accessible immédiatement
- **Semaine 1-6** : Déblocage hebdomadaire (1 contenu par semaine)

## Utilisation

```bash
node scripts/import-complet-content.js
```

## Structure Firestore

Chaque contenu est créé dans la collection `protectedContent` avec :

```javascript
{
  product: "complet",
  week: 0, // 0 = bonus, 1-14 = semaines
  title: "Titre du contenu",
  content: "<div>...code HTML embed...</div>",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Document IDs

Les documents sont créés avec les IDs suivants :
- `complet-week-0` : Bonus
- `complet-week-1` : Semaine 1
- `complet-week-2` : Semaine 2
- etc.

## Ajouter plus de contenus

Pour ajouter plus de contenus (jusqu'à 14 semaines), modifiez le tableau `completContent` dans `scripts/import-complet-content.js` et ajoutez les nouvelles entrées avec `week: 7`, `week: 8`, etc.

## Notes

- Le script met à jour les documents existants si nécessaire
- Les contenus sont triés par `week` dans l'espace membre
- Le bonus (week 0) est accessible immédiatement après achat
- Les semaines 1-14 se débloquent progressivement (1 par semaine)
