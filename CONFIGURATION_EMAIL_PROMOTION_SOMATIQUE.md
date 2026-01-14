# Configuration Email Promotion Cours en Ligne - Approche Somatique

## 📧 Templates créés

### 1. Email principal : `promotion-complet-somatique.mjml`
**Sujet suggéré :** "Quand votre corps vous dit qu'il en a assez"

**Contenu :** Email complet expliquant la différence entre "bouger pour ressentir" et "ressentir puis bouger", avec focus sur l'approche somatique de Fluance.

### 2. Email relance : `promotion-complet-somatique-relance.mjml`
**Sujet suggéré :** "Bouger à partir de son ressenti"

**Contenu :** Version courte et percutante, rappelant les concepts clés avec un appel à l'action direct.

### 3. Email sommeil : `promotion-complet-sommeil.mjml`
**Sujet suggéré :** "Se réveiller à 2h du matin ne signifie pas que vous êtes cassé·e"

**Contenu :** Email sur le sommeil biphasique et le lien entre mouvement doux pendant la journée et qualité du sommeil. Adapté à l'approche Fluance.

---

## ⏰ Timing d'envoi recommandé

### Approche hybride : Trigger temporel + Relance saisonnière

**Stratégie :** Combiner les deux approches pour maximiser les conversions tout en restant pertinent contextuellement.

#### 1. Email principal (trigger temporel) - APPROCHE PRINCIPALE
**Moment d'envoi :** J+45 à J+50 (fenêtre de 5 jours après téléchargement)

**Trigger :**
- 45 jours après téléchargement des 2 pratiques gratuites (si non converti)

**Avantages :**
- ✅ Personnalisé à chaque contact
- ✅ Timing optimal basé sur leur propre parcours
- ✅ Plus pertinent car lié à leur action (téléchargement)
- ✅ Permet de toucher les contacts toute l'année au bon moment pour eux

#### 2. Email principal (relance saisonnière) - APPROCHE COMPLÉMENTAIRE
**Moment d'envoi :** Entre le 15 et le 21 de chaque mois en novembre et février (2-3 semaines après l'email sommeil)

**Triggers :**
- Contact a téléchargé les 2 pratiques il y a plus de 60 jours
- N'a pas reçu l'email principal récemment (ou l'a reçu il y a plus de 30 jours)
- **A reçu l'email sommeil ce mois-ci** (priorité à l'email sommeil)
- **N'est pas devenu client entre temps**
- Non converti

**Avantages :**
- ✅ Synergie avec les périodes où la fatigue est naturellement plus présente
- ✅ Message plus pertinent contextuellement
- ✅ Rattrape les contacts qui n'ont pas converti après le trigger principal
- ✅ Crée une "campagne" saisonnière cohérente
- ✅ **Évite le conflit avec l'email sommeil** : envoyé 2-3 semaines après, pas le même jour
- ✅ **Respecte la priorité** : l'email sommeil passe en premier, l'email somatique suit

### Email relance
**Moment d'envoi :** J+8 (8 jours après l'email principal)

**Pourquoi J+8 ?**
- ✅ Assez de temps pour réfléchir sans être oublié
- ✅ Cohérent avec les autres relances du système (J+8 utilisé pour relances 21 jours)
- ✅ Équilibre optimal entre efficacité marketing et non-intrusion
- ✅ Permet de rester dans l'esprit sans être pushy

**Condition :** Envoyer uniquement si le contact n'a pas cliqué sur le CTA de l'email principal

---

## 🎯 Public cible

### Segment 1 : Contacts ayant téléchargé les 2 pratiques (trigger temporel)
- **Critères :** Téléchargement des 2 pratiques gratuites il y a 45-50 jours
- **Statut :** Non abonné aux cours en ligne
- **Email :** Principal (J+45 à J+50)
- **Approche :** Personnalisé, basé sur le parcours individuel du contact
- **Raison :** Timing optimal lié à leur propre parcours, plus pertinent et efficace

### Segment 2 : Relance saisonnière somatique (pour non-convertis)
- **Critères :** 
  - A téléchargé les 2 pratiques il y a plus de 60 jours
  - N'a pas reçu l'email principal récemment (ou l'a reçu il y a plus de 30 jours)
  - Non abonné aux cours en ligne
  - **A reçu l'email sommeil ce mois-ci** (priorité à l'email sommeil)
  - **N'est pas devenu client entre l'email sommeil et maintenant**
- **Moment :** 
  - **Novembre** (entre le 15 et le 21 du mois) - 2-3 semaines après l'email sommeil
  - **Février** (entre le 15 et le 21 du mois) - 2-3 semaines après l'email sommeil
- **Email :** Principal (version saisonnière)
- **Approche :** Complémentaire au trigger temporel, pour rattraper les non-convertis
- **Raison :** 
  - Synergie avec les périodes où la fatigue est naturellement plus présente
  - Permet de toucher les contacts qui n'ont pas converti après le trigger principal
  - **Évite le conflit avec l'email sommeil** : envoyé 2-3 semaines après, pas le même jour
  - **Priorité à l'email sommeil** : ne s'envoie que si l'email sommeil a été envoyé ce mois-ci

