# Analyse : Dates d'envoi des emails marketing pour inscription du 22 décembre 2025

## 📅 Scénario : Inscription le 22 décembre 2025

### Cas 1 : Inscription aux "2 pratiques offertes" le 22 décembre 2025

**Séquence d'emails :**

| Date | Jour | Événement | Email envoyé |
|------|------|-----------|--------------|
| 22 déc 2025 | J+0 | Inscription | Email de confirmation (double opt-in) |
| 23 déc 2025 | J+1 | ✅ **Email envoyé** | Promotion "5 jours offerts" (J+1 à J+7) |
| 24 déc 2025 | J+2 | ✅ **Email envoyé** | Promotion "5 jours offerts" (si raté J+1) |
| **25 déc 2025** | **J+3** | ⚠️ **NOËL** | Promotion "5 jours offerts" (si raté J+1-J+2) |
| **26 déc 2025** | **J+4** | ⚠️ **Boxing Day** | Relance "5 jours offerts" (J+3) |
| 27 déc 2025 | J+5 | ✅ **Email envoyé** | Promotion "5 jours offerts" (si raté J+1-J+4) |
| 28 déc 2025 | J+6 | ✅ **Email envoyé** | Promotion "5 jours offerts" (si raté J+1-J+5) |
| 29 déc 2025 | J+7 | ✅ **Email envoyé** | Promotion "5 jours offerts" (dernière chance, J+1-J+7) |
| 30 déc 2025 | J+8 | ✅ **Email envoyé** | Promotion "21 jours" (si pas inscrit aux 5 jours) |
| **31 déc 2025** | **J+9** | ⚠️ **NOUVEL AN** | - |
| **1er jan 2026** | **J+10** | ⚠️ **JOUR DE L'AN** | Promotion "21 jours" (si pas inscrit aux 5 jours) |
| 2 jan 2026 | J+11 | ✅ **Email envoyé** | - |
| 8 jan 2026 | J+15 | ✅ **Email envoyé** | Promotion "21 jours" (si pas inscrit aux 5 jours) |
| 12 jan 2026 | J+22 | ✅ **Email envoyé** | Promotion "21 jours" (si pas inscrit aux 5 jours) |

