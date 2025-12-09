# Générer les rapports de validation (Lighthouse et W3C)

Les rapports de validation (Google Lighthouse et W3C HTML Validator) sont maintenant **optionnels** et ne s'exécutent plus automatiquement à chaque déploiement.

## 🚀 Déclenchement manuel

### Via l'interface GitHub

1. Allez sur votre repository GitHub : `https://github.com/cedric-v/fluance-io`
2. Cliquez sur l'onglet **"Actions"**
3. Dans le menu de gauche, sélectionnez **"Deploy site to GitHub Pages"**
4. Cliquez sur le bouton **"Run workflow"** (en haut à droite)
5. Dans le formulaire qui s'affiche :
   - **Branch** : `main` (par défaut)
   - **Exécuter les rapports Lighthouse et W3C** : ✅ **Cochez cette case**
6. Cliquez sur **"Run workflow"**

Le workflow va :
- ✅ Builder le site
- ✅ Déployer sur GitHub Pages
- ✅ **Générer les rapports Lighthouse et W3C** (car vous avez coché la case)

### Résultat

Après l'exécution :
1. Allez dans l'onglet **"Actions"**
2. Cliquez sur le workflow qui vient de s'exécuter
3. Cliquez sur le job **"validate"**
4. Faites défiler jusqu'à la section **"Artifacts"** en bas de la page
5. Cliquez sur **"validation-reports"** pour télécharger le ZIP
6. Décompressez le fichier pour accéder aux rapports HTML

## 📊 Contenu des rapports

Le fichier ZIP contient :

### Google Lighthouse
- `lighthouse-home.html` - Rapport complet pour la page d'accueil
- `lighthouse-fr.html` - Rapport complet pour la page française
- `lighthouse-en.html` - Rapport complet pour la page anglaise (si disponible)
- `lighthouse-home.json` - Données JSON pour la page d'accueil
- `lighthouse-fr.json` - Données JSON pour la page française

### Validateur W3C
- `w3c/` - Dossier contenant les rapports de validation HTML
  - Un rapport HTML et JSON par page validée (jusqu'à 10 pages)

### Résumé
- `summary.md` - Guide pour utiliser les rapports

## ⚡ Avantages

- **Déploiements plus rapides** : Les validations ne ralentissent plus les déploiements automatiques
- **Contrôle total** : Vous choisissez quand générer les rapports
- **Économie de ressources** : Moins de consommation de minutes GitHub Actions

## 🔄 Comportement par défaut

- **Push automatique** : Seul le build et le déploiement s'exécutent (pas de validation)
- **Déclenchement manuel sans case cochée** : Même comportement (pas de validation)
- **Déclenchement manuel avec case cochée** : Build + déploiement + validation

## 💡 Recommandation

Générez les rapports de validation :
- ✅ Avant une mise en production importante
- ✅ Après des modifications majeures du site
- ✅ Mensuellement pour suivre les performances
- ✅ Lors de l'optimisation SEO

---

**Date de création** : 2025-12-09

