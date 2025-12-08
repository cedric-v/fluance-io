# Guide : Activer les services Firebase pour fluance-protected-content

Ce guide vous explique étape par étape comment activer tous les services Firebase nécessaires pour le contenu protégé.

## 📋 Prérequis

1. Avoir créé le projet Firebase : **fluance-protected-content**
2. Être connecté à votre compte Google/Firebase

## 🚀 Étapes d'activation

### 1. Accéder à votre projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**

---

### 2. Activer Firestore Database

**Firestore** stocke les tokens d'inscription et les métadonnées utilisateurs.

1. Dans le menu de gauche, cliquez sur **Firestore Database** (ou **Build > Firestore Database**)
2. Cliquez sur **Créer une base de données** / **Create database**
3. **Étape 1 : Sélectionner l'édition**
   - Choisissez **Standard edition** (recommandé pour ce projet)
   - ✅ Standard edition est suffisant : documents simples, requêtes basiques, gratuit jusqu'à certaines limites
   - ❌ Enterprise edition n'est pas nécessaire : pas de besoin MongoDB, documents < 1 MiB
   - Cliquez sur **Next** / **Suivant**
4. **Étape 2 : ID et emplacement de la base de données**
   - Laissez l'ID par défaut (ou choisissez-en un personnalisé)
   - Choisissez l'emplacement :
     - ✅ **europe-west6 (Zurich)** - **MEILLEURE OPTION** pour la Suisse (latence minimale, directement en Suisse)
     - ❌ Multi-region europe3 - Non nécessaire (plus coûteux, latence plus élevée)
   - Cliquez sur **Next** / **Suivant**
5. **Étape 3 : Configurer**
   - Choisissez le mode :
     - **Mode production** (recommandé) : règles de sécurité strictes
     - **Mode test** : accès libre pendant 30 jours (pour les tests)
   - Cliquez sur **Activer** / **Enable**

✅ **Firestore est maintenant activé !**

---

### 3. Firebase Storage (NON NÉCESSAIRE)

**Storage n'est pas nécessaire** pour ce projet. Le contenu protégé (texte et HTML) est stocké directement dans **Firestore**, ce qui est plus simple et suffisant pour du contenu texte/HTML (< 1 Mo par document).

✅ **Vous pouvez ignorer cette étape et passer directement à l'étape suivante.**

---

### 4. Activer Firebase Authentication

**Authentication** gère l'authentification des utilisateurs (email/mot de passe).

1. Dans le menu de gauche, cliquez sur **Authentication** (ou **Build > Authentication**)
2. Cliquez sur **Commencer** / **Get started**
3. Activez les fournisseurs d'authentification :
   - Cliquez sur l'onglet **Sign-in method**
   
   **Email/Password** (obligatoire) :
   - Cliquez sur **Email/Password**
   - Activez **Email/Password** (toggle en haut)
   - Cliquez sur **Enregistrer** / **Save**
   
   **Email link (passwordless)** (optionnel mais recommandé) :
   - Cliquez sur **Email link (passwordless sign-in)**
   - Activez **Email link** (toggle en haut)
   - Cliquez sur **Enregistrer** / **Save**
   
   ✅ **Note** : Les deux méthodes sont maintenant disponibles sur la page de connexion. Les utilisateurs peuvent choisir entre mot de passe et lien magique.

✅ **Authentication est maintenant activé !**

---

### 5. Activer Firebase Functions

**Functions** exécute les webhooks de paiement et l'envoi d'emails.

1. Dans le menu de gauche, cliquez sur **Functions** (ou **Build > Functions**)
2. Si c'est la première fois, Firebase vous demandera de :
   - Activer la facturation (nécessaire pour Functions)
   - Accepter les conditions d'utilisation
3. Cliquez sur **Commencer** / **Get started** et suivez les instructions

⚠️ **Note** : Firebase Functions nécessite un plan Blaze (pay-as-you-go), mais il y a un généreux niveau gratuit.

✅ **Functions est maintenant activé !**

---

### 6. Configurer les variables d'environnement (après activation de Functions)

Une fois Functions activé :

1. Dans **Functions**, cliquez sur l'onglet **Configuration**
2. Cliquez sur **Ajouter une variable** / **Add variable**
3. Ajoutez les variables suivantes :

#### Variables Mailjet (obligatoires)
- **Nom** : `MAILJET_API_KEY`  
  **Valeur** : Votre clé API Mailjet
- **Nom** : `MAILJET_API_SECRET`  
  **Valeur** : Votre secret API Mailjet

#### Variables Stripe (si vous utilisez Stripe)
- **Nom** : `STRIPE_SECRET_KEY`  
  **Valeur** : Votre clé secrète Stripe (commence par `sk_`)
- **Nom** : `STRIPE_WEBHOOK_SECRET`  
  **Valeur** : Le secret de signature de votre webhook Stripe (commence par `whsec_`)

#### Variables PayPal (si vous utilisez PayPal)
- **Nom** : `PAYPAL_CLIENT_ID`  
  **Valeur** : Votre Client ID PayPal
- **Nom** : `PAYPAL_CLIENT_SECRET`  
  **Valeur** : Votre Client Secret PayPal

---

## ✅ Vérification

Vérifiez que tous les services sont activés :

- [ ] Firestore Database : visible dans le menu, base de données créée
- [ ] Authentication : visible dans le menu, Email/Password activé
- [ ] Functions : visible dans le menu, prêt à recevoir des déploiements
- [ ] Variables d'environnement : configurées dans Functions > Configuration

**Note** : Storage n'est pas nécessaire - le contenu est stocké dans Firestore.

---

## 📝 Prochaines étapes

Une fois tous les services activés :

1. **Déployer les règles de sécurité** :
   ```bash
   firebase deploy --only firestore:rules
   ```
   
   **Note** : Les règles Storage ne sont pas nécessaires car Storage n'est pas utilisé.

2. **Déployer les fonctions** :
   ```bash
   firebase deploy --only functions
   ```

3. **Configurer les webhooks** Stripe/PayPal avec les URLs des fonctions déployées

---

## 🆘 Besoin d'aide ?

- [Documentation Firebase](https://firebase.google.com/docs)
- [Support Firebase](https://firebase.google.com/support)

