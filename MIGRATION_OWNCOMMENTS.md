# Guide de migration OwnComments vers fluance-protected-content

## ✅ Modifications de code effectuées

1. **Règles Firestore mises à jour** (`firestore.rules`)
   - Support de la structure `comments/{pageId}/messages/{messageId}`
   - Lecture publique, écriture avec validation

2. **Configuration Firebase migrée**
   - `src/assets/js/firebase-auth.mjs` : utilise maintenant `fluance-protected-content`
   - `src/_includes/comment-section.njk` : utilise maintenant `fluance-protected-content`
   - Pages `5jours-j1.md` à `5jours-j5.md` : utilisent maintenant `fluance-protected-content`

3. **Affichage des commentaires**
   - Date/heure retirée de l'affichage (seul le nom et le texte sont affichés)

## 📋 Migration des données

### Pages à migrer

Mapping des URLs (ancien pageId → nouveau pageId) :

| Ancien pageId (encodé dans Firebase) | Nouvelle URL | Nouveau pageId (encodé) |
|--------------------------------------|--------------|-------------------------|
| `https%3A%2F%2Ffluance.io%2Fpar%2F5j-bienvenue` | `https://fluance.io/cours-en-ligne/5jours/j1/` | `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj1%2F` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fj2` | `https://fluance.io/cours-en-ligne/5jours/j2/` | `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj2%2F` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fjour3` | `https://fluance.io/cours-en-ligne/5jours/j3/` | `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj3%2F` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fj4` | `https://fluance.io/cours-en-ligne/5jours/j4/` | `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj4%2F` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fj5harmonie` | `https://fluance.io/cours-en-ligne/5jours/j5/` | `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj5%2F` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fmembres` | `https://fluance.io/membre/` (déroulé jour 0) | `https%3A%2F%2Ffluance.io%2Fmembre%2F%7C21jours-jour-0` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fmembres%2F21jours%2F1` | `https://fluance.io/membre/` (jour 1) | `https%3A%2F%2Ffluance.io%2Fmembre%2F%7C21jours-jour-1` |
| `https%3A%2F%2Ffluance.io%2Fpar%2Fmembres%2F21jours%2F3` | `https://fluance.io/membre/` (jour 3) | `https%3A%2F%2Ffluance.io%2Fmembre%2F%7C21jours-jour-3` |

**Note** : 
- Les pageId sont encodés avec `encodeURIComponent()`. Le script de migration gère automatiquement cette conversion.
- **Pour les 21 jours** : Le nouveau système utilise `contentId` pour différencier les jours. Le format est `URL|contentId` où `contentId = "21jours-jour-0"` pour le déroulé, `"21jours-jour-1"` pour le jour 1, etc. Cela permet d'avoir des commentaires séparés pour chaque jour même si l'URL reste `/membre/`.

### Processus de migration

#### Option 1 : Script Node.js (recommandé)

Le script `migrate-comments.js` est déjà créé dans le projet.

**Installation :**

```bash
npm install firebase-admin
```

**Configuration :**

1. Téléchargez les Service Account JSON pour les deux projets Firebase :
   - Ancien projet (`owncommentsfluance`) : Firebase Console → Project Settings → Service Accounts → Generate new private key
   - Nouveau projet (`fluance-protected-content`) : même procédure
2. Renommez les fichiers :
   - `old-project-service-account.json` (pour owncommentsfluance)
   - `new-project-service-account.json` (pour fluance-protected-content)
3. Placez-les à la racine du projet

**Exécution :**

```bash
node migrate-comments.js
```

Le script migre automatiquement tous les commentaires selon les mappings définis.

**Code du script :**

```javascript
const admin = require('firebase-admin');

// Configuration ancien projet (owncommentsfluance)
const oldServiceAccount = require('./old-project-service-account.json');
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount),
  projectId: 'owncommentsfluance'
}, 'old');

// Configuration nouveau projet (fluance-protected-content)
const newServiceAccount = require('./new-project-service-account.json');
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount),
  projectId: 'fluance-protected-content'
}, 'new');

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

async function migrateComments(oldPageId, newPageId) {
  console.log(`\nMigration des commentaires...`);
  console.log(`  Ancien: ${oldPageId}`);
  console.log(`  Nouveau: ${newPageId}`);
  
  const oldCommentsRef = oldDb.collection('comments').doc(oldPageId).collection('messages');
  const newCommentsRef = newDb.collection('comments').doc(newPageId).collection('messages');
  
  const snapshot = await oldCommentsRef.get();
  let count = 0;
  
  if (snapshot.empty) {
    console.log(`  ℹ️  Aucun commentaire à migrer`);
    return;
  }
  
  // Firestore limite les batches à 500 opérations
  const batchSize = 500;
  const batches = [];
  let currentBatch = newDb.batch();
  let currentBatchCount = 0;
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const newDocRef = newCommentsRef.doc(doc.id);
    currentBatch.set(newDocRef, data);
    count++;
    currentBatchCount++;
    
    if (currentBatchCount >= batchSize) {
      batches.push(currentBatch);
      currentBatch = newDb.batch();
      currentBatchCount = 0;
    }
  });
  
  // Ajouter le dernier batch s'il contient des opérations
  if (currentBatchCount > 0) {
    batches.push(currentBatch);
  }
  
  // Exécuter tous les batches
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  ✅ Batch ${i + 1}/${batches.length} committé`);
  }
  
  console.log(`  ✅ ${count} commentaire(s) migré(s) avec succès`);
}

