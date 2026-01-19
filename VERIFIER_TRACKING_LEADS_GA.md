# Vérification du tracking des leads (2 pratiques et 5 jours) dans Google Analytics

Ce guide vérifie que le tracking des leads fonctionne correctement et indique ce qui doit être configuré manuellement dans Google Analytics.

## ✅ Ce qui est déjà en place

### Événements envoyés automatiquement

Le code envoie automatiquement l'événement `generate_lead` (événement recommandé GA4) via `dataLayer` :

#### 1. Opt-in "2 pratiques" (confirmation par email)
- **Fichier** : `src/fr/confirm.md` et `src/en/confirm.md`
- **Moment** : Après confirmation réussie par email
- **Événement** :
  ```javascript
  {
    event: 'generate_lead',
    source: 'newsletter_optin',
    optin_type: '2pratiques',
    lead_type: '2_pratiques'
  }
  ```

#### 2. Opt-in "5 jours offerts" (confirmation par email)
- **Fichier** : `src/fr/confirm.md` et `src/en/confirm.md`
- **Moment** : Après confirmation réussie par email
- **Événement** :
  ```javascript
  {
    event: 'generate_lead',
    source: 'newsletter_optin',
    optin_type: '5joursofferts',
    lead_type: '5_jours'
  }
  ```

#### 3. Opt-in "5 jours offerts" (inscription directe via popup)
- **Fichier** : `src/_includes/newsletter-popup-5jours.njk`
- **Moment** : Après inscription directe (sans confirmation email)
- **Événement** :
  ```javascript
  {
    event: 'generate_lead',
    source: 'newsletter_popup',
    optin_type: '5joursofferts',
    lead_type: '5_jours'
  }
  ```

### Google Tag Manager

- ✅ GTM est configuré avec l'ID `GTM-FVTMPVN2`
- ✅ `dataLayer` est initialisé sur toutes les pages
- ✅ Les événements sont envoyés automatiquement

## ⚙️ Configuration manuelle requise dans Google Analytics 4

### Étape 1 : Vérifier que Google Analytics 4 est connecté à GTM

1. **Allez dans Google Analytics 4** : https://analytics.google.com
2. **Vérifiez la connexion GTM** :
   - **Admin** → **Propriété** → **Flux de données**
   - Vérifiez qu'un flux de données est configuré
   - Vérifiez que GTM est connecté (si vous utilisez GTM pour GA4)

**Note** : Si vous utilisez directement le code GA4 (gtag.js) au lieu de GTM, vérifiez que le code est présent sur toutes les pages.

### Étape 2 : Marquer `generate_lead` comme événement de conversion

⚠️ **IMPORTANT** : Cette étape est nécessaire pour que les leads apparaissent dans les rapports de conversions.

1. **Allez dans Google Analytics 4** : https://analytics.google.com
2. **Admin** → **Événements**
3. **Cherchez l'événement** : `generate_lead`
4. **Activez le toggle** "Marquer comme conversion" (étoile ⭐)
5. **Enregistrez**

**Résultat** : L'événement `generate_lead` apparaîtra dans :
- **Rapports** → **Engagement** → **Conversions**
- **Rapports** → **Acquisition** → **Conversions par source/medium**

### Étape 3 : (Optionnel) Créer des événements personnalisés pour différencier les types de leads

Si vous voulez suivre séparément les "2 pratiques" et "5 jours", vous pouvez créer des événements personnalisés :

1. **Admin** → **Événements** → **Créer un événement**
2. **Créer un événement pour "2 pratiques"** :
   - **Nom de l'événement** : `lead_2_pratiques`
   - **Condition** : `generate_lead` ET `optin_type` = `2pratiques`
3. **Créer un événement pour "5 jours"** :
   - **Nom de l'événement** : `lead_5_jours`
   - **Condition** : `generate_lead` ET `optin_type` = `5joursofferts`
4. **Marquer ces événements comme conversions** si vous voulez les suivre séparément

