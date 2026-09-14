# Guide de migration vers le domaine racine (fluance.io)

Ce document explique comment migrer le site de `https://cedric-v.github.io/fluance-io/` vers `https://fluance.io/` (domaine racine).

## ✅ Bonne nouvelle : le code est déjà prêt !

Le site a été conçu pour fonctionner avec ou sans pathPrefix. La migration nécessite uniquement de modifier la configuration du build en production.

---

## 📋 Étapes de migration

### 1. Préparer le domaine fluance.io

#### 1.1 Configuration DNS

Assurez-vous que votre domaine `fluance.io` pointe vers GitHub Pages :

- **Type A** : Point vers les adresses IP de GitHub Pages :
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```

- **Type CNAME** (recommandé pour les sous-domaines) : Si vous utilisez un sous-domaine comme `www.fluance.io`, créez un CNAME pointant vers `cedric-v.github.io`

#### 1.2 Configuration GitHub Pages

Dans votre dépôt GitHub (`cedric-v/fluance-io`) :

1. Allez dans **Settings → Pages**
2. Dans la section **Custom domain**, entrez `fluance.io`
3. Cochez **"Enforce HTTPS"** (une fois le DNS configuré et le certificat SSL généré)

---

### 2. Modifier la configuration du build

Le site utilise actuellement le pathPrefix `/fluance-io` pour GitHub Pages. Pour le domaine racine, il faut le retirer.

#### Option A : Modifier directement `eleventy.config.mjs` (recommandé)

Modifiez la ligne 6 de `eleventy.config.mjs` :

**AVANT** (pour GitHub Pages) :
```javascript
const PATH_PREFIX = process.env.ELEVENTY_ENV === 'prod' ? "/fluance-io" : "";
```

**APRÈS** (pour domaine racine) :
```javascript
const PATH_PREFIX = ""; // Pas de pathPrefix pour le domaine racine
```

#### Option B : Utiliser une variable d'environnement (plus flexible)

Si vous voulez garder la flexibilité pour déployer sur les deux environnements :

1. Modifiez `eleventy.config.mjs` :
```javascript
// PathPrefix conditionnel : vide en dev, configurable en prod
const PATH_PREFIX = process.env.ELEVENTY_ENV === 'prod' 
  ? (process.env.PATH_PREFIX || "") 
  : "";
```

2. Dans votre workflow GitHub Actions (`.github/workflows/deploy.yml`), modifiez la section build :

**AVANT** :
```yaml
- name: Build site
  env:
    ELEVENTY_ENV: prod
  run: npm run build
```

**APRÈS** :
```yaml
- name: Build site
  env:
    ELEVENTY_ENV: prod
    PATH_PREFIX: ""  # Vide pour domaine racine, "/fluance-io" pour GitHub Pages
  run: npm run build
```

---

### 3. Vérifier les URLs canoniques

Vérifiez que les URLs canoniques dans `src/_includes/base.njk` utilisent bien `fluance.io` :

```nunjucks
<link rel="canonical" href="https://fluance.io{{ page.url }}">
```

Si vous avez des URLs hardcodées, remplacez-les par des URLs relatives ou utilisez une variable d'environnement.

---

### 4. Tester localement

Avant de déployer, testez que tout fonctionne sans pathPrefix :

```bash
# Build en mode production (sans pathPrefix)
npm run build

# Vérifiez que les liens dans _site/index.html n'ont pas de /fluance-io
grep -o 'href="[^"]*"' _site/index.html | head -10

# Les liens devraient être : /cours-en-ligne/..., /presentiel/..., etc.
# Et NON : /fluance-io/cours-en-ligne/...
```

---

### 5. Déployer

1. **Commitez et poussez les changements** :
   ```bash
   git add eleventy.config.mjs
   git commit -m "Migration vers domaine racine fluance.io"
   git push origin main
   ```

2. **Attendez que GitHub Actions termine le déploiement**

3. **Vérifiez que le site fonctionne** sur `https://fluance.io/`