**⚠️ Problèmes identifiés :**
- **25 décembre (Noël)** : Email de promotion possible
- **26 décembre (Boxing Day)** : Relance "5 jours offerts"
- **31 décembre (Nouvel An)** : Pas d'email prévu (J+9)
- **1er janvier (Jour de l'An)** : Promotion "21 jours" possible

### Cas 2 : Inscription aux "5 jours offerts" le 22 décembre 2025

**Séquence d'emails :**

| Date | Jour | Événement | Email envoyé |
|------|------|-----------|--------------|
| 22 déc 2025 | J+0 | Inscription | Email de confirmation (double opt-in) |
| 22-26 déc 2025 | J+1 à J+5 | Série des 5 jours | Contenu des jours 1 à 5 (via pages web) |
| **27 déc 2025** | **J+6** | ⚠️ **Après Noël** | ✅ Email "Jour 6 : on continue ensemble ?" (promotion 21 jours) |
| **31 déc 2025** | **J+10** | ⚠️ **NOUVEL AN** | ✅ Email "Fluance : sortir des tensions..." (promotion 21 jours) |
| **7 jan 2026** | **J+17** | ✅ **Après fêtes** | ✅ Email "21 jours de Fluance : c'est le moment" (promotion 21 jours) |
| 10 jan 2026 | J+20 | ✅ **Email envoyé** | Promotion "approche complète" (si pas d'achat 21 jours) |
| 15 jan 2026 | J+25 | ✅ **Email envoyé** | Promotion "approche complète" (si pas d'achat 21 jours) |
| 22 jan 2026 | J+32 | ✅ **Email envoyé** | Promotion "approche complète" (si pas d'achat 21 jours) |

**⚠️ Problèmes identifiés :**
- **27 décembre** : Email de promotion (juste après Noël, acceptable)
- **31 décembre (Nouvel An)** : Email de promotion (⚠️ **PROBLÉMATIQUE**)
- **7 janvier** : Email de promotion (après les fêtes, acceptable)

## 🎯 Analyse et recommandations

### Problèmes identifiés

1. **25-26 décembre (Noël/Boxing Day)** :
   - Emails de promotion possibles pour les inscrits aux "2 pratiques"
   - Risque de mauvaise réception pendant les fêtes

2. **31 décembre - 1er janvier (Nouvel An)** :
   - Email de promotion "21 jours" prévu le 31 décembre (J+10 pour "5 jours")
   - Email de promotion "21 jours" prévu le 1er janvier (J+10 pour "2 pratiques")
   - **Risque élevé** : Les emails marketing pendant les fêtes sont mal perçus

3. **Période de faible engagement** :
   - 22 décembre - 7 janvier : Période de fêtes avec faible engagement
   - Les emails envoyés pendant cette période ont un taux d'ouverture plus faible

### Recommandations

#### Option 1 : Délai de grâce simple (recommandé)
**Exclure les jours fériés majeurs :**
- 25 décembre (Noël)
- 26 décembre (Boxing Day)
- 31 décembre (Nouvel An)
- 1er janvier (Jour de l'An)

**Implémentation :**
- Vérifier si `currentDay` correspond à une date exclue
- Si oui, reporter l'email au jour suivant non exclu
- Simple et efficace

#### Option 2 : Pause complète du 24 décembre au 2 janvier
**Exclure toute la période de fêtes :**
- Du 24 décembre au 2 janvier inclus
- Reprendre les envois le 3 janvier

**Implémentation :**
- Vérifier si la date d'envoi prévue est dans la période exclue
- Si oui, reporter au premier jour après la période
- Plus sûr mais peut retarder certains emails importants

#### Option 3 : Délai de grâce intelligent avec report automatique
**Exclure les jours fériés + reporter automatiquement :**
- Exclure : 25, 26, 31 décembre, 1er janvier
- Reporter automatiquement au prochain jour ouvrable
- Conserver la logique de "rattrapage" existante (J+1 à J+7)

**Implémentation :**
- Fonction `isExcludedDate(date)` qui retourne `true` pour les jours exclus
- Fonction `getNextValidDate(date)` qui retourne le prochain jour non exclu
- Modifier la logique pour reporter les emails aux jours exclus

## 💡 Proposition recommandée : Option 1 (Délai de grâce simple)

### Avantages :
- ✅ Simple à implémenter
- ✅ Évite les jours les plus problématiques (Noël, Nouvel An)
- ✅ Ne retarde pas trop les emails (seulement 4 jours exclus)
- ✅ Respecte la logique de "rattrapage" existante

### Implémentation proposée :

```javascript
// Fonction pour vérifier si une date est exclue (jours fériés)
function isExcludedDate(date) {
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  
  // 25 décembre (Noël)
  if (month === 11 && day === 25) return true;
  
  // 26 décembre (Boxing Day)
  if (month === 11 && day === 26) return true;
  
  // 31 décembre (Nouvel An - veille)
  if (month === 11 && day === 31) return true;
  
  // 1er janvier (Jour de l'An)
  if (month === 0 && day === 1) return true;
  
  return false;
}

// Fonction pour obtenir le prochain jour non exclu
function getNextValidDate(date) {
  let nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  
  while (isExcludedDate(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return nextDate;
}
```

### Modification de la logique :

Dans `sendNewContentEmails`, avant d'envoyer un email marketing :
1. Calculer la date d'envoi prévue : `optinDate + currentDay - 1`
2. Vérifier si cette date est exclue avec `isExcludedDate()`
3. Si exclue, reporter au prochain jour valide avec `getNextValidDate()`
4. Vérifier si le jour reporté correspond toujours à `currentDay` ou s'il faut attendre

**Exemple pour inscription du 22 décembre :**
- J+3 prévu le 25 décembre → Reporté au 27 décembre (J+5)
- J+10 prévu le 31 décembre → Reporté au 2 janvier (J+11)
- J+1 prévu le 1er janvier → Reporté au 2 janvier (J+11)

## 📊 Calendrier révisé avec délai de grâce

### Inscription "2 pratiques" le 22 décembre 2025 :

| Date | Jour | Événement | Email envoyé | Statut |
|------|------|-----------|--------------|--------|
| 22 déc 2025 | J+0 | Inscription | Confirmation | ✅ |
| 23 déc 2025 | J+1 | ✅ | Promotion "5 jours" | ✅ |
| 24 déc 2025 | J+2 | ✅ | Promotion "5 jours" | ✅ |
| **25 déc 2025** | **J+3** | **NOËL** | **Reporté** | ⏸️ |
| **26 déc 2025** | **J+4** | **Boxing Day** | **Reporté** | ⏸️ |
| 27 déc 2025 | J+5 | ✅ | Promotion "5 jours" (rattrapage) | ✅ |
| 28 déc 2025 | J+6 | ✅ | Promotion "5 jours" | ✅ |
| 29 déc 2025 | J+7 | ✅ | Promotion "5 jours" | ✅ |
| 30 déc 2025 | J+8 | ✅ | Promotion "21 jours" | ✅ |
| **31 déc 2025** | **J+9** | **NOUVEL AN** | **Reporté** | ⏸️ |
| **1er jan 2026** | **J+10** | **JOUR DE L'AN** | **Reporté** | ⏸️ |
| 2 jan 2026 | J+11 | ✅ | Promotion "21 jours" (rattrapage) | ✅ |
| 8 jan 2026 | J+15 | ✅ | Promotion "21 jours" | ✅ |
| 12 jan 2026 | J+22 | ✅ | Promotion "21 jours" | ✅ |

### Inscription "5 jours" le 22 décembre 2025 :

| Date | Jour | Événement | Email envoyé | Statut |
|------|------|-----------|--------------|--------|
| 22 déc 2025 | J+0 | Inscription | Confirmation | ✅ |
| 22-26 déc 2025 | J+1 à J+5 | Série des 5 jours | Contenu web | ✅ |
| 27 déc 2025 | J+6 | ✅ | Promotion "21 jours" | ✅ |
| 28-30 déc 2025 | J+7 à J+9 | - | - | - |
| **31 déc 2025** | **J+10** | **NOUVEL AN** | **Reporté** | ⏸️ |
| **1er jan 2026** | **J+11** | **JOUR DE L'AN** | **Reporté** | ⏸️ |
| 2 jan 2026 | J+12 | ✅ | Promotion "21 jours" (rattrapage J+10) | ✅ |
| 7 jan 2026 | J+17 | ✅ | Promotion "21 jours" | ✅ |

## ✅ Conclusion et recommandation

### 📊 Résumé des dates problématiques pour inscription du 22 décembre 2025

**Pour "2 pratiques" :**
- ❌ **25 décembre (J+3)** : Promotion "5 jours" possible
- ❌ **26 décembre (J+4)** : Relance "5 jours"
- ❌ **1er janvier (J+10)** : Promotion "21 jours"

**Pour "5 jours" :**
- ✅ **27 décembre (J+6)** : Promotion "21 jours" (acceptable, après Noël)
- ❌ **31 décembre (J+10)** : Promotion "21 jours" (⚠️ **PROBLÉMATIQUE**)

### 💡 Recommandation : Option 1 (Délai de grâce simple)

**Jours à exclure :**
- 25 décembre (Noël)
- 26 décembre (Boxing Day)
- 31 décembre (Nouvel An - veille)
- 1er janvier (Jour de l'An)

**Avantages :**
- ✅ Simple à implémenter et maintenir
- ✅ Évite les 4 jours les plus problématiques
- ✅ Respecte l'intention de ne pas "bombarder" pendant les fêtes
- ✅ Le système de "rattrapage" existant (J+1 à J+7) permet d'envoyer l'email le jour suivant valide
- ✅ Pas de perte d'emails, juste un report

**Calendrier révisé :**
- Inscription "2 pratiques" le 22 déc : Emails reportés du 25-26 déc et 1er jan
- Inscription "5 jours" le 22 déc : Email J+10 reporté du 31 déc au 2 jan

### 🎯 Alternative : Option 2 (Pause complète 24 déc - 2 jan)

Si vous préférez une pause complète :
- ✅ Plus sûr (aucun email pendant les fêtes)
- ❌ Retarde davantage les envois (jusqu'au 3 janvier)
- ❌ Peut créer un "trou" dans la séquence pour certains contacts

### 📝 Note sur le conseil du 6 janvier 2026

Le conseil suggère le **mardi 6 janvier 2026** pour maximiser les ventes. Avec l'Option 1 :
- Les emails reportés arriveront autour du 2-3 janvier
- Cela reste proche de la date recommandée (6 janvier)
- Les emails suivants (J+15, J+22) tomberont naturellement après le 6 janvier

**Souhaitez-vous que j'implémente l'Option 1 (délai de grâce simple) ?**
