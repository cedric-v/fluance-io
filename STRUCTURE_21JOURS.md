# Structure pour le produit "21jours" - 22 vidéos avec accès progressif

## Vue d'ensemble

Le produit "21jours" comprend :
- **1 déroulé** (jour 0) - envoyé immédiatement après achat
- **21 vidéos de pratique** (jours 1 à 21) - une par jour pendant 21 jours

## Structure Firestore

### Collection : `protectedContent`

Chaque jour est un document séparé avec cette structure :

```
protectedContent/
  ├── 21jours-jour-0 (Déroulé)
  │   ├── product: "21jours" (requis)
  │   ├── day: 0 (requis)
  │   ├── title: "Déroulé" (requis)
  │   ├── content: "<div>...HTML du déroulé...</div>" (requis)
  │   ├── createdAt: Timestamp (optionnel - non utilisé pour 21jours)
  │   └── updatedAt: Timestamp (optionnel - non utilisé pour 21jours)
  │
  ├── 21jours-jour-1
  │   ├── product: "21jours" (requis)
  │   ├── day: 1 (requis)
  │   ├── title: "Ancrage et épaules" (requis)
  │   ├── content: "<div>...HTML de la vidéo jour 1...</div>" (requis)
  │   ├── createdAt: Timestamp (optionnel)
  │   └── updatedAt: Timestamp (optionnel)
  │
  ├── 21jours-jour-2
  │   ├── product: "21jours" (requis)
  │   ├── day: 2 (requis)
  │   ├── title: "Dos et hanches avec le 8" (requis)
  │   ├── content: "<div>...HTML...</div>" (requis)
  │   └── ...
  │
  └── 21jours-jour-21
      ├── product: "21jours" (requis)
      ├── day: 21 (requis)
      ├── title: "Jour 21" (requis)
      ├── content: "<div>...HTML...</div>" (requis)
      └── ...
```

### Collection : `users`

Le document utilisateur doit contenir :
```
users/
  └── {userId}
      ├── email: "user@example.com"
      ├── product: "21jours"
      ├── registrationDate: Timestamp  ← Date d'inscription/achat
      └── ...
```

## Liste des jours (22 jours de programme + 1 bonus = 23 au total)

| Jour | Document ID | Titre |
|------|-------------|-------|
| 0 | `21jours-jour-0` | Déroulé |
| 1 | `21jours-jour-1` | Ancrage et épaules |
| 2 | `21jours-jour-2` | Dos et hanches avec le 8 |
| 3 | `21jours-jour-3` | Rotation pour accroître la mobilité |
| 4 | `21jours-jour-4` | Crawl pour libérer la nuque et les épaules |
| 5 | `21jours-jour-5` | Tambour chinois |
| 6 | `21jours-jour-6` | Uppercut et verticalité |
| 7 | `21jours-jour-7` | Soulager le bas du dos |
| 8 | `21jours-jour-8` | Bascule arrière |
| 9 | `21jours-jour-9` | Détente des épaules |
| 10 | `21jours-jour-10` | Détente du bas du dos |
| 11 | `21jours-jour-11` | Mobilité assise |
| 12 | `21jours-jour-12` | Plaisir de marcher |
| 13 | `21jours-jour-13` | Salutation soleil |
| 14 | `21jours-jour-14` | Boost d'énergie |
| 15 | `21jours-jour-15` | Relâchement |
| 16 | `21jours-jour-16` | Plaisir de bouger vos bras |
| 17 | `21jours-jour-17` | Gorille |
| 18 | `21jours-jour-18` | La tête guide |
| 19 | `21jours-jour-19` | Jour 19 |
| 20 | `21jours-jour-20` | Jour 20 |
| 21 | `21jours-jour-21` | Jour 21 |
| 22 | `21jours-jour-22` | Bonus (jour 22) |

## Logique d'accès progressif

1. **Jour 0 (Déroulé)** : Accessible immédiatement après achat
2. **Jours 1-21** : Accessible à partir du jour correspondant depuis la date d'inscription
   - Jour 1 : accessible à partir du jour 1 après l'inscription
   - Jour 2 : accessible à partir du jour 2 après l'inscription
   - ...
   - Jour 21 : accessible à partir du jour 21 après l'inscription
