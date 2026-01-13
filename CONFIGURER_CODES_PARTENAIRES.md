# Configuration des Codes Partenaires

Ce document explique comment configurer et utiliser les codes partenaires pour appliquer des remises sur les réservations.

## Fonctionnement

Les codes partenaires permettent d'appliquer des remises sur certaines formules tarifaires. Actuellement, le champ "Code partenaire" apparaît uniquement lorsque l'utilisateur sélectionne le **Pass Semestriel**.

## Configuration des Codes Partenaires

Les codes partenaires sont configurés dans le backend et permettent d'appliquer des remises sur certaines formules tarifaires.

### Configuration Backend

Les codes sont définis dans deux fichiers (ils doivent être identiques dans les deux) :

1. **`functions/index.js`** - Fonction `validatePartnerCode` :
```javascript
const PARTNER_CODES = {
  'EXEMPLE10': {  // Remplacez par votre code réel
    discountPercent: 10,
    description: 'Remise partenaire 10%',
    validFor: ['semester_pass'], // Valide uniquement pour Pass Semestriel
  },
};
```

2. **`functions/services/bookingService.js`** - Fonction `calculatePriceWithDiscount` :
```javascript
const PARTNER_CODES = {
  'EXEMPLE10': {  // Même code ici aussi
    discountPercent: 10,
    description: 'Remise partenaire 10%',
    validFor: ['semester_pass'],
  },
};
```

### Comment ça fonctionne

1. **Frontend** : Lorsque l'utilisateur sélectionne "Pass Semestriel", un champ "Code partenaire" apparaît
2. **Validation** : L'utilisateur entre le code et clique sur "Appliquer"
3. **Vérification** : Le code est validé via l'API `validatePartnerCode`
4. **Affichage** : Si valide, la remise est affichée et le prix est mis à jour (ex: ~~340 CHF~~ → 306 CHF pour une remise de 10%)
5. **Paiement** : Lors de la réservation, le code est envoyé au backend qui applique la remise au montant final

## Ajouter un Nouveau Code Partenaire

Pour ajouter un nouveau code partenaire, suivez ces étapes :

### 1. Ajouter le code dans `functions/index.js`

Dans la fonction `validatePartnerCode`, ajoutez votre code dans l'objet `PARTNER_CODES` :

```javascript
const PARTNER_CODES = {
  'EXEMPLE10': {  // Exemple de code existant
    discountPercent: 10,
    description: 'Remise partenaire 10%',
    validFor: ['semester_pass'],
  },
  'NOUVEAUCODE': {  // ← Nouveau code
    discountPercent: 15,
    description: 'Remise spéciale 15%',
    validFor: ['semester_pass', 'flow_pass'], // Valide pour plusieurs formules
  },
};
```

### 2. Ajouter le code dans `functions/services/bookingService.js`

Dans la fonction `calculatePriceWithDiscount`, ajoutez le même code dans l'objet `PARTNER_CODES` :

```javascript
const PARTNER_CODES = {
  'EXEMPLE10': {  // Exemple de code existant
    discountPercent: 10,
    description: 'Remise partenaire 10%',
    validFor: ['semester_pass'],
  },
  'NOUVEAUCODE': {  // ← Même code ici aussi
    discountPercent: 15,
    description: 'Remise spéciale 15%',
    validFor: ['semester_pass', 'flow_pass'],
  },
};
```

### 3. Déployer les fonctions

Après avoir ajouté le code, déployez les fonctions Firebase :

```bash
cd functions
npm run deploy
```

## Paramètres d'un Code Partenaire

Chaque code partenaire doit avoir les propriétés suivantes :

- **`discountPercent`** (number) : Pourcentage de remise (ex: 10 pour 10%)
- **`description`** (string) : Description de la remise (affichée dans les logs)
- **`validFor`** (string[]) : Liste des formules pour lesquelles le code est valide
  - `'semester_pass'` : Pass Semestriel
  - `'flow_pass'` : Flow Pass
  - `'single'` : À la carte (non recommandé, car le champ n'apparaît que pour semester_pass)

## Exemple : Configuration d'un Code

Exemple de configuration pour un code avec remise de 10% :

- **Code** : `EXEMPLE10` (remplacez par votre code réel)
- **Remise** : 10%
- **Valide pour** : Pass Semestriel uniquement
- **Prix original** : 340 CHF
- **Prix avec remise** : 306 CHF (340 - 10% = 306)

## Test

Pour tester un code partenaire :

1. Allez sur la page de réservation : `https://fluance.io/presentiel/reserver/`
2. Sélectionnez un cours
3. Choisissez "Pass Semestriel"
4. Le champ "Code partenaire" apparaît
5. Entrez votre code partenaire et cliquez sur "Appliquer"
6. Vérifiez que le prix est mis à jour avec la remise
7. Complétez la réservation et vérifiez que le montant final correspond au prix avec remise

## Notes Importantes

- Les codes sont **insensibles à la casse** (EXEMPLE10 = exemple10 = Exemple10)
- Les codes sont **validés côté backend** pour éviter la triche
- La remise est **appliquée au montant final** avant création du PaymentIntent Stripe
- Les informations de remise sont **enregistrées dans Firestore** avec la réservation :
  - `partnerCode` : Le code utilisé
  - `discountAmount` : Montant de la remise en centimes
  - `discountPercent` : Pourcentage de remise
  - `originalAmount` : Montant avant remise
