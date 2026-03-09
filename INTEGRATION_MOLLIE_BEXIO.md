# Documentation : Intégration Mollie & Bexio (Février 2026)

## Objectif
Cette intégration permet de traiter les paiements reçus via Mollie et de générer automatiquement les écritures comptables correspondantes dans Bexio sous forme de **Manual Entries** (Journaux), sans créer de fiches contacts individuelles.

---

## 1. Architecture

### Flux de Données
1. **Mollie Webhook** : Réception du paiement sur `webhookMollie`.
2. **Réponse Rapide** : La fonction répond immédiatement `200 OK` à Mollie pour éviter les timeouts.
3. **Pub/Sub** : Un message est publié sur le topic `process-mollie-payment` avec l'ID du paiement.
4. **Traitement Asynchrone** : La fonction `processMolliePayment` récupère les détails du paiement et interagit avec Bexio.

---

## 2. Configuration & Variables

### Secrets Firebase
Les clés et IDs sensibles sont stockés dans **Firebase Secrets**. Ils ne doivent jamais être dans le code source.

| Secret | Description | Valeur par défaut / Exemple |
|--------|-------------|-----------------------------|
| `MOLLIE_API_KEY` | Clé API Mollie (Live ou Test) | `live_...` |
| `BEXIO_API_TOKEN` | Token API Bexio (accès complet) | `...` |
| `BEXIO_ACCOUNT_MOLLIE` | Compte Bexio "Caisse Mollie" (Débit) | **1027** (ou autre compte caisse 10xx) |
| `BEXIO_ACCOUNT_SALES_CH` | Compte Ventes Suisse (Crédit) | **3400** (Prestations de services Suisse) |
| `BEXIO_ACCOUNT_SALES_INTL` | Compte Ventes International (Crédit) | **3410** (Prestations de services Étranger) |
| `BEXIO_ACCOUNT_FEES` | Compte de Frais Mollie (Débit) | **6941** (Frais Mollie) |
| `GOOGLE_SHEET_ID_SALES` | ID du Google Sheet pour le suivi des ventes | `...` |

### Configuration :
Pour définir une variable :
```bash
firebase functions:secrets:set MOLLIE_API_KEY
```

---

## 3. Logique Comptable (Accounting Logic)

Le système suit la **logique d'agrégation** (similaire à Stripe) plutôt que la création de factures individuelles par client.

### A. Détection du Pays & TVA
Le système détermine automatiquement si la vente est **Suisse (CH)** ou **Internationale** pour appliquer la bonne TVA.

**Priorité de détection :**
1. Métadonnées du paiement (`metadata.country`)
2. Détails du moyen de paiement (`payment.details.countryCode`)
3. Locale du paiement (`payment.locale`, ex: `fr_CH` -> `CH`)

**Règles TVA :**
- **Suisse (CH/LI)** : Taux **8.1%** (Bexio Tax ID: **14**).
- **International** : Taux **0%** (Bexio Tax ID: **4**).

### B. Sélection des Comptes & Montants
Une écriture de vente est générée systématiquement. Une écriture de frais est ajoutée uniquement si une commission est détectée (`amountFee > 0`).

#### 1. Écriture de Vente (CA Brut)
Le montant total payé par le client est enregistré comme vente (Crédit) et débité sur le compte Mollie.

| Sens | Compte (Variable) | Description | Montant |
|------|-------------------|-------------|---------|
| **Débit** | `BEXIO_ACCOUNT_MOLLIE` | Caisse Mollie | **Brut** |
| **Crédit** | `BEXIO_ACCOUNT_SALES_...` | Ventes (3400/3410) | **Brut** |

#### 2. Écriture de Frais (Commissions)
La commission Mollie est déduite du compte Caisse pour refléter le montant net réel restant.

| Sens | Compte (Variable) | Description | Montant |
|------|-------------------|-------------|---------|
| **Débit** | `BEXIO_ACCOUNT_FEES` | Frais (6941) | **Commission** |
| **Crédit** | `BEXIO_ACCOUNT_MOLLIE` | Caisse Mollie | **Commission** |

### C. Détails Techniques
- **Écritures** :
  - Toujours 1 `manual_single_entry` pour la vente (brut).
  - +1 `manual_single_entry` pour les frais si commission > 0.
- **TVA sur CA** :
  - **Suisse (CH/LI)** : Taux **8.1%** (Bexio Tax ID: **14**), calculé sur la base du montant **Brut**.
  - **International** : Taux **0%** (Bexio Tax ID: **4**).
- **TVA sur Frais** : Les commissions sont enregistrées sans influence TVA (Bexio Tax ID: **3** / 0%).
- **Tax Account** :
  - Vente : `tax_account_id` côté compte de vente (crédit).
  - Frais : `tax_account_id` côté compte de frais (débit).

---

## 4. Maintenance & Dépannage

### Logs
- Surveiller les logs dans la console Google Cloud Functions pour `webhookMollie` et `processMolliePayment`.
- Rechercher "Mollie Payment" ou "Bexio" pour filtrer.

### Points d'attention
- Si un paiement Mollie est remboursé (`refunded` ou `chargeback`), cette logique **ne traite actuellement que les paiements entrants (`paid`)**.
- Les **frais Mollie** sont automatiquement extraits via l'attribut `settlementAmount` de Mollie. S'il est manquant au moment du webhook, seule l'écriture de vente (Brut) est créée et un warning est loggé.

### Mise à jour des Taux TVA
Si les IDs de taxe Bexio changent (ex: changement de taux légal), mettre à jour la logique dans `functions/index.js` (variable `taxId`).

---

## 5. Liens de Paiement (Mollie)

### Architecture Technique
- **Frontend (`cedric-v`)** : Eleventy (11ty) + Modern CSS. Hébergé sur **GitHub Pages**. Les mises à jour sont déployées automatiquement via GitHub Actions (délai de build/cache d'environ 2-3 minutes).
- **Backend (`fluance-io`)** : Firebase Functions (Node.js). Gère la création des sessions Mollie et la réconciliation Bexio.
- **Paiements (`Mollie`)** : Hosted Checkout pour les paiements uniques et abonnements (SEPA Direct Debit).

### Pages de Paiement Manuelles (Cachées)
Pages créées pour être envoyées manuellement après un appel de qualification :

| Programme | URL de la page | Options de paiement |
|-----------|----------------|---------------------|
| **Focus SOS** | `https://cedricv.com/accompagnement/formules/focus-sos/bdc/3x/` | 1x 300 CHF<br>3x 100 CHF |
