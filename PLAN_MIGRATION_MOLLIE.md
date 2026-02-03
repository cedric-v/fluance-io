# Plan de Migration : Stripe vers Mollie

Cette documentation détaille la stratégie technique pour remplacer Stripe (Elements & Checkout) par Mollie sans perdre de fonctionnalités clés (Cross-sells, Abonnements, Réservations).

---

## 1. Stratégie Globale

**Approche recommandée : Mollie Hosted Checkout**
Au lieu de réimplémenter des formulaires de carte bancaire intégrés ("Elements") qui complexifient la gestion PCI-DSS et limitaient les moyens de paiement (TWINT est complexe en intégré), nous utiliserons la **Page de Paiement Hébergée de Mollie**.
*   **Avantages** : Support natif de TWINT, PostFinance, cartes, Apple Pay sans code supplémentaire.
*   **Expérience utilisateur** : Redirection fluide (similaire à Stripe Checkout).

---

## 2. Solutions par Fonctionnalité

### A. Remplacement de Stripe Elements (Réservations / Booking)
Actuellement, `booking.js` monte un formulaire Stripe dans la modale.

**Solution Proposée :**
1.  **UI** : Dans la modale, remplacer le formulaire de carte par un récapitulatif de la commande et un bouton "Payer avec Mollie".
2.  **Flux** :
    *   Clic sur "Payer" -> Appel à `createMolliePayment` (Cloud Function).
    *   La fonction crée un paiement Mollie avec les métadonnées de réservation.
    *   Le frontend redirige l'utilisateur vers `payment.getCheckoutUrl()`.
3.  **Retour** :
    *   L'utilisateur revient sur `/booking-confirmed` (comme actuellement).
    *   Mollie notifie le webhook pour valider l'écriture comptable (déjà implémenté).

### B. Remplacement de Stripe Checkout (Produits : 21 jours, Complet)
Actuellement, `payment.njk` redirige vers Stripe Checkout.

**Solution Proposée :**
1.  **Backend** : Modifier/Créer une fonction `createMolliePayment` capable de gérer les produits "21jours", "complet" (abonnement).
2.  **Abonnements ("Complet")** :
    *   Mollie gère les abonnements différemment.
    *   **Étape 1** : Créer un "Première paiement" (First Payment) pour valider le mandat (Mandate).
    *   **Étape 2** : Le webhook détecte ce premier paiement et crée l'abonnement via l'API Mollie (si nécessaire) ou Mollie le gère automatiquement si on configure un "Recurring" payment.
    *   *Alternative simple* : Utiliser l'API Subscription de Mollie qui nécessite un `customerId` et un `mandate`. Le premier paiement sert à créer le mandat.

### C. Gestion du Cross-Sell "SOS Dos & Cervicales"
Actuellement, Stripe Checkout propose probablement cet ajout via sa configuration interne.

**Solution Proposée (Order Bump) :**
Mollie Checkout ne propose pas de "Pop-up" pour ajouter des produits. Nous devons le gérer **avant** la redirection.
1.  **Frontend** : Modifier la page de vente ou le bouton d'achat pour ajouter une case à cocher (ou une modale intermédiaire) :
    *   *[ ] Ajouter le programme "SOS Dos & Cervicales" pour 17 CHF (au lieu de 47 CHF)*
2.  **Logique** :
    *   Si coché, l'appel à la Cloud Function inclut `{ includeSosDos: true }`.
3.  **Backend** :
    *   La fonction calcule le total : Prix Produit + 17 CHF.
    *   La description Mollie devient : "Produit Principal + SOS Dos".
    *   Les métadonnées incluent le flag pour donner accès aux deux programmes.


### D. Solution Détaillée : Cours en Présentiel (Produits Spécifiques)

Le système de réservation actuel gère trois types de produits qui nécessitent une migration précise :

