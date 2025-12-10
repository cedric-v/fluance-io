# Guide : Configurer Cloudflare Turnstile pour protéger le formulaire d'inscription

Ce guide explique comment configurer Cloudflare Turnstile pour protéger le formulaire d'inscription newsletter contre les bots.

## 📋 Prérequis

- Compte Cloudflare (gratuit)
- Accès à la console Firebase pour configurer les secrets

## 🔍 Étape 1 : Créer un site Turnstile dans Cloudflare

1. Connectez-vous à votre compte [Cloudflare](https://dash.cloudflare.com/)
2. Allez dans **Security** > **Turnstile**
3. Cliquez sur **Add Site** (Ajouter un site)
4. Configurez le site :
   - **Site name** : `Fluance Newsletter Form` (ou le nom de votre choix)
   - **Domain** : `fluance.io` (ou votre domaine)
   - **Widget mode** : `Managed` (recommandé) ou `Non-interactive` (plus discret)
   - **Widget appearance** : `Always visible` ou `Execute managed challenge only`
5. Cliquez sur **Create** (Créer)

## 🔑 Étape 2 : Récupérer les clés Turnstile

Après la création du site, vous obtiendrez :
- **Site Key** (clé publique) : Commence par `0x4AAAAAAA...`
- **Secret Key** (clé secrète) : Commence par `0x4AAAAAAA...` (différente de la site key)

⚠️ **Important** : 
- La **Site Key** est publique et peut être utilisée côté client
- La **Secret Key** est privée et doit être stockée comme secret Firebase

## ⚙️ Étape 3 : Configurer la Site Key dans le code

La Site Key est déjà configurée dans `src/_includes/newsletter-popup.njk` :

```html
<div class="cf-turnstile" data-sitekey="0x4AAAAAAABkMYinukE8K9X0" ...></div>
```

**Si vous avez créé un nouveau site Turnstile**, remplacez `0x4AAAAAAABkMYinukE8K9X0` par votre Site Key dans le fichier `src/_includes/newsletter-popup.njk`.

## 🔐 Étape 4 : Configurer la Secret Key dans Firebase

Configurez la Secret Key comme secret Firebase :

```bash
echo -n "VOTRE_SECRET_KEY_TURNSTILE" | firebase functions:secrets:set TURNSTILE_SECRET_KEY
```

⚠️ **Important** : Remplacez `VOTRE_SECRET_KEY_TURNSTILE` par votre vraie Secret Key.

## 🚀 Étape 5 : Redéployer les fonctions Firebase

Après avoir configuré le secret, redéployez les fonctions :

```bash
firebase deploy --only functions
```

## ✅ Étape 6 : Vérifier la configuration

Pour vérifier que le secret est bien configuré :

```bash
firebase functions:secrets:access TURNSTILE_SECRET_KEY
```

## 🧪 Tester la protection Turnstile

1. Ouvrez votre site et cliquez sur un bouton "Essayer 2 pratiques libératrices"
2. La pop-up devrait s'ouvrir avec le widget Turnstile visible
3. Complétez le formulaire et soumettez
4. Si Turnstile détecte un bot, la soumission sera rejetée

## 📝 Notes importantes

- **Mode Managed** : Turnstile gère automatiquement les défis (recommandé pour la plupart des cas)
- **Mode Non-interactive** : Plus discret, mais peut nécessiter des défis supplémentaires
- **Widget visible** : Le widget est toujours visible (meilleure UX)
- **Widget invisible** : Le widget n'apparaît que si un bot est détecté (moins intrusif)

## 🔧 Dépannage

### Le widget Turnstile ne s'affiche pas

1. Vérifiez que la Site Key est correcte dans `newsletter-popup.njk`
2. Vérifiez que le script Turnstile est chargé (dans la console du navigateur)
3. Vérifiez que le domaine est bien configuré dans Cloudflare Turnstile

### Erreur "Turnstile verification failed"

1. Vérifiez que `TURNSTILE_SECRET_KEY` est bien configuré :
   ```bash
   firebase functions:secrets:access TURNSTILE_SECRET_KEY
   ```

2. Vérifiez que la Secret Key correspond au site Turnstile créé

3. Vérifiez les logs Firebase Functions :
   ```bash
   firebase functions:log --only subscribeToNewsletter
   ```

### Le formulaire fonctionne sans Turnstile

Si `TURNSTILE_SECRET_KEY` n'est pas configuré, la validation Turnstile est ignorée (avec un avertissement dans les logs). C'est utile pour le développement, mais **ne pas utiliser en production**.

## 📚 Ressources

- [Documentation Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [API Turnstile Siteverify](https://developers.cloudflare.com/turnstile/siteverify/)
- [Documentation Firebase Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