3. **Jour 22 (Bonus)** : Accessible au jour 22 après l'inscription (21 jours après l'inscription)

## Création des documents dans Firestore

### Méthode 1 : Via Firebase Console (recommandé pour commencer)

Pour chaque jour (0 à 21) :

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Projet : **fluance-protected-content**
3. Firestore Database → collection `protectedContent`
4. Cliquez sur **Ajouter un document** / **Add document**
5. Document ID : `21jours-jour-0` (remplacez 0 par le numéro du jour)
6. Ajoutez les champs :

| Champ | Type | Valeur |
|-------|------|--------|
| `product` | string | `21jours` |
| `day` | number | `0` (ou 1, 2, 3... jusqu'à 21) |
| `title` | string | Titre du jour (voir tableau ci-dessus) |
| `content` | string | HTML du contenu (vidéo embed + texte) |
| `createdAt` | timestamp | Date actuelle |
| `updatedAt` | timestamp | Date actuelle |

### Méthode 2 : Script Node.js (pour créer tous les jours en une fois)

Créez un fichier `scripts/create-21jours-content.js` :

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const jours = [
  { day: 0, title: 'Déroulé' },
  { day: 1, title: 'Ancrage et épaules' },
  { day: 2, title: 'Dos et hanches avec le 8' },
  { day: 3, title: 'Rotation pour accroître la mobilité' },
  { day: 4, title: 'Crawl pour libérer la nuque et les épaules' },
  { day: 5, title: 'Tambour chinois' },
  { day: 6, title: 'Uppercut et verticalité' },
  { day: 7, title: 'Soulager le bas du dos' },
  { day: 8, title: 'Bascule arrière' },
  { day: 9, title: 'Détente des épaules' },
  { day: 10, title: 'Détente du bas du dos' },
  { day: 11, title: 'Mobilité assise' },
  { day: 12, title: 'Plaisir de marcher' },
  { day: 13, title: 'Salutation soleil' },
  { day: 14, title: 'Boost d\'énergie' },
  { day: 15, title: 'Relâchement' },
  { day: 16, title: 'Plaisir de bouger vos bras' },
  { day: 17, title: 'Gorille' },
  { day: 18, title: 'La tête guide' },
  { day: 19, title: 'Jour 19' },
  { day: 20, title: 'Jour 20' },
  { day: 21, title: 'Jour 21' },
];

async function createContent() {
  for (const jour of jours) {
    const docId = `21jours-jour-${jour.day}`;
    const docRef = db.collection('protectedContent').doc(docId);
    
    // Template HTML de base (à remplacer par le vrai contenu)
    const htmlContent = `
      <div class="protected-video-content">
        <h2 class="text-2xl font-bold mb-4">${jour.title}</h2>
        
        <div class="video-container mb-6">
          <!-- Remplacez VIDEO_ID par l'ID réel de la vidéo -->
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/VIDEO_ID" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
        
        <div class="content-text">
          <p class="mb-4">Contenu du jour ${jour.day} : ${jour.title}</p>
        </div>
      </div>
    `;
    
    await docRef.set({
      product: '21jours',
      day: jour.day,
      title: jour.title,
      content: htmlContent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Créé : ${docId} - ${jour.title}`);
  }
  
  console.log('\n✅ Tous les contenus ont été créés !');
}

createContent().catch(console.error);
```

## Mise à jour des documents utilisateur

Lors de la création d'un compte pour le produit "21jours", le champ `registrationDate` doit être défini :

```javascript
// Dans functions/index.js, lors de la création du compte
await db.collection('users').doc(userId).set({
  email: userEmail,
  product: '21jours',
  registrationDate: admin.firestore.FieldValue.serverTimestamp(), // ← Important !
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```

## Pages du site

Une page dédiée sera créée pour afficher le contenu du jour :
- `/cours-en-ligne/21jours/` - Page principale avec navigation jour par jour
- Le contenu du jour actuel s'affiche automatiquement selon la date d'inscription