async function main() {
  // Mapping des URLs (ancien pageId → nouveau pageId)
  const urlMappings = [
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2F5j-bienvenue',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j1/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj2',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j2/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fjour3',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j3/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj4',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j4/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj5harmonie',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j5/')
    }
    // Ajouter ici le mapping pour la page déroulé 21 jours si nécessaire
  ];
  
  console.log('🚀 Début de la migration des commentaires...\n');
  
  for (const mapping of urlMappings) {
    await migrateComments(mapping.old, mapping.new);
  }
  
  console.log('\n✅ Migration terminée !');
  process.exit(0);
}

main().catch(console.error);
```

#### Option 2 : Via Firebase Console (manuel)

1. Ouvrez Firebase Console pour `owncommentsfluance`
2. Allez dans Firestore Database
3. Pour chaque page (`comments/{pageId}/messages`):
   - Exportez les documents
   - Ouvrez Firebase Console pour `fluance-protected-content`
   - Importez les documents dans la même structure

#### Option 3 : Script Python

```python
from google.cloud import firestore
from google.oauth2 import service_account

# Configuration ancien projet
old_credentials = service_account.Credentials.from_service_account_file(
    'old-project-service-account.json'
)
old_db = firestore.Client(project='owncommentsfluance', credentials=old_credentials)

# Configuration nouveau projet
new_credentials = service_account.Credentials.from_service_account_file(
    'new-project-service-account.json'
)
new_db = firestore.Client(project='fluance-protected-content', credentials=new_credentials)

def migrate_comments(page_id):
    old_ref = old_db.collection('comments').document(page_id).collection('messages')
    new_ref = new_db.collection('comments').document(page_id).collection('messages')
    
    batch = new_db.batch()
    count = 0
    
    for doc in old_ref.stream():
        new_doc_ref = new_ref.document(doc.id)
        batch.set(new_doc_ref, doc.to_dict())
        count += 1
    
    if count > 0:
        batch.commit()
        print(f'✅ {count} commentaires migrés pour {page_id}')
    else:
        print(f'ℹ️  Aucun commentaire à migrer pour {page_id}')

# Pages à migrer
pages = [
    # Ajouter les pageId encodés ici
]

for page_id in pages:
    migrate_comments(page_id)
```

## 🔍 Vérification

Après la migration, vérifiez que :
1. Les commentaires s'affichent correctement sur les pages
2. Les nouveaux commentaires peuvent être ajoutés
3. Les règles Firestore fonctionnent (déployez `firestore.rules`)

## 📝 Notes importantes

### Structure des pageId

- **Pages 5 jours** : `encodeURIComponent(window.location.origin + window.location.pathname)`
  - Exemple : `https://fluance.io/cours-en-ligne/5jours/j1/` → `https%3A%2F%2Ffluance.io%2Fcours-en-ligne%2F5jours%2Fj1%2F`

- **Pages 21 jours** : `encodeURIComponent(window.location.origin + window.location.pathname + '|' + contentId)`
  - L'URL reste `/membre/` mais chaque jour a son propre `contentId`
  - Format : `https://fluance.io/membre/|21jours-jour-0` (déroulé)
  - Format : `https://fluance.io/membre/|21jours-jour-1` (jour 1)
  - Format : `https://fluance.io/membre/|21jours-jour-2` (jour 2)
  - etc.
  - Cela permet d'avoir des commentaires séparés pour chaque jour même si l'URL reste identique

### Migration

- Les timestamps sont préservés lors de la migration
- Le script gère automatiquement les batches (limite Firestore : 500 opérations par batch)
- Testez sur un environnement de développement avant la production
- **Important** : Ajoutez les fichiers Service Account JSON au `.gitignore` pour éviter de les commiter

### Commentaires pour les autres jours des 21 jours

Les commentaires pour les jours 2, 4-21 (et le bonus jour 22) n'ont pas besoin d'être migrés car :
- Ils n'existaient pas dans l'ancien système
- Le nouveau système crée automatiquement des commentaires séparés pour chaque jour via le `contentId`

**Note** : Seuls les jours 0 (déroulé), 1 et 3 ont été migrés car ils avaient des commentaires dans l'ancien système.

## 🚀 Déploiement des règles Firestore

```bash
firebase deploy --only firestore:rules --project fluance-protected-content
```

