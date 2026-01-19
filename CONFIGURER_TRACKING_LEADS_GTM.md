# Configuration Google Analytics / GTM pour le suivi des leads (2 pratiques et 5 jours)

Ce guide explique comment configurer le suivi des leads (opt-in "2 pratiques" et "5 jours offerts") via Google Tag Manager et Google Analytics 4.

## Vue d'ensemble

Le suivi des leads est déjà implémenté dans le code :
- ✅ **Événements dataLayer** : `generate_lead` est envoyé automatiquement via `dataLayer`
- ✅ **Google Tag Manager** : Déjà configuré avec l'ID `GTM-FVTMPVN2`
- ✅ **Paramètres inclus** : `source`, `optin_type`, `lead_type` pour différencier les types de leads

## Architecture

### Flux de conversion

1. **Utilisateur s'inscrit** → Opt-in "2 pratiques" ou "5 jours offerts"
2. **Confirmation réussie** → Page `/confirm/` ou popup newsletter
3. **Événement envoyé** :
   - L'événement `generate_lead` est envoyé via `dataLayer`
   - GTM capture l'événement
   - Google Analytics enregistre la conversion

### Événements envoyés

L'événement `generate_lead` (événement recommandé GA4) est envoyé avec les paramètres suivants :

#### 1. Opt-in "2 pratiques" (confirmation par email)
```javascript
{
  event: 'generate_lead',
  source: 'newsletter_optin',
  optin_type: '2pratiques',
  lead_type: '2_pratiques'
}
```

#### 2. Opt-in "5 jours offerts" (confirmation par email)
```javascript
{
  event: 'generate_lead',
  source: 'newsletter_optin',
  optin_type: '5joursofferts',
  lead_type: '5_jours'
}
```

#### 3. Opt-in "5 jours offerts" (inscription directe via popup)
```javascript
{
  event: 'generate_lead',
  source: 'newsletter_popup',
  optin_type: '5joursofferts',
  lead_type: '5_jours'
}
```

## Configuration étape par étape

### Étape 1 : Vérifier que GTM est bien chargé

✅ **Déjà configuré** : GTM est chargé avec l'ID `GTM-FVTMPVN2` dans `src/_includes/base.njk`

**Vérification** :
1. Ouvrez la console du navigateur (F12)
2. Tapez : `window.dataLayer`
3. Vous devriez voir un tableau avec des événements

### Étape 2 : Configurer le tag Google Analytics 4 existant

⚠️ **IMPORTANT** : Vous avez déjà un tag GA4 dans GTM qui se déclenche sur "All Pages". 

**Deux options** :

#### Option 1 : Utiliser le tag GA4 existant (recommandé)

Si votre tag GA4 existant est de type **"Google Analytics: GA4 Configuration"** et se déclenche sur "All Pages", il capture **automatiquement tous les événements** envoyés via `dataLayer`, y compris `generate_lead`.

**Vérification** :
1. **Ouvrez votre tag GA4 existant** dans GTM
2. **Vérifiez le type** :
   - Si c'est **"Google Analytics: GA4 Configuration"** → ✅ Il capture déjà tous les événements
   - Si c'est **"Google Analytics: GA4 Event"** → Voir Option 2
3. **Vérifiez le déclencheur** :
   - Si c'est **"All Pages"** → ✅ Il capture déjà tous les événements
   - Si c'est un événement spécifique → Voir Option 2

**Si votre tag GA4 existant est de type "GA4 Configuration"** :
- ✅ **Vous n'avez PAS besoin de créer un nouveau tag**
- ✅ L'événement `generate_lead` sera automatiquement envoyé à GA4
- ⚠️ **Mais** : Vous devez quand même créer les variables pour les paramètres (`source`, `optin_type`, `lead_type`) si vous voulez qu'ils soient envoyés

**Si votre tag GA4 existant est de type "GA4 Event" avec un événement spécifique** (comme `{{Page URL}}`) :
- ⚠️ **Ce tag ne capture PAS automatiquement les événements dataLayer**
- ✅ **Vous devez créer un nouveau tag** pour capturer l'événement `generate_lead`
- Ce tag existant envoie uniquement l'événement configuré (ex: page URL), pas les événements personnalisés du dataLayer

#### Option 2 : Créer un nouveau tag spécifique pour les leads

