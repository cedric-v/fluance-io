# Configuration Google Ads / GTM pour le suivi des réservations de cours en présentiel

Ce guide explique comment configurer le suivi des conversions Google Ads pour les réservations de cours en présentiel via `https://fluance.io/presentiel/reserver/`.

## Vue d'ensemble

Le suivi des conversions est déjà implémenté dans le code :
- ✅ **Page de confirmation** : `/presentiel/reservation-confirmee/` qui envoie les événements via `dataLayer`
- ✅ **Fonction Firebase** : `getBookingDetails` qui récupère les détails de la réservation
- ✅ **Google Tag Manager** : Déjà configuré avec l'ID `GTM-FVTMPVN2`
- ✅ **Événements dataLayer** : `purchase` et `course_booking_confirmed` sont envoyés automatiquement

## Architecture

### Flux de conversion

1. **Utilisateur réserve un cours** → Paiement via Stripe
2. **Paiement réussi** → Redirection vers `/presentiel/reservation-confirmee/?payment_intent={PAYMENT_INTENT_ID}&redirect_status=succeeded`
3. **Page de confirmation** :
   - Récupère le `payment_intent` depuis l'URL
   - Appelle la fonction Firebase `getBookingDetails` pour récupérer les détails
   - Envoie les événements de conversion à Google Ads via `dataLayer`

### Événements envoyés

Deux événements sont envoyés automatiquement via `dataLayer` :

#### 1. `purchase` (événement e-commerce standard)
```javascript
{
  event: 'purchase',
  transaction_id: 'pi_xxxxx', // Payment Intent ID ou Booking ID
  value: 25.00, // Montant en CHF
  currency: 'CHF',
  items: [{
    item_id: 'single', // ou 'trial', 'flow_pass', 'semester_pass'
    item_name: 'Réservation de cours', // ou 'Cours d'essai', 'Flow Pass', etc.
    item_category: 'course_booking',
    price: 25.00,
    quantity: 1
  }]
}
```

#### 2. `course_booking_confirmed` (événement personnalisé)
```javascript
{
  event: 'course_booking_confirmed',
  booking_type: 'single', // ou 'trial', 'flow_pass', 'semester_pass'
  booking_name: 'Réservation de cours',
  course_name: 'Yoga Flow',
  course_date: '05/02/2026',
  course_time: '20:15',
  value: 25.00,
  currency: 'CHF',
  transaction_id: 'pi_xxxxx'
}
```

## Configuration étape par étape

### Étape 1 : Vérifier que GTM est bien chargé

✅ **Déjà configuré** : GTM est chargé avec l'ID `GTM-FVTMPVN2` dans `src/_includes/base.njk`

**Vérification** :
1. Ouvrez la console du navigateur (F12)
2. Tapez : `window.dataLayer`
3. Vous devriez voir un tableau avec des événements

### Étape 2 : Installer le Google tag (recommandé)

**⚠️ IMPORTANT** : Le Google tag est recommandé pour améliorer la précision du suivi. Si vous voyez le message "No Google tag found in this container" lors de la configuration du tag de conversion, vous pouvez soit créer le Google tag maintenant, soit continuer (le tag de conversion fonctionnera quand même).

1. **Connectez-vous à Google Tag Manager** : https://tagmanager.google.com
2. **Sélectionnez votre conteneur** : `GTM-FVTMPVN2`
3. **Créez un nouveau tag** :
   - Cliquez sur **Tags** → **Nouveau**
   - Nommez-le : `Google tag`

4. **Configuration du tag** :
   - **Type de tag** : `Google tag`
   - **ID de mesure** : Entrez votre ID Google Ads (format : `AW-XXXXXXXXX`)
     - Pour trouver votre ID : Google Ads → Outils → Conversions → Votre conversion → Détails → ID de mesure
     - Ou utilisez l'ID de votre compte Google Ads

5. **Déclencheur** :
   - Sélectionnez : `All Pages` (Toutes les pages)
   - Ce tag doit se déclencher sur toutes les pages du site

6. **Enregistrez le tag**

