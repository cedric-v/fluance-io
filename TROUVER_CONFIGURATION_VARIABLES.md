# Guide : Trouver la configuration des variables d'environnement Firebase Functions

## Méthode 1 : Via l'onglet Configuration (recommandé)

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Dans le menu de gauche, cliquez sur **Functions**
4. **En haut de la page**, vous devriez voir plusieurs onglets :
   - **Dashboard** (actuellement sélectionné)
   - **Usage**
   - **Configuration** ← **CLIQUEZ ICI**
5. Dans l'onglet **Configuration**, vous verrez :
   - Section **Environment variables** / **Variables d'environnement**
   - Un bouton **Add variable** / **Ajouter une variable**

## Méthode 2 : Via les paramètres du projet

Si vous ne voyez pas l'onglet Configuration dans Functions :

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Cliquez sur l'icône ⚙️ (Paramètres du projet) en haut à gauche
4. Cliquez sur **Paramètres du projet** / **Project settings**
5. Faites défiler jusqu'à la section **Your Cloud Functions** / **Vos Cloud Functions**
6. Cliquez sur **Environment variables** / **Variables d'environnement**

## Méthode 3 : Via Firebase CLI (alternative)

Si vous préférez utiliser la ligne de commande :

```bash
# Voir les variables actuelles
firebase functions:config:get

# Ajouter une variable (méthode legacy, non recommandée)
firebase functions:config:set mailjet.api_key="VOTRE_CLE"

# Ou utiliser la nouvelle méthode avec les variables d'environnement
# (nécessite d'aller dans la console pour les ajouter)
```

## Si vous ne trouvez toujours pas

**Vérifications à faire :**

1. ✅ Êtes-vous bien connecté avec le bon compte Google ?
2. ✅ Avez-vous les permissions d'éditeur/administrateur sur le projet ?
3. ✅ Le projet **fluance-protected-content** est-il bien sélectionné ?
4. ✅ Les Functions sont-elles bien activées dans votre projet ?

**Note importante :** 
- Les variables d'environnement Firebase Functions sont disponibles uniquement pour les projets avec le plan **Blaze** (pay-as-you-go)
- Si vous êtes sur le plan Spark (gratuit), vous devrez peut-être activer la facturation pour accéder à cette fonctionnalité

## Capture d'écran de référence

L'onglet **Configuration** devrait apparaître juste à côté de l'onglet **Dashboard** dans la page Functions. Si vous ne le voyez pas :

1. Essayez de rafraîchir la page (F5)
2. Videz le cache de votre navigateur
3. Essayez avec un autre navigateur
4. Vérifiez que vous avez bien les permissions nécessaires

## Structure attendue

Une fois que vous avez accès à la configuration, vous devriez voir :

```
Environment variables
┌─────────────────────┬─────────────────────────────┐
│ Name                │ Value                       │
├─────────────────────┼─────────────────────────────┤
│ (vide pour l'instant)                              │
└─────────────────────┴─────────────────────────────┘

[+ Add variable]  [Edit]  [Delete]
```

## Variables à ajouter

Une fois que vous avez accès, ajoutez ces variables :

- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`
- `STRIPE_SECRET_KEY` (si vous utilisez Stripe)
- `STRIPE_WEBHOOK_SECRET` (si vous utilisez Stripe)
- `PAYPAL_CLIENT_ID` (si vous utilisez PayPal)
- `PAYPAL_CLIENT_SECRET` (si vous utilisez PayPal)




