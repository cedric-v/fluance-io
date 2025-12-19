# Analyse : Intégration de contenus pour les séquences de promotion

## 📊 Analyse des contenus fournis

### Contenu A : Statistiques sur la sédentarité
**Type** : Données factuelles, impact émotionnel fort
**Objectif** : Créer l'urgence et la motivation par les faits
**Points forts** :
- Chiffres concrets et percutants
- Liens directs avec la santé (diabète, cancer, Alzheimer, dépression)
- Conclusion claire : "Votre liberté de mouvement est un pilier de votre santé"

### Contenu B : Approche non-violente du corps
**Type** : Philosophie et différenciation
**Objectif** : Expliquer l'approche unique de Fluance
**Points forts** :
- Différenciation claire des autres méthodes
- Approche respectueuse et non-forcée
- Message : "Honorer la résistance plutôt que la combattre"

## 🎯 Où intégrer ces contenus

### 1. Emails de promotion du 21 jours

#### Email "promotion-21jours-relance" (J+10 après 5 jours, J+8 après 2 pratiques)
**Intégration du contenu A** :
- Ajouter 2-3 statistiques percutantes en introduction
- Exemple : "La sédentarité tue +5 millions de personnes/an. Rester assis 8h/jour augmente de 147% le risque de maladie cardiovasculaire."
- Créer un sentiment d'urgence sans être alarmiste

**Intégration du contenu B** :
- Intégrer le concept "honorer la résistance" dans la section sur l'approche
- Exemple : "Fluance ne vous demande pas de forcer votre corps. Nous honorons vos tensions, vos résistances. C'est ainsi que le changement devient possible."

#### Email "promotion-21jours-final" (J+17 après 5 jours, J+22 après 2 pratiques)
**Intégration du contenu A** :
- Utiliser les statistiques sur l'activité physique régulière
- Exemple : "L'activité physique régulière réduit le risque d'Alzheimer de 30-40%. Chez les femmes traitées d'un cancer du sein, 3h/semaine diminuent le risque de récidive de 20-50%."
- Montrer les bénéfices à long terme

**Intégration du contenu B** :
- Renforcer le message différenciant
- Exemple : "Contrairement aux approches qui vous demandent de 'pousser à travers', Fluance vous invite à honorer ce qui résiste. C'est là que la vraie transformation commence."

### 2. Emails post-21jours vers approche complète

#### Email J+1 (après fin du 21 jours)
**Intégration du contenu A** :
- Utiliser les statistiques sur la régularité
- Exemple : "Vous avez fait 21 jours. Mais saviez-vous que l'activité physique régulière réduit le risque d'Alzheimer de 30-40% ? La clé, c'est la continuité."

**Intégration du contenu B** :
- Expliquer pourquoi continuer avec Fluance
- Exemple : "Avec l'approche complète, vous continuez à honorer votre corps, sans forcer. Une nouvelle pratique chaque semaine, toujours dans cette approche respectueuse."

#### Email J+4 (après fin du 21 jours)
**Intégration du contenu A** :
- Utiliser les statistiques sur les risques de la sédentarité
- Exemple : "Après 21 jours, vous avez créé une habitude. Mais saviez-vous qu'avec 10h/jour assis, vous avez 40% de risque de symptômes dépressifs ? Continuer, c'est protéger votre santé mentale."

**Intégration du contenu B** :
- Rassurer sur l'approche non-forcée
- Exemple : "L'approche complète ne vous demande pas d'être plus discipliné(e). Elle vous invite à continuer à honorer votre corps, à votre rythme."

#### Email J+8 (après fin du 21 jours)
**Intégration du contenu A** :
- Utiliser la conclusion du contenu A
- Exemple : "Votre liberté de mouvement est un pilier de votre santé. L'approche complète vous aide à en prendre soin, semaine après semaine."

**Intégration du contenu B** :
- Message final différenciant
- Exemple : "Fluance n'est pas une méthode qui vous force à changer. C'est un espace où votre corps peut enfin se sentir en sécurité pour lâcher prise."

### 3. Nouveaux templates à créer

#### Template "promotion-21jours-urgence" (nouveau)
**Objectif** : Créer l'urgence avec les statistiques
**Contenu A intégré** : 3-4 statistiques les plus percutantes
**Utilisation** : Alternative au template "relance" pour certains segments

#### Template "promotion-complet-philosophie" (nouveau)
**Objectif** : Expliquer l'approche différente de Fluance
**Contenu B intégré** : Concepts clés de l'approche non-violente
**Utilisation** : Email post-21jours pour expliquer pourquoi continuer avec Fluance

## 📝 Recommandations d'intégration concrètes

### Priorité 1 : Modifier les templates existants

1. **promotion-21jours-relance.mjml**
   - Ajouter 2-3 statistiques du contenu A en introduction
   - Intégrer un paragraphe sur l'approche non-violente (contenu B)

2. **promotion-21jours-final.mjml**
   - Ajouter statistiques sur les bénéfices à long terme (contenu A)
   - Renforcer le message différenciant (contenu B)

3. **Emails post-21jours (dans functions/index.js)**
   - Email J+1 : Ajouter statistique sur régularité (contenu A)
   - Email J+4 : Ajouter statistique sur dépression/sédentarité (contenu A)
   - Email J+8 : Utiliser conclusion contenu A + message contenu B

### Priorité 2 : Créer de nouveaux templates (optionnel)

Si vous souhaitez varier les messages selon les segments, créer :
- `promotion-21jours-urgence.mjml` (focus statistiques)
- `promotion-complet-philosophie.mjml` (focus approche)

## 🎨 Style d'intégration recommandé

### Pour le contenu A (statistiques)
- **Format** : Citations courtes et percutantes
- **Placement** : En début d'email ou après le problème identifié
- **Ton** : Factuel mais pas alarmiste
- **Exemple** :
  ```
  "La sédentarité tue +5 millions de personnes/an. 
  Rester assis 8h/jour augmente de 147% le risque 
  de maladie cardiovasculaire.
  
  Mais l'activité physique régulière réduit le risque 
  d'Alzheimer de 30-40%.
  
  Votre liberté de mouvement est un pilier de votre santé."
  ```

### Pour le contenu B (philosophie)
- **Format** : Paragraphes explicatifs mais concis
- **Placement** : Section différenciation ou rassurance
- **Ton** : Respectueux, bienveillant
- **Exemple** :
  ```
  "Fluance ne vous demande pas de forcer votre corps 
  à changer. Nous honorons vos tensions, vos résistances. 
  
  C'est en donnant à votre corps la permission de rester 
  tel qu'il est que le changement devient possible."
  ```

## ✅ Prochaines étapes

1. Modifier les templates MJML existants avec intégration des contenus
2. Modifier les emails inline dans functions/index.js
3. Tester les emails avec les nouveaux contenus
4. Optionnel : Créer les nouveaux templates pour varier les messages
