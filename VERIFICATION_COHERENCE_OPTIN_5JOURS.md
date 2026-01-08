# Vérification de cohérence : Opt-in direct aux 5 jours offerts

## 📋 Scénario testé
**Personne qui s'inscrit directement aux 5 jours offerts** (sans passer par les 2 pratiques offertes)

## ✅ Flux d'inscription (`subscribeTo5Days`)

### Propriétés Mailjet définies :
- ✅ `sourceOptin` = `'5joursofferts'` (ou ajouté à la liste si déjà présent)
- ✅ `date_optin` = date d'inscription (format ISO)
- ✅ `serie_5jours_debut` = date d'inscription (format ISO)
- ✅ `serie_5jours_status` = `'started'`
- ✅ `statut` = `'prospect'`
- ✅ `est_client` = `'False'`

### Email de confirmation :
- ✅ Email de double opt-in envoyé avec lien de confirmation
- ✅ Redirection vers `/cours-en-ligne/5jours/j1/` après confirmation

## 📧 Séquences marketing (`sendNewContentEmails`)

### Calcul des jours :
- `currentDay` = calculé depuis `date_optin` (ligne 3642)
- `joursApres5jours` = calculé depuis `serie_5jours_debut` (ligne 3692)
- **Note** : Pour une inscription directe, `date_optin` = `serie_5jours_debut`, donc les deux calculs sont cohérents

### SCÉNARIO 1 : Opt-in "2 pratiques" → Promotion "5 jours"
- ❌ **Ne s'applique pas** (condition : `sourceOptin.includes('2pratiques') && !has5jours`)
- ✅ **Correct** : La personne a déjà les 5 jours, pas besoin de les promouvoir

### SCÉNARIO 2 : Inscrit aux "5 jours" → Promotion "21 jours"
- ✅ **S'applique** (condition : `has5jours && serie5joursDebut`)
- ✅ **Emails envoyés** :
  - **Jour 6** après `serie_5jours_debut` : Email "Jour 6 : on continue ensemble ?" (template `promotion-21jours-jour6`)
  - **Jour 10** après `serie_5jours_debut` : Email "Fluance : sortir des tensions physiques et du trop-plein" (template `promotion-21jours-relance`)
  - **Jour 17** après `serie_5jours_debut` : Email "21 jours de Fluance : c'est le moment" (template `promotion-21jours-final`)
- ✅ **Cohérence** : Les emails sont envoyés après la fin des 5 jours (jour 5), ce qui est logique

### SCÉNARIO 3 : PAS inscrit aux "5 jours" → Relance + promotion "21 jours"
- ❌ **Ne s'applique pas** (condition : `sourceOptin.includes('2pratiques') && !has5jours`)
- ✅ **Correct** : La personne a déjà les 5 jours, pas besoin de relance

### SCÉNARIO 4 : Prospect qui n'a pas acheté → Promotion "approche complète"
- ✅ **S'applique** (condition : `!has21jours && !hasComplet`)
- ✅ **Pour "5jours"** : Après J+17 (dernière relance 21 jours), proposer l'approche complète
- ✅ **Emails envoyés** :
  - **Jour 20** après `serie_5jours_debut` : Email "Et si vous continuiez avec Fluance ?" (premier email)
  - **Jour 25** après `serie_5jours_debut` : Email "Approche Fluance complète : 14 jours offerts" (deuxième email)
  - **Jour 32** après `serie_5jours_debut` : Email "Dernière chance : rejoignez l'approche complète" (troisième email)
- ✅ **Cohérence** : Les emails sont envoyés après la dernière promotion du 21 jours (J+17), ce qui est logique

## 🔍 Points de vérification

### ✅ Points corrects :
1. **Pas de doublons** : Les emails sont trackés dans `contentEmailsSent` avec des IDs uniques
2. **Ordre logique** : 
   - D'abord promotion du 21 jours (jours 6, 10, 17)
   - Ensuite promotion de l'approche complète (jours 20, 25, 32)
3. **Pas de conflit** : Les scénarios sont mutuellement exclusifs grâce aux conditions
4. **Calcul des jours cohérent** : Utilise `serie_5jours_debut` pour les calculs relatifs aux 5 jours

### ⚠️ Points à vérifier :

1. **Si la personne s'inscrit d'abord aux 2 pratiques, puis aux 5 jours** :
   - `sourceOptin` contiendra `'2pratiques,5joursofferts'` (ajouté à la liste, ligne 2324-2326)
   - `date_optin` sera la date de l'inscription aux 2 pratiques (conservée car plus ancienne, ligne 2351-2352)
   - `serie_5jours_debut` sera la date de l'inscription aux 5 jours (nouvelle, ligne 2358-2359)
   - **Impact** : 
     - `currentDay` sera calculé depuis `date_optin` (2 pratiques) - donc plus élevé
     - `joursApres5jours` sera calculé depuis `serie_5jours_debut` (5 jours) - donc plus bas
   - **Résultat** : 
     - ✅ Les emails du SCÉNARIO 2 seront envoyés au bon moment (relatif aux 5 jours) car ils utilisent `joursApres5jours`
     - ✅ Le SCÉNARIO 3 ne s'appliquera pas car `has5jours` sera `true` (condition : `sourceOptin.includes('2pratiques') && !has5jours`)
     - ✅ Le SCÉNARIO 1 ne s'appliquera pas car `has5jours` sera `true` (condition : `sourceOptin.includes('2pratiques') && !has5jours`)
   - **Verdict** : ✅ **OK** - Le système gère correctement ce cas

2. **Si la personne s'inscrit directement aux 5 jours** :
   - `sourceOptin` = `'5joursofferts'` (pas de "2pratiques")
   - `date_optin` = date d'inscription aux 5 jours
   - `serie_5jours_debut` = date d'inscription aux 5 jours
   - **Impact** : `currentDay` = `joursApres5jours` (cohérent)
   - **Résultat** : ✅ **Tout fonctionne correctement**

## 📊 Résumé du flux pour inscription directe aux 5 jours

| Jour | Événement | Email envoyé |
|------|-----------|--------------|
| J+1 | Inscription aux 5 jours | Email de confirmation (double opt-in) |
| J+1 à J+5 | Série des 5 jours | Contenu des jours 1 à 5 (via pages web) |
| J+6 | Après les 5 jours | ✅ Email "Jour 6 : on continue ensemble ?" (promotion 21 jours) |
| J+10 | Après les 5 jours | ✅ Email "Fluance : sortir des tensions physiques..." (promotion 21 jours) |
| J+17 | Après les 5 jours | ✅ Email "21 jours de Fluance : c'est le moment" (promotion 21 jours) |
| J+20 | Si pas d'achat 21 jours | ✅ Email "Et si vous continuiez avec Fluance ?" (promotion approche complète) |
| J+25 | Si pas d'achat 21 jours | ✅ Email "Approche Fluance complète : 14 jours offerts" (promotion approche complète) |
| J+32 | Si pas d'achat 21 jours | ✅ Email "Dernière chance : rejoignez l'approche complète" (promotion approche complète) |

## ✅ Conclusion

**Le système est cohérent** pour une personne qui s'inscrit directement aux 5 jours offerts :

1. ✅ Les propriétés Mailjet sont correctement définies
2. ✅ Les séquences marketing sont déclenchées au bon moment
3. ✅ Pas de doublons ou de conflits entre scénarios
4. ✅ L'ordre des promotions est logique (21 jours → approche complète)
5. ✅ Les calculs de jours sont cohérents

**Aucune correction nécessaire.**
