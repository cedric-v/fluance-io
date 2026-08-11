# Analyse des sources d'achat — Défi 21 jours

Date : 2026-08-11
Périmètre : tous les acheteurs du produit « 21jours » (hors comptes démo/test).
Données anonymisées (aucune PII — emails/UID volontairement remplacés par des identifiants neutres).

## Méthode

Pour chaque acheteur (identifiant depuis Firestore `users`), croisement des sources suivantes :

| Source de données | Rôle |
|---|---|
| Firestore `users`, `registrationTokens`, `newsletterConfirmations`, `journal_evenements_leads` | Traçabilité opt-in (source_optin, blog_source, formulaire, token) |
| Mailjet (contact + contactdata) | Propriétés `source_optin`, `site_source`, `blog_source`, `lead_magnet_source`, listes |
| Stripe Checkout | Sessions de paiement + métadonnées |
| Mollie/PayPal (webhook logs + API) | Paiements passés par Mollie (ex. PayPal) |

## Acheteurs du défi 21 jours (8 réels, hors démo/test)

| Client | Date d'achat | Paiement | Source identifiée |
|---|---|---|---|
| **Client E** | 2025-12-23 | Stripe (19 CHF) | **2 pratiques offertes + 5 jours offerts** (opt-ins fluance.io, confirmés le jour de l'achat) |
| **Client D** | 2026-01-01 | Stripe (19 CHF) | **2 pratiques offertes** (opt-in la veille, confirmé juste avant l'achat ; 5 jours offerts en avril 2026, après l'achat) |
| **Client H** | 2025-11-18 / accès 12-12 | Token | **Présentiel** (source_optin = `presentiel`, cliente réservant des cours en studio) |
| **Client A** | 2026-07-22 | PayPal via Mollie (19 CHF) | **Aucune trace d'opt-in** — achat direct, contact Mailjet créé le jour de la création du compte (05/08) |
| **Client B** | 2026-01-29 | Stripe (36 CHF : 21j + SOS) | **Aucune trace d'opt-in** — contact Mailjet créé le jour du paiement, aucune propriété |
| **Client C** | 2026-01-17 | Stripe (36 CHF : 21j + SOS) | **Aucune trace d'opt-in** — contact Mailjet créé le jour du paiement, aucune propriété |
| **Client F** | 2025-12-12 | n/d | **Aucune trace d'opt-in** — contact Mailjet créé le jour de l'achat, aucune propriété ni liste |
| **Client G** | 2025-11-18 / accès 12-12 | Token | **Newsletter Fluance** (liste principale, active) mais **sans source_optin** — opt-in non tracé |

*Compte test exclu de l'analyse.*

## Classification et pourcentages (8 acheteurs)

| Source | Nombre | Pourcentage |
|---|---|---|
| **Achat direct / source non tracée** | 5 | **62,5 %** |
| **Opt-ins fluance.io — 2 pratiques / 5 jours offerts** | 2 | **25 %** |
| **Présentiel (cours en studio)** | 1 | **12,5 %** |
| **Blogs (techniquesdemeditation, vie-explosive, devperso)** | 0 | **0 %** |

## Constats clés

1. **Aucun des 8 acheteurs du défi ne provient des 3 blogs.** Aucun n'apparaît dans
   `journal_evenements_leads` ni ne porte de propriétés blog (`site_source`,
   `blog_source`, `lead_magnet_source`) dans Mailjet.
2. **La majorité des achats (62,5 %) sont directs** : aucune trace d'opt-in avant
   l'achat (contact Mailjet créé au moment du paiement/création de compte, sans
   propriété ni liste). C'est le cas de la cliente récente (achat PayPal du 22/07/2026).
3. **Les seules sources identifiées sont les opt-ins propres à Fluance** :
   « 2 pratiques offertes » et « 5 jours offerts » (25 %) et le présentiel (12,5 %).
4. Les opt-ins blog ne génèrent donc **pas encore d'achats** du défi 21 jours —
   le funnel blog (mis en place ~mai 2026) n'a pas encore converti.

## Limites

- Les opt-ins blogs antérieurs à la migration vers Fluance (~avril/mai 2026)
  passaient par l'ancien hub Instant Académie (liste Mailjet distincte) — non
  interrogé ici faute d'accès. Les acheteurs de déc. 2025/janv. 2026 auraient pu
  y figurer.
- `source_optin` n'est pas systématiquement renseigné pour les opt-ins anciens
  (avant le déploiement des propriétés) : d'où la part « direct/non tracée ».
