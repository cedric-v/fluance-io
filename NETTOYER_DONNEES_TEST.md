# Nettoyer les Données de Test du Système de Réservation

Ce guide explique comment supprimer les données de test avant le lancement officiel.

## ⚠️ Important

**Ce script supprime définitivement les données.** Assurez-vous de :
- ✅ Avoir fait une sauvegarde si nécessaire
- ✅ Vérifier la liste des emails de test dans le script
- ✅ Confirmer que vous êtes prêt à supprimer ces données

## 📋 Prérequis

- Node.js installé
- Accès au projet Firebase `fluance-protected-content`
- Firebase Admin SDK configuré (via `firebase-admin`)

## 🚀 Utilisation

### 1. Modifier la liste des emails de test

Ouvrez `scripts/cleanup-test-bookings.js` et modifiez la liste `TEST_EMAILS` :

```javascript
const TEST_EMAILS = [
  'test@example.com',
  'test-essai@example.com',
  'cedricjourney+testres@gmail.com',
  // Ajoutez VOS emails de test ici
];
```

### 2. Vérifier la date limite

Par défaut, le script supprime toutes les réservations créées **avant aujourd'hui**. Si vous voulez une date différente, modifiez :

```javascript
const CUTOFF_DATE = new Date();
CUTOFF_DATE.setHours(0, 0, 0, 0); // Début de la journée d'aujourd'hui
```

### 3. Exécuter le script

```bash
node scripts/cleanup-test-bookings.js
```

Le script vous demandera de confirmer en tapant **"OUI"**.

## 🧹 Ce qui est supprimé

Le script nettoie automatiquement :

1. **Réservations (bookings)**
   - Toutes les réservations avec emails de test
   - Toutes les réservations créées avant la date limite
   - Met à jour les compteurs de participants dans les cours

2. **Pass (userPasses)**
   - Tous les pass associés aux emails de test

3. **Liste d'attente (waitlist)**
   - Toutes les entrées avec emails de test

4. **Tokens de désinscription (cancellationTokens)**
   - Tous les tokens liés aux réservations de test

5. **Emails en attente (mail)**
   - Tous les emails en attente d'envoi pour les emails de test

## 📊 Résultat

Le script affiche un résumé :
- Nombre de réservations supprimées
- Nombre de pass supprimés
- Nombre d'entrées en liste d'attente supprimées
- Nombre de tokens supprimés
- Nombre d'emails supprimés
- **Total** d'éléments supprimés

## 🔍 Vérification

Après l'exécution, vous pouvez vérifier dans Firebase Console :

1. **Firestore Database** → Collection `bookings`
   - Ne devrait plus contenir de réservations de test

2. **Firestore Database** → Collection `userPasses`
   - Ne devrait plus contenir de pass de test

3. **Firestore Database** → Collection `waitlist`
   - Ne devrait plus contenir d'entrées de test

## ⚙️ Mode non-interactif

Pour exécuter le script sans confirmation (utile pour l'automatisation) :

```bash
echo "OUI" | node scripts/cleanup-test-bookings.js
```

## 🛡️ Sécurité

Le script :
- ✅ Ne supprime que les données correspondant aux critères (emails de test + date limite)
- ✅ Met à jour correctement les compteurs de participants
- ✅ Demande confirmation avant de supprimer
- ✅ Affiche un résumé détaillé

## 📝 Notes

- Les emails contenant "test" ou "example.com" sont automatiquement considérés comme des emails de test
- Les réservations créées **aujourd'hui ou après** ne sont **PAS** supprimées
- Les compteurs de participants sont automatiquement ajustés

## 🆘 En cas de problème

Si vous avez supprimé des données par erreur :
1. Vérifiez les sauvegardes Firebase (si activées)
2. Contactez le support Firebase
3. Les données supprimées ne peuvent pas être récupérées facilement

---

**Bon lancement de la promotion ! 🚀**