### Étape 2b : Installer le Conversion Linker (une seule fois)

**⚠️ IMPORTANT** : Le Conversion Linker doit être installé **une seule fois** sur toutes les pages pour améliorer la précision du suivi. Si vous l'avez déjà installé, passez à l'étape 3.

1. **Créez un nouveau tag** :
   - Cliquez sur **Tags** → **Nouveau**
   - Nommez-le : `Google Ads - Conversion Linker`

2. **Configuration du tag** :
   - **Type de tag** : `Conversion Linker`
   - **Aucune configuration supplémentaire nécessaire**

3. **Déclencheur** :
   - Sélectionnez : `All Pages` (Toutes les pages)
   - Ce tag doit se déclencher sur toutes les pages du site

4. **Enregistrez le tag**

**Note** : Le Conversion Linker améliore la précision du suivi en liant les clics sur les annonces aux conversions. Il doit être installé avant les tags de conversion.

### Étape 3 : Créer un tag Google Ads Conversion Tracking

1. **Connectez-vous à Google Tag Manager** : https://tagmanager.google.com
2. **Sélectionnez votre conteneur** : `GTM-FVTMPVN2`
3. **Créez un nouveau tag** :
   - Cliquez sur **Tags** → **Nouveau**
   - Nommez-le : `Google Ads - Conversion Présentiel`

4. **Configuration du tag** :
   - **Type de tag** : `Google Ads Conversion Tracking` ⚠️ **Choisissez cette option, pas "Conversion Linker"**
   - **ID de conversion** : Entrez votre ID de conversion Google Ads (ex: `12345678901`)
     - Pour trouver votre ID : Google Ads → Outils → Conversions → Votre conversion → Détails
   - **Conversion Label** : ⚠️ **OBLIGATOIRE** - Entrez le Conversion Label de votre conversion Google Ads
     - Pour trouver votre Conversion Label : Google Ads → Outils → Conversions → Votre conversion → Détails
     - Le Conversion Label est généralement un code alphanumérique (ex: `abc123` ou `xyz789`)
     - Il est affiché dans les détails de la conversion, souvent à côté du Conversion ID
     - Si vous ne le voyez pas, il peut être généré automatiquement lors de la création de la conversion
   - **Valeur de conversion** : `{{Value}}` (variable à créer - voir ci-dessous)
   - **Devise** : `CHF` (ou utilisez la variable `{{Currency}}` si vous voulez la rendre dynamique)
   - **ID de transaction** : `{{Transaction ID}}` (variable à créer - voir ci-dessous)

   ⚠️ **Si vous voyez le message "No Google tag found in this container"** :
   - **Option 1 (Recommandé)** : Cliquez sur **"Create tag"** pour créer le Google tag maintenant (voir Étape 2)
   - **Option 2** : Vous pouvez continuer sans créer le Google tag. Le tag de conversion fonctionnera quand même, mais le suivi sera moins précis.

