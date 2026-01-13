# Configuration de la clé publique Stripe pour les réservations

## 🔑 Où trouver votre clé publique Stripe ?

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Developers** → **API keys**
3. Dans la section **Publishable key**, copiez la clé publique (commence par `pk_test_` en mode test ou `pk_live_` en production)

## 📋 Méthode 1 : Variable d'environnement (recommandé)

### Pour le développement local

Créez un fichier `.env` à la racine du projet (ne sera pas commité dans Git) :

```bash
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

Puis démarrez le serveur :

```bash
npm start
```

### Pour la production (GitHub Pages)

1. Allez sur votre repository GitHub
2. Cliquez sur **Settings** (Paramètres)
3. Dans le menu de gauche, cliquez sur **Secrets and variables** → **Actions**
4. Cliquez sur **New repository secret** (Nouveau secret du dépôt)
5. **Name** : `STRIPE_PUBLISHABLE_KEY`
6. **Secret** : Votre clé publique Stripe (commence par `pk_live_` pour la production)
7. Cliquez sur **Add secret** (Ajouter le secret)

Le workflow GitHub Actions utilisera automatiquement ce secret lors du build.

**Note** : Le workflow `.github/workflows/deploy.yml` est déjà configuré pour utiliser ce secret.

## 📋 Méthode 2 : Configuration directe (alternative)

Si vous préférez configurer directement dans le code, modifiez `src/assets/js/booking.js` ligne 17 :

```javascript
STRIPE_PUBLISHABLE_KEY: 'pk_live_xxxxx', // Remplacez par votre clé publique
```

⚠️ **Note** : Cette méthode n'est pas recommandée si le code est public sur GitHub, car la clé sera visible dans le code source.

## ✅ Vérification

1. Ouvrez la page de réservation : https://fluance.io/presentiel/reserver/
2. Essayez de réserver un cours avec le mode de paiement "Carte / TWINT"
3. Vous ne devriez plus voir le message "Le système de paiement n'est pas disponible"

## 🔒 Sécurité

- ✅ La clé publique Stripe (`pk_`) peut être exposée dans le code source (c'est normal, elle est destinée au client)
- ✅ La clé secrète Stripe (`sk_`) doit rester secrète et être stockée dans Firebase Secrets
- ✅ Utilisez `pk_test_` pour le développement et les tests
- ✅ Utilisez `pk_live_` uniquement en production

## 🐛 Dépannage

### Le message d'erreur persiste

1. Vérifiez que la variable d'environnement est bien définie :
   ```bash
   echo $STRIPE_PUBLISHABLE_KEY
   ```

2. Vérifiez dans la console du navigateur (F12) que `window.FLUANCE_STRIPE_CONFIG` contient bien votre clé

3. Redémarrez le serveur après avoir modifié la variable d'environnement

### La clé n'est pas injectée

- Vérifiez que le shortcode `{% stripeConfig %}` est bien présent dans les pages `reserver.md`
- Vérifiez que la variable d'environnement est accessible à Eleventy
