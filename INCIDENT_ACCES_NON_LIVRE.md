# Incident — Accès « 21 jours » non livré après paiement (22/07/2026)

> 🔒 **Note RGPD** : ce document est volontairement **anonymisé** — aucun nom,
> email, identifiant utilisateur, référence de paiement ni donnée personnelle.
> Le dépôt est **public** : aucune donnée personnelle de client ne doit jamais
> y figurer (voir `PROTECTION_DONNEES_PERSONNELLES.md`).

**Date de l'incident** : 22 juillet 2026 — traitement d'un paiement en ligne
(produit `21jours`, statut `paid`).

## Symptôme client

Un client a payé l'offre « Défi en 21 jours » le 22/07/2026 mais n'a jamais reçu
l'email d'activation (« Créez votre compte Fluance ») et ne pouvait pas accéder
à son cours.

## Diagnostic (état des lieux avant correction)

| Élément | État |
|---|---|
| Paiement (Mollie) | ✅ `paid` — 22/07/2026 |
| Token de registration (Firestore) | ✅ créé 22/07/2026, `used: false` |
| Email d'activation (Mailjet) | ❌ **jamais envoyé** (aucun contact, aucun message) |
| Compte Firebase Auth | ✅ créé (via lien email passwordless) |
| Document Firestore `users/{uid}` | ❌ **manquant** → accès au contenu protégé refusé |
| Entrée `audit_payments` | ❌ absente (échec silencieux) |

## Causes racines

1. **Template email manquant** : `functions/emails/creation-compte.html` (et la
   plupart des templates transactionnels) n'existait pas dans le bundle déployé
   des fonctions. `createTokenAndSendEmail()` lève une exception avant tout appel
   Mailjet → le client payant ne reçoit jamais son lien d'activation.
2. **Bug de build MJML** : dans `eleventy.config.mjs`, `mjml(...)` n'était pas
   `awaité` alors que mjml ≥ 5 renvoie une **Promise** → la compilation produisait
   `undefined` et aucun template n'était généré dans `functions/emails/`.
3. **Déploiement** : le hook `predeploy` de `firebase.json` ne régénérait pas les
   templates, et `functions/emails/*.html` est gitignoré → un déploiement des
   fonctions pouvait embarquer un dossier de templates incomplet.
4. **Échec silencieux** : dans `processMolliePayment`, l'échec du produit en ligne
   n'était que loggé (`console.error`) → aucune alerte admin, aucune trace
   `audit_payments`, aucun suivi possible.
5. **Chaîne de conséquence** : le compte Auth a été créé via le flux passwordless
   (email vérifié) qui ne crée **pas** le document Firestore `users/{uid}` ; sans
   ce document, l'autorisation de contenu protégé (client + `getProtectedContent`)
   refuse l'accès.

## Corrections appliquées

### Accès du client (fait, en production)
- Création du document Firestore `users/{uid}` avec produit `21jours` et
  `registrationDate = 22/07/2026` via le script générique
  `scripts/fix-user-firestore.js` (accès progressif correct).
- Token de registration marqué `used` (consommé par ce compte).

### Prévention (code — déployé)
- `eleventy.config.mjs` : `await mjml(...)` — la compilation MJML fonctionne.
- `scripts/build-email-templates.js` : compilation directe MJML → `functions/emails/`
  (29 templates). Ajouté au hook `predeploy` de `firebase.json` et au script npm
  `build:email-templates` → **tout déploiement de fonctions régénère les templates**.
- `src/emails/creation-compte-multiple.mjml` : template manquant créé (cross-sell).
- `functions/index.js` :
  - Fallback HTML minimal si un template est absent (`buildFallbackActivationEmail`) :
    un client payant reçoit **toujours** son lien d'activation.
  - Échecs « produit en ligne » désormais **visibles** : entrée `audit_payments` en
    erreur + alerte admin (Stripe, PayPal, Mollie).

## À faire si récidive

```bash
# 1. Déployer les fonctions (le predeploy compile automatiquement les templates)
firebase deploy --only functions

# 2. Vérifier l'accès du client (email fourni hors dépôt, jamais commité)
GOOGLE_CLOUD_QUOTA_PROJECT=fluance-protected-content \
  node check-user-firestore.js <EMAIL>
```

## Surveillance

- Si un client payant n'a pas reçu son email d'activation : vérifier
  `audit_payments` (`status: 'error'`) et la boîte mail admin (alertes « Paiement
  ... accepté mais accès non livré »).
- Après chaque changement de `src/emails/*.mjml`, relancer
  `npm run build:email-templates` avant de déployer les fonctions.