Si vous préférez avoir un tag séparé pour les leads (pour un meilleur contrôle) :

1. **Créez un nouveau tag** :
   - Cliquez sur **Tags** → **Nouveau**
   - Nommez-le : `Google Analytics 4 - Leads`

2. **Configuration du tag** :
   - **Type de tag** : `Google Analytics: GA4 Event`
   - **ID de mesure** : Entrez votre Measurement ID Google Analytics 4 (format : `G-XXXXXXXXXX`)
     - Pour trouver votre ID : Google Analytics → Admin → Flux de données → Votre flux → ID de mesure
   - **Nom de l'événement** : `generate_lead`
   - **Paramètres d'événement** : Vous avez **deux options** :

   **Option A : Ajouter les paramètres directement dans le tag** (recommandé pour commencer)
   - Cliquez sur "Ajouter une ligne" pour chaque paramètre :
     - **Nom du paramètre** : `source` → **Valeur** : `{{Source}}` (variable à créer)
     - **Nom du paramètre** : `optin_type` → **Valeur** : `{{Optin Type}}` (variable à créer)
     - **Nom du paramètre** : `lead_type` → **Valeur** : `{{Lead Type}}` (variable à créer)
   
   ⚠️ **Important** : Les noms des variables dans `{{}}` doivent correspondre EXACTEMENT aux noms des variables GTM que vous avez créées. Si vous avez créé "Source", "Optin Type", "Lead Type", utilisez `{{Source}}`, `{{Optin Type}}`, `{{Lead Type}}` (avec majuscules et espaces).

   **Option B : Utiliser une variable "Google tag: Event settings"** (plus réutilisable)
   - Créez d'abord une variable de type "Google tag: Event settings"
   - Ajoutez tous les paramètres dans cette variable :
     - `source` → `{{Source}}`
     - `optin_type` → `{{Optin Type}}`
     - `lead_type` → `{{Lead Type}}`
   - Enregistrez la variable (ex: `GA4 - Lead Parameters`)
   - Dans le tag GA4 Event, utilisez cette variable dans "Event Parameters"

   ⚠️ **IMPORTANT** : Dans les deux cas, vous devez **d'abord créer les 3 variables Data Layer** :
   - `{{Source}}` → Data Layer Variable : `source`
   - `{{Optin Type}}` → Data Layer Variable : `optin_type`
   - `{{Lead Type}}` → Data Layer Variable : `lead_type`
   
   Ensuite, vous pouvez utiliser `{{Source}}`, `{{Optin Type}}`, `{{Lead Type}}` dans les paramètres.