### Segment 3 : Relance après email principal
- **Critères :** A reçu l'email principal (trigger temporel ou saisonnier), pas de clic sur CTA
- **Moment :** J+8 après email principal (J+53 à J+58 pour trigger temporel)
- **Email :** Relance

### Segment 4 : Email sommeil (relance saisonnière)
- **Critères :** Tous les contacts non abonnés
- **Moment :** 
  - **Novembre** (le 2 du mois) - avant l'hiver, période où le sommeil peut être perturbé par le changement de saison et la baisse de lumière (évite la Toussaint le 1er)
  - **Février** (le 1er du mois) - milieu d'hiver, fatigue accumulée, période où les troubles du sommeil sont fréquents
  - **Mars** (le 1er du mois) - changement de saison, transition hiver/printemps, période de fatigue
- **Email :** Sommeil
- **Raison :** Ces périodes sont propices aux troubles du sommeil et à la fatigue, le message sur le sommeil biphasique et le lien avec le mouvement doux est particulièrement pertinent
- **Implémentation :** Fonction scheduled `sendPromotionalEmails` s'exécute quotidiennement à 8h et vérifie si on est le 1er du mois en novembre, février ou mars

---

## 🔧 Intégration dans le système

### Variables disponibles
- `{{firstName}}` : Prénom du contact

### URLs des CTAs
- Email principal : `https://fluance.io/cours-en-ligne/approche-fluance-complete/`
- Email relance : `https://fluance.io/cours-en-ligne/approche-fluance-complete/`
- Email sommeil : `https://fluance.io/cours-en-ligne/approche-fluance-complete/`

### Compilation
Les templates sont compilés automatiquement lors de `npm run build:11ty` et copiés dans `functions/emails/`.

### Fonction scheduled
La fonction `sendPromotionalEmails` s'exécute **quotidiennement à 8h (Europe/Paris)** et gère automatiquement :
- L'envoi de l'email sommeil le 2 novembre (évite la Toussaint) et le 1er février et mars
- L'envoi de l'email somatique principal 45 jours après le téléchargement des 2 pratiques (trigger temporel)
- L'envoi de l'email somatique saisonnier entre le 15 et le 21 de chaque mois en novembre et février (2-3 semaines après l'email sommeil, pour non-convertis)
- L'envoi de l'email somatique relance 8 jours après l'email principal (J+53)

**Fichier :** `functions/index.js` (ligne ~7996)

**Approche hybride :**
- Le trigger temporel (J+45) reste la méthode principale, personnalisée et efficace
- La relance saisonnière (novembre/février) complète pour rattraper les non-convertis pendant les périodes de fatigue
- Un contact ne reçoit pas les deux : la relance saisonnière ne s'envoie que si le trigger principal a été envoyé il y a plus de 30 jours ou n'a jamais été envoyé

**Gestion des conflits :**
- **Priorité à l'email sommeil** : envoyé le 2 novembre (évite la Toussaint) et le 1er février/mars
- **Email somatique saisonnier décalé** : envoyé 2-3 semaines après (15-21 du mois) pour éviter d'envoyer deux emails le même jour
- **Vérification du statut client** : l'email somatique saisonnier ne s'envoie que si le contact n'est pas devenu client entre l'email sommeil et maintenant
- **Condition préalable** : l'email somatique saisonnier ne s'envoie que si l'email sommeil a été envoyé ce mois-ci

---

## 📊 Points clés du message

### Concepts intégrés
1. **Fatigue latente** : "Cette fatigue qui persiste même après le repos"
2. **État "à plat"** : "Vous n'êtes pas triste. Vous n'êtes pas en colère. Vous êtes simplement... à plat"
3. **Rythme extérieur vs intérieur** : "Vous fonctionnez sur un rythme qui n'est pas le vôtre, mais celui des contraintes extérieures"
4. **Bouger pour ressentir vs Ressentir puis bouger** : Différenciation clé
5. **Corps qu'on entraîne vs Corps qu'on habite** : Transformation de la relation au corps
6. **Laisser le corps informer** : Accès aux émotions bloquées et système d'auto-régénération

### Concepts intégrés (Email sommeil)
1. **Sommeil biphasique** : Normalité historique du réveil nocturne
2. **Héritage ancestral** : Le réveil nocturne n'est pas forcément un trouble
3. **Lien mouvement-sommeil** : Mouvement doux pendant la journée améliore le sommeil
4. **Effet cumulatif** : Chaque amélioration crée les conditions pour la suivante
5. **Ne pas lutter** : Travailler avec le réveil plutôt que contre lui
6. **Système nerveux** : Plus de capacité pour la relaxation = meilleur sommeil

### Différenciation
- "Ce n'est pas ce que vous faites qui ne va pas. C'est comment vous le faites."
- Approche non-violente, respectueuse du corps
- Focus sur l'écoute et le ressenti plutôt que la performance

---

## 📝 Notes d'utilisation

- Les emails sont personnalisés avec le prénom
- Le timing J+8 pour la relance est optimal pour ne pas être intrusif tout en restant efficace
- Si le contact s'abonne après l'email principal, ne pas envoyer la relance
- Suivre les taux d'ouverture et de clic pour ajuster le timing si nécessaire
