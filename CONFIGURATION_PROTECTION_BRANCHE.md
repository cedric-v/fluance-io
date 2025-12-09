# Configuration de la protection de branche GitHub

## 📋 Qu'est-ce que la protection de branche ?

La protection de branche empêche des actions risquées sur la branche `main` :
- **Suppression accidentelle** de la branche
- **Force push** (écrasement de l'historique Git)
- **Push direct** sans vérifications de qualité

## 🎯 Configuration recommandée pour ce projet

### Configuration minimale (essentielle)

1. **Protection de base**
   - ✅ Bloquer la suppression de la branche
   - ✅ Bloquer le force push
   - ✅ Bloquer la suppression d'historique

2. **Status checks (recommandé)**
   - ✅ Exiger que le build réussisse avant merge
   - ⚠️ Validation optionnelle (car `continue-on-error: true`)

## 📝 Guide pas à pas

### Étape 1 : Accéder aux paramètres

1. Allez sur votre repository GitHub : `https://github.com/cedric-v/fluance-io`
2. Cliquez sur **Settings** (en haut à droite)
3. Dans le menu de gauche, cliquez sur **Branches**

### Étape 2 : Créer une règle de protection

1. Dans la section **"Branch protection rules"**, cliquez sur **"Add rule"**
2. Dans le champ **"Branch name pattern"**, entrez : `main`
3. Cliquez sur **"Create"**

### Étape 3 : Configurer les options

#### ✅ Options essentielles (à cocher)

- [x] **Protect matching branches**
- [x] **Do not allow bypassing the above settings** (empêche même les admins de contourner)
- [x] **Do not allow force pushes**
- [x] **Do not allow deletions**

#### ✅ Options recommandées (status checks)

- [x] **Require status checks to pass before merging**
  - [x] **Require branches to be up to date before merging**
  - Dans la liste **"Status checks that are required"**, sélectionnez :
    - ✅ `build` (job de build - **obligatoire**)
    - ⚠️ `validate` (job de validation - **optionnel**, car peut échouer sans bloquer)

#### ⚠️ Options optionnelles

- [ ] **Require pull request reviews before merging** (décoché si vous travaillez seul)
- [ ] **Require linear history** (optionnel, pour un historique Git plus propre)
- [ ] **Require conversation resolution before merging** (si vous utilisez les PR)

### Étape 4 : Sauvegarder

1. Cliquez sur **"Save changes"** en bas de la page
2. Confirmez la création de la règle

## 🔍 Vérification

Après configuration, vous devriez voir :
- ✅ Un badge "Protected" à côté de la branche `main`
- ✅ Les status checks requis apparaissent dans les PR
- ✅ Impossible de faire un force push ou de supprimer la branche

## 🚨 Que se passe-t-il après activation ?

### Push direct sur `main` (via `git push`)
- ✅ **Autorisé** si les status checks passent
- ❌ **Bloqué** si les status checks échouent

### Pull Requests
- ✅ Les status checks doivent passer avant de pouvoir merger
- ✅ La branche doit être à jour avec `main`

### Force push
- ❌ **Toujours bloqué** (même pour les admins si "Do not allow bypassing" est coché)

### Suppression de branche
- ❌ **Toujours bloquée**

## 📊 Workflow actuel du projet

Le projet utilise GitHub Actions avec ces jobs :

1. **`build`** : Build du site Eleventy
   - ✅ **Requis** : doit passer pour déployer
   - ⏱️ Durée : ~1-2 minutes

2. **`validate`** : Validation Lighthouse et W3C
   - ⚠️ **Optionnel** : `continue-on-error: true`
   - ⏱️ Durée : ~2-3 minutes
   - 📊 Génère des rapports de qualité

3. **`deploy`** : Déploiement sur GitHub Pages
   - ✅ **Automatique** après `build` réussi

## 🔧 Configuration actuelle recommandée

Pour ce projet, cochez **au minimum** :

```
✅ Protect matching branches
✅ Do not allow bypassing the above settings
✅ Do not allow force pushes
✅ Do not allow deletions
✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   ✅ build (required)
   ⚠️ validate (optional - peut être ignoré si échec)
```

## 💡 Avantages

- 🛡️ **Protection contre les erreurs** : pas de suppression accidentelle
- ✅ **Qualité garantie** : le build doit passer avant déploiement
- 📜 **Historique préservé** : pas de force push qui casse l'historique
- 🚀 **Déploiements sûrs** : seuls les builds qui passent sont déployés

## ⚠️ Notes importantes

1. **Premier push après activation** : Si vous avez déjà des commits en local, vous devrez peut-être faire un `git pull --rebase` avant de pouvoir push

2. **Status checks** : Les checks peuvent prendre quelques minutes. Attendez qu'ils passent avant de merger une PR

3. **Bypass** : Si "Do not allow bypassing" est coché, même les admins ne peuvent pas contourner les règles

4. **Validation optionnelle** : Le job `validate` peut échouer sans bloquer le déploiement (car `continue-on-error: true`). Vous pouvez le rendre obligatoire en modifiant le workflow si nécessaire

## 🔗 Liens utiles

- [Documentation GitHub - Branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Documentation GitHub - Required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)

## 📝 Checklist de configuration

- [ ] Aller dans Settings → Branches
- [ ] Créer une règle pour `main`
- [ ] Cocher "Do not allow force pushes"
- [ ] Cocher "Do not allow deletions"
- [ ] Cocher "Require status checks to pass before merging"
- [ ] Sélectionner `build` comme check requis
- [ ] Optionnel : sélectionner `validate` comme check requis
- [ ] Cocher "Do not allow bypassing the above settings"
- [ ] Sauvegarder les changements
- [ ] Vérifier que le badge "Protected" apparaît sur `main`

---

**Date de création** : 2025-12-09  
**Dernière mise à jour** : 2025-12-09

