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
- **International** : Taux **0%** (Bexio Tax ID: **3**).

### B. Sélection des Comptes
L'écriture comptable est générée comme suit :

| Sens | Compte (Variable) | Description |
|------|-------------------|-------------|
| **Débit** | `BEXIO_ACCOUNT_MOLLIE` | L'argent entre sur le compte intermédiaire Mollie. |
| **Crédit** | `BEXIO_ACCOUNT_SALES_...` | Vente enregistrée (3400 si Suisse, 3410 si International). |

### C. Écriture Manuelle (Manual Entry)
Une écriture de type `manual_single_entry` est créée dans Bexio via l'API 3.0.
- **Date** : Date du paiement (`paidAt`).
- **Libellé** : "Mollie Payment [ID] - [Description]".
- **Référence** : ID du paiement Mollie.
- **Montant** : Montant brut de la transaction.

---

## 4. Maintenance & Dépannage

### Logs
- Surveiller les logs dans la console Google Cloud Functions pour `webhookMollie` et `processMolliePayment`.
- Rechercher "Mollie Payment" ou "Bexio" pour filtrer.

### Points d'attention
- Si un paiement Mollie est remboursé (`refunded` ou `chargeback`), cette logique **ne traite actuellement que les paiements entrants (`paid`)**. Les remboursements doivent être gérés manuellement ou via une évolution future du script.
- Les **frais Mollie** ne sont pas déduits de cette écriture (c'est le montant brut qui est comptabilisé). Les frais perçus par Mollie sont généralement comptabilisés séparément lors du virement (Payout) de Mollie vers le compte bancaire, ou via une écriture de frais distincte.

### Mise à jour des Taux TVA
Si les IDs de taxe Bexio changent (ex: changement de taux légal), mettre à jour la logique dans `functions/index.js` (variable `taxId`).