**Note** : Ce n'est pas obligatoire. L'événement `generate_lead` avec les paramètres `optin_type` et `lead_type` permet déjà de différencier les types de leads dans les rapports.

### Étape 4 : Configurer les rapports personnalisés (optionnel)

Pour mieux visualiser les leads par type :

1. **Rapports** → **Engagement** → **Événements**
2. **Cliquez sur** `generate_lead`
3. **Ajoutez des dimensions** :
   - `optin_type` (2pratiques / 5joursofferts)
   - `lead_type` (2_pratiques / 5_jours)
   - `source` (newsletter_optin / newsletter_popup)

## ✅ Vérification que tout fonctionne

### Méthode 1 : Console du navigateur (recommandé)

1. **Ouvrez la console** (F12)
2. **Effectuez un opt-in complet** :
   - Pour "2 pratiques" : Inscription → Confirmation par email → Clic sur le lien
   - Pour "5 jours" : Inscription via popup OU confirmation par email
3. **Vérifiez dans la console** :
   ```javascript
   // Vérifier que l'événement est dans dataLayer
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

### Méthode 2 : Google Analytics - Temps réel

1. **Allez dans GA4** → **Rapports** → **Temps réel**
2. **Effectuez un opt-in complet**
3. **Dans la section "Événements"**, vous devriez voir :
   - `generate_lead` apparaît dans la liste
   - Cliquez dessus pour voir les paramètres (`optin_type`, `lead_type`, `source`)

### Méthode 3 : Google Tag Manager - Mode aperçu

1. **Installez l'extension** : [Google Tag Manager Preview](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)
2. **Activez le mode aperçu** dans GTM
3. **Effectuez un opt-in complet**
4. **Dans le panneau GTM Preview** :
   - L'événement `generate_lead` apparaît dans **Événements**
   - Le tag Google Analytics se déclenche dans **Tags Fired**

## 📊 Résumé de la configuration manuelle

### ✅ À faire dans Google Analytics 4

1. **Marquer `generate_lead` comme conversion** :
   - **Admin** → **Événements** → Trouvez `generate_lead` → Activez "Marquer comme conversion"
   - ⚠️ **C'est la seule étape obligatoire**

2. **(Optionnel) Créer des événements personnalisés** pour différencier "2 pratiques" et "5 jours"

3. **(Optionnel) Configurer des rapports personnalisés** avec les dimensions `optin_type` et `lead_type`

### ✅ Ce qui fonctionne automatiquement

- ✅ Envoi de l'événement `generate_lead` via `dataLayer`
- ✅ Transmission à Google Analytics via GTM
- ✅ Paramètres `optin_type`, `lead_type`, et `source` inclus automatiquement
- ✅ Apparition dans les rapports "Temps réel" et "Événements"

## 🔍 Dépannage

### L'événement n'apparaît pas dans GA4

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

4. **Vérifiez que Google Analytics est configuré dans GTM** :
   - Allez dans GTM → Vérifiez qu'un tag Google Analytics 4 est configuré
   - Vérifiez que le tag se déclenche sur l'événement `generate_lead`

### L'événement apparaît dans dataLayer mais pas dans GA4

- Vérifiez que le tag Google Analytics 4 est bien configuré dans GTM
- Vérifiez que le tag se déclenche sur l'événement `generate_lead`
- Vérifiez les filtres dans GA4 (Admin → Données → Filtres de données)

## 📝 Notes importantes

- ⚠️ Les événements ne sont envoyés que si `window.dataLayer` existe (GTM chargé)
- ⚠️ Les événements ne sont envoyés que si le consentement aux cookies a été donné
- ⚠️ Pour les "2 pratiques" : L'événement est envoyé uniquement après confirmation par email (pas juste à l'inscription)
- ⚠️ Pour les "5 jours" : L'événement est envoyé soit après inscription directe (popup), soit après confirmation par email
- ✅ L'événement `generate_lead` est un événement recommandé GA4, donc il bénéficie de rapports prédéfinis