5. **Déclencheur** :
   - Cliquez sur **Déclencheur** → **Nouveau**
   - Nommez-le : `Course Booking Confirmed`
   - **Type** : `Custom Event` (Événement personnalisé)
   - **Event name** (Nom de l'événement) : `course_booking_confirmed` (exactement comme dans votre code)
   - **This trigger fires on** : Laissez sur **"All Custom Events"** ✅
     - C'est correct car le nom de l'événement (`course_booking_confirmed`) filtre déjà correctement
     - Le tag se déclenchera uniquement quand cet événement spécifique sera envoyé

6. **Variables à créer** :

   **Méthode 1 : Créer les variables depuis le champ du tag (recommandé)**
   
   Lorsque vous cliquez sur l'icône de variable (📦) à côté de "Conversion Value" ou "Transaction ID" :
   1. Cliquez sur **"+ Nouvelle variable"** ou **"Add Variable"**
   2. **Choose variable type** : 
      - ⚠️ **Cherchez dans la liste** : `Data Layer Variable` (Variable de couche de données)
      - Il se trouve généralement dans la catégorie **"Page Variables"** ou **"Variables de page"**
      - Si vous ne le voyez pas, faites défiler la liste ou utilisez la barre de recherche
      - Sélectionnez **`Data Layer Variable`**
   3. **Après avoir sélectionné "Data Layer Variable"**, configurez la variable :
      - **Variable 1 : Value**
        - Nom de la variable : `Value`
        - **Data Layer Variable Name** : `value` (exactement comme dans votre code, en minuscules)
        - **Data Layer Version** : `Version 2`
        - ⚠️ **"Value Type" ou "Type de valeur"** : 
          - Si cette option est visible, sélectionnez `Number` (Nombre)
          - Si cette option n'est PAS visible, ce n'est pas grave ! GTM détectera automatiquement que c'est un nombre
          - L'important est que le nom de la variable soit correct (`value`)
      - **Variable 2 : Transaction ID**
        - Nom de la variable : `Transaction ID`
        - **Data Layer Variable Name** : `transaction_id` (exactement comme dans votre code, avec underscore)
        - **Data Layer Version** : `Version 2`
        - ⚠️ **"Value Type" ou "Type de valeur"** :
          - Si cette option est visible, sélectionnez `Text` (Texte)
          - Si cette option n'est PAS visible, ce n'est pas grave ! GTM traitera automatiquement la valeur comme du texte
          - L'important est que le nom de la variable soit correct (`transaction_id`)
   4. Enregistrez chaque variable
   5. Sélectionnez-la dans le champ du tag

   **Méthode 2 : Créer les variables depuis le menu Variables**
   
   - **Tags** → **Variables** → **Nouveau**
   - **Variable 1 : Value**
     - Nom : `Value`
     - Type : `Data Layer Variable` (Variable de couche de données)
     - Data Layer Variable Name : `value`
     - Data Layer Version : `Version 2`
     - Type de valeur : `Number` (Nombre)
   - **Variable 2 : Transaction ID**
     - Nom : `Transaction ID`
     - Type : `Data Layer Variable` (Variable de couche de données)
     - Data Layer Variable Name : `transaction_id`
     - Data Layer Version : `Version 2`
     - Type de valeur : `Text` (Texte)

7. **Enregistrez le tag**

**Réponse à votre question** : 

Pour suivre les conversions de réservations, vous devez choisir **`Google Ads Conversion Tracking`** (pas "Conversion Linker").

**Différence entre les deux** :
- **Conversion Linker** : Tag de base à installer **une seule fois** sur toutes les pages pour améliorer la précision du suivi. Il lie les clics sur les annonces aux conversions.
- **Google Ads Conversion Tracking** : Tag qui envoie **les événements de conversion spécifiques** à Google Ads. C'est celui que vous utilisez pour chaque conversion (réservations, achats, etc.).

**En résumé** : Vous avez besoin des **deux**, mais pour le tag de conversion des réservations, choisissez **`Google Ads Conversion Tracking`**.

### Étape 4 : Créer une conversion dans Google Ads

1. **Connectez-vous à Google Ads** : https://ads.google.com
2. **Allez dans** : **Outils et paramètres** → **Conversions**
3. **Cliquez sur** : **+ Nouveau événement de conversion**
4. **Choisissez** : **Créer une nouvelle action de conversion**

5. **Étape "Get started" - Choisir la source de données** :
   - Sélectionnez : **Conversions on a website**
   - **URL du site web** : Entrez `https://fluance.io` ou `fluance.io`
     - ⚠️ **C'est l'URL principale de votre site où les conversions se produisent**
     - Cette URL permet à Google Ads d'associer les conversions à votre site
   - Cliquez sur **Continue** (Continuer)

6. **Remplissez le formulaire de conversion** :
   - **Catégorie** : `Achat / Vente`
   - **Nom** : `Réservation cours présentiel`
   - **Valeur** : `Utiliser différentes valeurs pour chaque action`
   - **Comptage** : `Une` (une conversion par transaction)
   - **Fenêtre d'attribution** : `30 jours` (recommandé)
   - **Fenêtre de recherche** : `30 jours` (recommandé)

7. **Méthode d'importation** :
   - Sélectionnez : **Google Tag Manager**
   - Sélectionnez votre conteneur GTM : `GTM-FVTMPVN2`
   - **Événement de conversion** : `course_booking_confirmed`

8. **Enregistrez la conversion**

9. **Récupérez le Conversion ID et le Conversion Label** :
   - Allez dans **Google Ads** → **Outils et paramètres** → **Conversions**
   - Cliquez sur votre conversion : `Réservation cours présentiel`
   - Dans la section **"Tag setup"** ou **"Détails"**, vous verrez :
     - **Conversion ID** : `12345678901` (exemple - remplacez par votre ID réel)
     - **Conversion Label** : Un code alphanumérique (ex: `abc123`, `xyz789`, etc.)
       - ⚠️ **Le Conversion Label est OBLIGATOIRE** dans GTM
       - Il peut être affiché sous différents noms : "Label", "Conversion Label", ou dans les détails du tag
   - ⚠️ **Copiez les deux** : Conversion ID ET Conversion Label pour les utiliser dans GTM

### Étape 5 : Configurer le tag Google Ads dans GTM avec l'ID de conversion

1. **Retournez dans GTM**
2. **Modifiez le tag créé à l'étape 2**
3. **Collez l'ID de conversion** dans le champ **ID de conversion**
4. **Vérifiez les variables** :
   - **Valeur** : `{{Value}}`
   - **ID de transaction** : `{{Transaction ID}}`
5. **Enregistrez et publiez** le conteneur

### Étape 6 : (Optionnel) Créer un tag pour l'événement `purchase`

Si vous souhaitez aussi suivre l'événement `purchase` standard :

1. **Créez un nouveau tag** : `Google Ads - Purchase Présentiel`
2. **Configuration** :
   - **Type** : `Google Ads: Conversion Tracking`
   - **ID de conversion** : Un autre ID de conversion Google Ads (ou le même)
   - **Valeur** : `{{Value}}`
   - **ID de transaction** : `{{Transaction ID}}`
3. **Déclencheur** :
   - **Type** : `Événement personnalisé`
   - **Nom** : `purchase`
   - **Condition** : `item_category` = `course_booking` (pour ne tracker que les réservations de cours)

### Étape 6b : Comprendre le statut "Inactive" dans Google Ads

⚠️ **C'est normal** : Après avoir créé une conversion dans Google Ads, elle apparaît souvent avec le statut **"Inactive"** (Inactive).

**Pourquoi "Inactive" ?**
- Google Ads doit d'abord détecter que le tag fonctionne correctement
- Il faut qu'au moins une conversion soit enregistrée pour que le statut passe à "Active"
- Cela peut prendre quelques heures à quelques jours

**Comment activer la conversion ?**
1. **Vérifiez que votre tag GTM est publié** :
   - Allez dans GTM → Vérifiez que votre tag "Google Ads - Conversion Présentiel" est bien enregistré
   - **Publiez le conteneur** si ce n'est pas déjà fait (Bouton "Submit" en haut à droite)

2. **Effectuez une réservation test** :
   - Faites une réservation test sur votre site
   - Vérifiez que l'événement `course_booking_confirmed` est bien envoyé (voir tests ci-dessous)

3. **Attendez 24-48 heures** :
   - Google Ads peut prendre jusqu'à 48 heures pour détecter la première conversion
   - Une fois la première conversion détectée, le statut passera automatiquement à "Active"

4. **Si après 48h c'est toujours "Inactive"** :
   - Cliquez sur "Troubleshooting" dans Google Ads pour voir les erreurs éventuelles
   - Vérifiez que le tag GTM est bien publié
   - Vérifiez que l'événement est bien envoyé (voir section "Tester la configuration")

**Note** : Le statut "Inactive" n'empêche pas le suivi des conversions. Les conversions sont quand même enregistrées, mais Google Ads attend de voir une conversion réelle avant de marquer la conversion comme "Active".

### Étape 7 : Tester la configuration

#### URL de la page de confirmation

La page où les événements de conversion sont envoyés est :
- **URL** : `https://fluance.io/presentiel/reservation-confirmee/`
- **Paramètres requis** : `?payment_intent={PAYMENT_INTENT_ID}&redirect_status=succeeded`

⚠️ **Important** : Cette page nécessite un `payment_intent` valide dans l'URL. Vous ne pouvez pas simplement visiter l'URL sans paramètres.

#### Méthode 1 : Test avec une vraie réservation (recommandé)

1. **Effectuez une vraie réservation test** :
   - Allez sur : `https://fluance.io/presentiel/reserver/`
   - Réservez un cours (utilisez le mode test Stripe si disponible)
   - Complétez le paiement
   - Vous serez redirigé automatiquement vers la page de confirmation avec les bons paramètres

2. **Sur la page de confirmation** (`/presentiel/reservation-confirmee/`), vérifiez que :
   - La page s'affiche correctement
   - Les détails de la réservation sont visibles
   - L'événement est envoyé (voir Méthode 2)

#### Méthode 2 : Mode aperçu GTM (recommandé pour le debug)

1. **Installez l'extension** : [Google Tag Manager Preview](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk)
2. **Activez le mode aperçu** dans GTM :
   - Allez dans GTM → Cliquez sur "Preview" en haut à droite
   - Entrez l'URL de votre site : `https://fluance.io`
3. **Effectuez une réservation test** (ou utilisez un mode test Stripe)
4. **Sur la page de confirmation**, vérifiez dans le panneau GTM Preview :
   - L'événement `course_booking_confirmed` apparaît dans **Événements**
   - Le tag **Google Ads - Conversion Présentiel** se déclenche dans **Tags Fired**
   - Les variables `value` et `transaction_id` sont correctement récupérées

#### Méthode 2 : Console du navigateur

1. **Effectuez une réservation test**
2. **Sur la page de confirmation**, ouvrez la console (F12)
3. **Vérifiez** :
   ```javascript
   // Vérifier que dataLayer contient les événements
   window.dataLayer.filter(e => e.event === 'course_booking_confirmed' || e.event === 'purchase')
   
   // Devrait retourner :
   // [
   //   {
   //     event: 'purchase',
   //     transaction_id: 'pi_xxxxx',
   //     value: 25.00,
   //     currency: 'CHF',
   //     items: [...]
   //   },
   //   {
   //     event: 'course_booking_confirmed',
   //     booking_type: 'single',
   //     value: 25.00,
   //     transaction_id: 'pi_xxxxx',
   //     ...
   //   }
   // ]
   ```

#### Méthode 3 : Google Ads - Temps réel

1. **Allez dans Google Ads** → **Outils et paramètres** → **Conversions**
2. **Cliquez sur votre conversion** : `Réservation cours présentiel`
3. **Effectuez une réservation test**
4. **Vérifiez dans la section "Temps réel"** que la conversion apparaît (peut prendre quelques minutes)

## Types de réservations suivis

Le système suit automatiquement tous les types de réservations :

| Type | `booking_type` | `productName` | Montant |
|------|---------------|---------------|---------|
| Cours d'essai | `trial` | `Cours d'essai` | 0 CHF |
| À la carte | `single` | `Réservation de cours` | 25 CHF |
| Flow Pass | `flow_pass` | `Flow Pass` | 0 CHF (utilise une séance) |
| Pass Semestriel | `semester_pass` | `Pass Semestriel` | 0 CHF (utilise une séance) |

**Note** : Pour les Flow Pass et Pass Semestriel, la valeur est `0` car le paiement a été effectué lors de l'achat du pass, pas lors de la réservation.

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
   // Dans la console, après la réservation
   window.dataLayer.filter(e => e.event === 'course_booking_confirmed')
   ```

4. **Vérifiez le mode aperçu GTM** :
   - L'événement apparaît-il dans **Événements** ?
   - Le tag se déclenche-t-il dans **Tags Fired** ?

### La conversion n'apparaît pas dans Google Ads

1. **Délai** : Les conversions peuvent prendre jusqu'à 3 heures pour apparaître dans Google Ads
2. **Vérifiez l'ID de conversion** : Est-il correct dans GTM ?
3. **Vérifiez les variables** : `value` et `transaction_id` sont-elles correctement récupérées ?
4. **Vérifiez le mode test** : Si vous utilisez Stripe en mode test, les conversions peuvent ne pas être comptabilisées

### L'événement apparaît dans dataLayer mais pas dans GTM

1. **Vérifiez le nom de l'événement** : Doit être exactement `course_booking_confirmed` (sensible à la casse)
2. **Vérifiez le déclencheur** : Le déclencheur doit correspondre exactement au nom de l'événement
3. **Vérifiez que GTM est publié** : Les modifications doivent être publiées pour être actives

## Variables dataLayer disponibles

Pour créer des tags supplémentaires ou des déclencheurs personnalisés, voici toutes les variables disponibles dans `dataLayer` lors d'une réservation :

```javascript
{
  // Événement purchase (standard)
  event: 'purchase',
  transaction_id: 'pi_xxxxx',
  value: 25.00,
  currency: 'CHF',
  items: [{
    item_id: 'single',
    item_name: 'Réservation de cours',
    item_category: 'course_booking',
    price: 25.00,
    quantity: 1
  }],
  
  // Événement course_booking_confirmed (personnalisé)
  event: 'course_booking_confirmed',
  booking_type: 'single', // 'trial', 'single', 'flow_pass', 'semester_pass'
  booking_name: 'Réservation de cours',
  course_name: 'Yoga Flow',
  course_date: '05/02/2026',
  course_time: '20:15',
  value: 25.00,
  currency: 'CHF',
  transaction_id: 'pi_xxxxx'
}
```

## Enhanced Conversions (Conversions améliorées) - Recommandé

### Qu'est-ce que c'est ?

Les "Enhanced Conversions" (Conversions améliorées) permettent à Google Ads d'utiliser des données hashées (email, nom, téléphone, adresse) pour améliorer le suivi des conversions, même quand les cookies tiers ne sont pas disponibles.

### Avantages

✅ **Meilleure précision du suivi** : Même sans cookies, Google peut associer les conversions aux clics sur les annonces
✅ **Meilleure attribution** : Les conversions sont mieux attribuées aux bonnes campagnes
✅ **Conformité RGPD** : Les données sont hashées (cryptées) avant envoi, donc anonymisées
✅ **Fonctionne avec GTM** : Compatible avec votre configuration actuelle

### Recommandation

**✅ OUI, activez "Enhanced Conversions"** dans Google Ads :
1. Allez dans **Google Ads** → **Outils et paramètres** → **Conversions**
2. Cliquez sur votre conversion : `Réservation cours présentiel`
3. Activez **"Enhanced conversions"** ou **"Conversions améliorées"**
4. Choisissez **"Google Tag Manager"** comme méthode d'implémentation
5. GTM enverra automatiquement les données hashées depuis votre dataLayer

### Données nécessaires

Pour que cela fonctionne, vous devez envoyer ces données dans votre dataLayer (déjà fait dans votre code) :
- Email (hashé automatiquement par GTM)
- Prénom (optionnel mais recommandé)
- Nom (optionnel mais recommandé)
- Téléphone (optionnel)

Votre code envoie déjà ces données via `course_booking_confirmed`, donc cela devrait fonctionner automatiquement.

## Notes importantes

- ⚠️ Les événements ne sont envoyés que si `window.dataLayer` existe (GTM chargé)
- ⚠️ Les événements ne sont envoyés que si le consentement aux cookies a été donné
- ⚠️ Le `payment_intent` doit être présent dans l'URL pour que le tracking fonctionne
- ⚠️ Les conversions peuvent prendre jusqu'à 3 heures pour apparaître dans Google Ads
- ⚠️ Pour les réservations avec Flow Pass ou Pass Semestriel, la valeur est `0` car le paiement a été effectué lors de l'achat du pass
- ✅ **Enhanced Conversions** : Recommandé pour améliorer la précision du suivi

## Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs de la console du navigateur
2. Utilisez le mode aperçu GTM pour diagnostiquer
3. Vérifiez que la fonction Firebase `getBookingDetails` retourne bien les données attendues