3. **Déclencheur** :
   - Cliquez sur **Déclencheur** → **Nouveau**
   - Nommez-le : `Generate Lead Event`
   - **Type** : `Custom Event` (Événement personnalisé)
   - **Event name** (Nom de l'événement) : `generate_lead` (exactement comme dans votre code)
   - **This trigger fires on** : Laissez sur **"All Custom Events"** ✅

4. **Variables à créer** :

   **Méthode 1 : Créer les variables depuis le champ du tag (recommandé)**
   
   Lorsque vous cliquez sur l'icône de variable (📦) à côté des champs de paramètres :
   1. Cliquez sur **"+ Nouvelle variable"** ou **"Add Variable"**
   2. **Choose variable type** : Sélectionnez **`Data Layer Variable`** (Variable de couche de données)
   3. Configurez chaque variable :
      - **Variable 1 : Source**
        - Nom de la variable GTM : `Source` ou `source` (nom d'affichage, vous pouvez choisir)
        - ⚠️ **Data Layer Variable Name** : `source` (exactement comme dans votre code, en minuscules)
        - Data Layer Version : `Version 2`
        - Type de valeur : `Text` (Texte)
        
        **Important** : 
        - Le "Data Layer Variable Name" doit correspondre EXACTEMENT au nom dans le dataLayer (`source`), pas au nom de la variable GTM.
        - ⚠️ **Le nom dans `{{}}` doit correspondre EXACTEMENT au nom de la variable GTM** : 
          - Si vous créez une variable nommée "Source" (avec majuscule) → utilisez `{{Source}}`
          - Si vous créez une variable nommée "source" (en minuscules) → utilisez `{{source}}`
          - GTM est sensible à la casse pour les noms de variables.
        - ✅ **Exemple cohérent** : Variable GTM = `source` (minuscules) → Utilisez `{{source}}` (minuscules) → Data Layer Variable Name = `source` (minuscules) → ✅ Tout est cohérent !
      - **Variable 2 : Optin Type**
        - Nom de la variable GTM : `Optin Type` (nom d'affichage, peut être en majuscules)
        - ⚠️ **Data Layer Variable Name** : `optin_type` (exactement comme dans votre code, avec underscore et en minuscules)
        - Data Layer Version : `Version 2`
        - Type de valeur : `Text` (Texte)
        
        **Important** : Le "Data Layer Variable Name" doit correspondre EXACTEMENT au nom dans le dataLayer (`optin_type`), pas au nom de la variable GTM (`Optin Type`).
      - **Variable 3 : Lead Type**
        - Nom de la variable GTM : `Lead Type` (nom d'affichage, peut être en majuscules)
        - ⚠️ **Data Layer Variable Name** : `lead_type` (exactement comme dans votre code, avec underscore et en minuscules)
        - Data Layer Version : `Version 2`
        - Type de valeur : `Text` (Texte)
        
        **Important** : Le "Data Layer Variable Name" doit correspondre EXACTEMENT au nom dans le dataLayer (`lead_type`), pas au nom de la variable GTM (`Lead Type`).
   4. Enregistrez chaque variable
   5. Sélectionnez-les dans les champs du tag

   **Méthode 2 : Créer les variables depuis le menu Variables**
   
   - **Tags** → **Variables** → **Nouveau**
   - Créez les 3 variables comme décrit ci-dessus

5. **Enregistrez le tag**

### Étape 2b : Créer les variables Data Layer (OBLIGATOIRE)

⚠️ **IMPORTANT** : Vous devez créer les 3 variables Data Layer **AVANT** de pouvoir utiliser `{{Source}}`, `{{Optin Type}}`, et `{{Lead Type}}` dans votre tag.

**Réponse à votre question** : Vous devez créer une variable Data Layer pour chaque paramètre (3 fois), puis utiliser `{{Source}}`, `{{Optin Type}}`, `{{Lead Type}}` dans les paramètres d'événement.

Que vous utilisiez le tag existant ou un nouveau tag, vous devez créer les variables pour capturer les paramètres :

### Étape 3 : (Optionnel) Créer des tags séparés pour chaque type de lead

Si vous voulez suivre séparément "2 pratiques" et "5 jours" avec des événements distincts :

#### Tag pour "2 pratiques"

1. **Créez un nouveau tag** : `Google Analytics 4 - Lead 2 Pratiques`
2. **Configuration** :
   - **Type** : `Google Analytics: GA4 Event`
   - **ID de mesure** : Votre Measurement ID GA4
   - **Nom de l'événement** : `lead_2_pratiques` (événement personnalisé)
   - **Paramètres** : Identiques au tag principal
3. **Déclencheur** :
   - **Type** : `Custom Event`
   - **Event name** : `generate_lead`
   - **Condition** : `optin_type` = `2pratiques` (utilisez la variable `{{Optin Type}}`)

#### Tag pour "5 jours"

1. **Créez un nouveau tag** : `Google Analytics 4 - Lead 5 Jours`
2. **Configuration** :
   - **Type** : `Google Analytics: GA4 Event`
   - **ID de mesure** : Votre Measurement ID GA4
   - **Nom de l'événement** : `lead_5_jours` (événement personnalisé)
   - **Paramètres** : Identiques au tag principal
3. **Déclencheur** :
   - **Type** : `Custom Event`
   - **Event name** : `generate_lead`
   - **Condition** : `optin_type` = `5joursofferts` (utilisez la variable `{{Optin Type}}`)

**Note** : Ce n'est pas obligatoire. Le tag principal avec `generate_lead` et les paramètres permet déjà de différencier les types de leads dans les rapports GA4.

### Étape 4 : Publier le conteneur GTM

1. **Cliquez sur "Submit"** (Publier) en haut à droite dans GTM
2. **Ajoutez une description** : "Ajout du tracking des leads via GA4"
3. **Publiez** le conteneur

### Étape 5 : Marquer `generate_lead` comme conversion dans Google Analytics

⚠️ **IMPORTANT** : Cette étape est nécessaire pour que les leads apparaissent dans les rapports de conversions.

1. **Connectez-vous à Google Analytics 4** : https://analytics.google.com
2. **Allez dans** : **Admin** → **Événements**
3. **Cherchez l'événement** : `generate_lead`
4. **Activez le toggle** "Marquer comme conversion" (étoile ⭐)
5. **Enregistrez**

**Résultat** : L'événement `generate_lead` apparaîtra dans :
- **Rapports** → **Engagement** → **Conversions**
- **Rapports** → **Acquisition** → **Conversions par source/medium**

### Étape 6 : Tester la configuration

#### Méthode 1 : Mode aperçu GTM (recommandé)

1. **Installez l'extension** : [Google Tag Manager Preview](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)
2. **Activez le mode aperçu** dans GTM
3. **Effectuez un opt-in test** :
   - Pour "2 pratiques" : Inscription → Confirmation par email → Clic sur le lien
   - Pour "5 jours" : Inscription via popup OU confirmation par email
4. **Vérifiez dans le panneau GTM Preview** :
   - L'événement `generate_lead` apparaît dans **Événements**
   - Le tag **Google Analytics 4 - Leads** se déclenche dans **Tags Fired**
   - Les paramètres `source`, `optin_type`, et `lead_type` sont correctement récupérés

#### Méthode 2 : Console du navigateur

1. **Effectuez un opt-in test**
2. **Sur la page de confirmation**, ouvrez la console (F12)
3. **Vérifiez** :
   ```javascript
   // Vérifier que dataLayer contient l'événement
   window.dataLayer.filter(e => e.event === 'generate_lead')
   
   // Devrait retourner :
   // [
   //   {
   //     event: 'generate_lead',
   //     source: 'newsletter_optin' | 'newsletter_popup',
   //     optin_type: '2pratiques' | '5joursofferts',
   //     lead_type: '2_pratiques' | '5_jours'
   //   }
   // ]
   ```

#### Méthode 3 : Google Analytics - Temps réel

1. **Allez dans Google Analytics 4** → **Rapports** → **Temps réel**
2. **Effectuez un opt-in test**
3. **Dans la section "Événements"**, vous devriez voir :
   - `generate_lead` (événement recommandé)
   - Cliquez sur l'événement pour voir les paramètres `optin_type`, `lead_type`, et `source`

## Types de leads suivis

Le système suit automatiquement tous les types d'opt-in :

| Type | `optin_type` | `lead_type` | `source` |
|------|-------------|-------------|----------|
| 2 pratiques (email) | `2pratiques` | `2_pratiques` | `newsletter_optin` |
| 5 jours (email) | `5joursofferts` | `5_jours` | `newsletter_optin` |
| 5 jours (popup) | `5joursofferts` | `5_jours` | `newsletter_popup` |

## Dépannage

### Le tag ne se déclenche pas

1. **Vérifiez que GTM est chargé** :
   ```javascript
   // Dans la console
   console.log(window.dataLayer); // Doit retourner un tableau
   ```

2. **Vérifiez le consentement aux cookies** :
   ```javascript
   // Dans la console
   console.log(localStorage.getItem('cookieConsent')); // Doit être 'accepted'
   ```

3. **Vérifiez que l'événement est bien envoyé** :
   ```javascript
   // Dans la console, après l'opt-in
   window.dataLayer.filter(e => e.event === 'generate_lead')
   ```

4. **Vérifiez le mode aperçu GTM** :
   - L'événement apparaît-il dans **Événements** ?
   - Le tag se déclenche-t-il dans **Tags Fired** ?

### L'événement n'apparaît pas dans Google Analytics

1. **Délai** : Les événements peuvent prendre quelques minutes pour apparaître dans GA4
2. **Vérifiez l'ID de mesure** : Est-il correct dans GTM ?
3. **Vérifiez les variables** : `source`, `optin_type`, et `lead_type` sont-elles correctement récupérées ?
4. **Vérifiez que le tag est publié** : Les modifications doivent être publiées pour être actives

### L'événement apparaît dans dataLayer mais pas dans GTM

1. **Vérifiez le nom de l'événement** : Doit être exactement `generate_lead` (sensible à la casse)
2. **Vérifiez le déclencheur** : Le déclencheur doit correspondre exactement au nom de l'événement
3. **Vérifiez que GTM est publié** : Les modifications doivent être publiées pour être actives

## Variables dataLayer disponibles

Pour créer des tags supplémentaires ou des déclencheurs personnalisés, voici toutes les variables disponibles dans `dataLayer` lors d'un opt-in :

```javascript
{
  event: 'generate_lead',
  source: 'newsletter_optin' | 'newsletter_popup',
  optin_type: '2pratiques' | '5joursofferts',
  lead_type: '2_pratiques' | '5_jours'
}
```

## Configuration manuelle dans Google Analytics 4

### Étape obligatoire : Marquer les événements comme conversions

⚠️ **Note importante** : Si vous voyez des événements comme `generate_lead_2_pratiques` ou `generate_lead_5_jours` dans GA4 au lieu de `generate_lead`, cela signifie qu'il y a peut-être une configuration GTM qui crée des événements personnalisés, ou que GA4 a automatiquement créé des événements basés sur les paramètres.

**Deux options** :

#### Option 1 : Si vous voyez `generate_lead` dans la liste
1. **Allez dans Google Analytics 4** : https://analytics.google.com
2. **Admin** → **Événements**
3. **Cherchez** : `generate_lead`
4. **Activez le toggle** "Marquer comme conversion" (étoile ⭐)
5. **Enregistrez**

#### Option 2 : Si vous voyez `generate_lead_2_pratiques` et/ou `generate_lead_5_jours`
1. **Allez dans Google Analytics 4** : https://analytics.google.com
2. **Admin** → **Événements**
3. **Cherchez** : `generate_lead_2_pratiques` et/ou `generate_lead_5_jours`
4. **Activez le toggle** "Marquer comme conversion" (étoile ⭐) pour chaque événement
5. **Enregistrez**

**Recommandation** : Si vous voyez `generate_lead_2_pratiques`, marquez-le comme conversion. L'événement `generate_lead` devrait apparaître après quelques événements supplémentaires ou après avoir testé un opt-in "5 jours".

### (Optionnel) Créer des événements personnalisés pour différencier les types

Si vous voulez suivre séparément "2 pratiques" et "5 jours" :

1. **Admin** → **Événements** → **Créer un événement**
2. **Créer un événement pour "2 pratiques"** :
   - **Nom de l'événement** : `lead_2_pratiques`
   - **Condition** : `generate_lead` ET `optin_type` = `2pratiques`
3. **Créer un événement pour "5 jours"** :
   - **Nom de l'événement** : `lead_5_jours`
   - **Condition** : `generate_lead` ET `optin_type` = `5joursofferts`
4. **Marquer ces événements comme conversions** si vous voulez les suivre séparément

**Note** : Ce n'est pas obligatoire. L'événement `generate_lead` avec les paramètres `optin_type` et `lead_type` permet déjà de différencier les types de leads dans les rapports.

### (Optionnel) Configurer les rapports personnalisés

Pour mieux visualiser les leads par type :

1. **Rapports** → **Engagement** → **Événements**
2. **Cliquez sur** `generate_lead`
3. **Ajoutez des dimensions** :
   - `optin_type` (2pratiques / 5joursofferts)
   - `lead_type` (2_pratiques / 5_jours)
   - `source` (newsletter_optin / newsletter_popup)

## Notes importantes

- ⚠️ Les événements ne sont envoyés que si `window.dataLayer` existe (GTM chargé)
- ⚠️ Les événements ne sont envoyés que si le consentement aux cookies a été donné
- ⚠️ Pour les "2 pratiques" : L'événement est envoyé uniquement après confirmation par email (pas juste à l'inscription)
- ⚠️ Pour les "5 jours" : L'événement est envoyé soit après inscription directe (popup), soit après confirmation par email
- ✅ L'événement `generate_lead` est un événement recommandé GA4, donc il bénéficie de rapports prédéfinis
- ✅ Les paramètres `optin_type`, `lead_type`, et `source` permettent de différencier les types de leads dans les rapports

## Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs de la console du navigateur
2. Utilisez le mode aperçu GTM pour diagnostiquer
3. Vérifiez que l'événement `generate_lead` est bien envoyé avec les bons paramètres