1.  **Séance Unique (25 CHF)**
    *   **Type** : Paiement unique (One-off).
    *   **Implémentation Mollie** : Appel standard à `createMolliePayment` avec un montant de 25.00 CHF.
    *   **Métadonnées** : `{ type: 'single', credits: 1 }`.

2.  **Flow Pass (210 CHF)**
    *   **Type** : Paiement unique pour 10 crédits.
    *   **Implémentation Mollie** : Appel standard à `createMolliePayment` avec un montant de 210.00 CHF.
    *   **Métadonnées** : `{ type: 'flow_pass', credits: 10 }`.
    *   **Webhook** : À la réception du paiement, le système crédite 10 séances au compte utilisateur.

3.  **Pass Semestriel (340 CHF)**
    *   **Type** : Abonnement récurrent (Recurring / Subscription).
    *   **Défi** : Contrairement à Stripe qui gère tout en un appel, Mollie nécessite la création d'un mandat de prélèvement.
    *   **Flux de Migration** :
        1.  **Premier Paiement** : Créer un paiement Mollie de 340 CHF avec `sequenceType: 'first'`. Cela demande au client d'autoriser les futurs prélèvements.
        2.  **Création du Mandat** : Une fois ce paiement réussi (`paid`), Mollie génère automatiquement un mandat (Mandate) sur le `customerId`.
        3.  **Activation de l'Abonnement (Webhook)** :
            *   Le webhook reçoit la confirmation du paiement de 340 CHF.
            *   Le backend détecte qu'il s'agit d'un "Pass Semestriel".
            *   Le backend appelle l'API Mollie `subscriptions.create` pour ce client, configuré pour :
                *   Montant : 340 CHF.
                *   Fréquence : `6 months`.
                *   Date de début : `NOW` + 6 mois.
    *   **Avantage** : Automatisation complète du renouvellement semestriel.

---

## 3. Plan d'Implémentation

### Étape 1 : Backend (`functions/index.js`)
Créer une fonction unifiée `createMollieCheckoutSession` (ou `createMolliePayment`) qui remplace `createStripeCheckoutSession`.
*   **Paramètres** : `product` (21jours/complet/rdv), `variant`, `includeSosDos` (bool), `email`, `firstName`.
*   **Logique** :
    *   Créer client Mollie (si nouveau).
    *   Calculer montant total.
    *   Appel `mollieClient.payments.create`.

### Étape 2 : Frontend "Booking" (`booking.js`)
*   Supprimer `stripe.elements`, `handleStripePayment`.
*   Ajouter `handleMolliePayment` qui appelle la nouvelle fonction et redirige.

### Étape 3 : Frontend "Produits" (`payment.njk` & Pages)
*   Ajouter l'interface "Order Bump" (Case à cocher) sur les pages de vente.
*   Mettre à jour `redirectToStripeCheckout` pour appeler `createMollieCheckoutSession`.

### Étape 4 : Gestion des Abonnements (Backend)
*   Pour "Complet - Mensuel/Trimestriel", il faut gérer la création de l'abonnement récurrent après le premier paiement réussi (dans le Webhook ou via le flow "First Payment").

---

## 4. Exemple de Code (Frontend - Order Bump)

```html
<!-- Exemple pour la page de vente -->
<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
  <label class="flex items-center space-x-3 cursor-pointer">
    <input type="checkbox" id="cross-sell-sos-dos" class="form-checkbox h-5 w-5 text-fluance">
    <span class="text-[#3E3A35]">
      <strong>Offre spéciale :</strong> Ajouter "SOS Dos & Cervicales" pour seulement <span class="line-through">47 CHF</span> <strong>17 CHF</strong> ?
    </span>
  </label>
</div>

<button onclick="buyWithMollie()">S'inscrire</button>

<script>
function buyWithMollie() {
  const includeSosDos = document.getElementById('cross-sell-sos-dos').checked;
  window.FluancePayment.redirectToMollie('21jours', null, 'fr', includeSosDos);
}
</script>
```
