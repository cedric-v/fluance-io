# Note : Changements Google Workspace APIs — usage tiers & MCP (nov. 2026)

> Source : email Google Cloud du 24.11.2026 (approx.), annoncé à tous les projets
> actifs utilisant des outils développeurs Google Workspace (APIs, MCP, CLI).
> Projet Google concerné : **fluance-protected-content** (le projet Firebase/GCP de fluance.io).

## TL;DR

**Rien à faire d'urgent.** Le projet utilise uniquement les APIs Calendar et Sheets
avec des volumes très faibles, largement sous les quotas du **Standard tier (gratuit)**.
Aucun agent IA n'accède aux données Workspace. Vérifier le dashboard après le
24.11.2026 pour confirmation, puis ne rien faire.

## Ce qui change chez Google

| Date | Changement |
|---|---|
| **24.11.2026** | Publication des 2 tiers d'usage pour Gmail, Drive et Calendar : **Standard** (gratuit, quotas publiés) et **Scaled** (payant au-delà des franchises quotidiennes, pour projets à fort volume). Toute nouvelle demande d'augmentation de quota exigera le Scaled tier. |
| **01.02.2027** | Début de l'**enforcement technique du MCP** : les agents IA et outils d'accès similaires devront passer par les serveurs MCP Google Workspace, et non plus par les REST APIs directement. |
| **01.04.2027** | Si aucune action : bascule automatique en **Standard tier gratuit** (limitation aux quotas publiés). |

Nouveautés annexes :

- Nouveau **dashboard développeur d'usage** des APIs Workspace (usage vs. quotas Standard + coûts estimés si Scaled).
- Nouvel **Addendum "Workspace AI Tools"** (termes) : interdiction du scraping des APIs Workspace par agents IA, stockage prolongé de données dérivées, etc. ; disclaimer sur les outils tiers.
- Support Google Cloud : les APIs Workspace sont **exclues de la variable de frais de support** jusqu'à au moins déc. 2027.

## Usage actuel du projet

D'après l'audit du code (`functions/`) :

| API | Usage dans le code | Volume | Impact |
|---|---|---|---|
| **Calendar API v3** | `services/googleService.js` : `syncCalendarToFirestore()`, planifiée toutes les heures (`10 * * * *`, `syncPlanningToFirestore`) + déclenchement manuel (`syncPlanningManual`) | ~24 appels/jour | ✅ Dans la 1ʳᵉ vague (Gmail/Drive/Calendar), mais très loin sous les quotas Standard |
| **Sheets API v4** | `services/googleService.js` : `appendUserToSheet()`, `markBookingsCancelledInSheet()`, etc. — suivi des inscriptions/reservations | Quelques appels/inscription | ⚠️ Pas dans la 1ʳᵉ vague (Sheets suivra "in the coming months"). Même conclusion : volume faible |
| Gmail API | **Non utilisée** (les emails passent par Mailjet) | — | Aucun |
| Drive API | **Non utilisée** | — | Aucun |

Les liens "Add to Google Calendar" dans `functions/index.js` sont de simples URLs
`calendar.google.com/calendar/render?action=TEMPLATE` ouvertes côté client — ce ne
sont pas des appels API, aucun impact.

## Pourquoi aucune action n'est requise

1. **Volume** : ~24 appels Calendar/jour, très en dessous des quotas Standard tier publiés.
2. **Pas d'agent IA** : l'exigence MCP ne vise que les *"AI agents or similar access
   tools"*. Nos Cloud Functions sont du code serveur déterministe avec service
   account — pas d'agent IA, donc pas de migration REST → MCP à faire.
3. **Par défaut** : sans action, le projet bascule automatiquement en Standard tier
   gratuit au 01.04.2027. Aucun coût, aucun changement de comportement attendu vu le volume.

## Actions planifiées

- [ ] **Après le 24.11.2026** : vérifier une fois le nouveau dashboard d'usage des
      APIs Workspace dans la console GCP (projet `fluance-protected-content`) :
      confirmer que la synchro horaire Calendar est sous les quotas Standard.
      Cocher ici une fois confirmé.
- [ ] **Si un jour un agent IA doit accéder à Gmail/Drive/Calendar** (p.ex. Claude
      via MCP) : utiliser les serveurs MCP Google Workspace officiels
      (https://developers.google.com/workspace/devguides/mcp), pas les REST APIs.

## Références

- Dashboard d'usage Workspace APIs : lien dans l'email Google / Help Center
- Configure the Google Workspace MCP servers : https://developers.google.com/workspace/devguides/mcp
- Workspace AI Tools Addendum : annoncé dans l'email, détails dans le Help Center
- Audit initial du code : 25.11.2026 (ce fichier)