---

### 6. Redirections (optionnel mais recommandé)

Pour éviter de perdre le référencement et les liens existants vers `cedric-v.github.io/fluance-io/`, vous pouvez :

#### Option A : Garder le dépôt GitHub Pages actif avec redirections

Créez un fichier `_site/index.html` qui redirige vers `fluance.io` :

```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=https://fluance.io/">
  <link rel="canonical" href="https://fluance.io/">
</head>
<body>
  <p>Redirection vers <a href="https://fluance.io/">fluance.io</a></p>
</body>
</html>
```

#### Option B : Utiliser un fichier `.htaccess` (si vous utilisez Apache)

Si vous migrez vers un hébergeur Apache, créez un fichier `.htaccess` :

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^cedric-v\.github\.io$ [OR]
RewriteCond %{HTTP_HOST} ^.*\.github\.io$
RewriteRule ^fluance-io/(.*)$ https://fluance.io/$1 [R=301,L]
```

#### Option C : Redirections côté DNS/CDN

Si vous utilisez un CDN (Cloudflare, etc.), configurez les redirections 301 au niveau du DNS/CDN.

---

## 🔍 Vérifications post-migration

Après la migration, vérifiez :

- [ ] Le site est accessible sur `https://fluance.io/`
- [ ] Tous les liens internes fonctionnent (menu, footer, boutons CTA)
- [ ] Les images et assets CSS se chargent correctement
- [ ] Le changement de langue (FR ↔ EN) fonctionne
- [ ] Les formulaires de contact fonctionnent
- [ ] Le sitemap est accessible sur `https://fluance.io/sitemap.xml`
- [ ] Les redirections depuis l'ancien domaine fonctionnent (si configurées)
- [ ] Le certificat SSL est valide (cadenas vert dans le navigateur)

---

## 🚨 En cas de problème

### Les liens ne fonctionnent pas

- Vérifiez que `PATH_PREFIX` est bien vide dans `eleventy.config.mjs`
- Vérifiez que le build a bien été fait avec `ELEVENTY_ENV=prod`
- Inspectez le HTML généré dans `_site/` pour voir les URLs

### Les assets (CSS, images) ne se chargent pas

- Vérifiez que le filtre `url` dans `base.njk` fonctionne correctement
- Les assets utilisent toujours le filtre `url` qui ajoute automatiquement le pathPrefix
- Si `PATH_PREFIX` est vide, les assets devraient être à `/assets/...` et non `/fluance-io/assets/...`

### Le domaine ne se charge pas

- Vérifiez la configuration DNS (peut prendre jusqu'à 48h pour se propager)
- Vérifiez que GitHub Pages reconnaît le domaine dans Settings → Pages
- Attendez la génération du certificat SSL (peut prendre quelques minutes)

---

## 📝 Notes importantes

1. **Le code actuel fonctionne déjà** : Tous les liens utilisent le filtre `relativeUrl` qui s'adapte automatiquement au pathPrefix configuré.

2. **Pas besoin de modifier les templates** : Les templates Nunjucks utilisent déjà `relativeUrl` pour tous les liens internes, donc ils s'adapteront automatiquement.

3. **Les assets (CSS, images)** utilisent le filtre `url` qui respecte aussi le pathPrefix configuré dans Eleventy.

4. **Testez toujours localement** avant de déployer en production.

---

## 🔄 Retour en arrière

Si vous devez revenir à GitHub Pages avec pathPrefix :

1. Remettez `PATH_PREFIX = "/fluance-io"` dans `eleventy.config.mjs`
2. Commitez et poussez
3. Le site redeviendra accessible sur `https://cedric-v.github.io/fluance-io/`

---

## 📞 Support

Si vous rencontrez des problèmes lors de la migration, vérifiez :
- Les logs GitHub Actions
- La console du navigateur (F12)
- Les logs DNS avec `dig fluance.io` ou `nslookup fluance.io`


