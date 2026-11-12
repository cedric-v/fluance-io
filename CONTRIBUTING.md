# Contribuer à fluance.io

Ce document décrit le workflow attendu pour toute modification du dépôt.

## Règle d'or : pas de push direct sur `main`

La branche `main` est protégée par 4 checks requis : **build**, **smoke-test**,
**Gitleaks** et **functions**. `enforce_admins` étant désactivé, un push direct
sur `main` passe en contournant ces checks — c'est précisément ce qu'on veut
éviter.

Toute modification passe donc par **une branche + une pull request**.

## 1. Créer une branche

Depuis un `main` à jour :

```bash
git switch main
git pull
git switch -c type/sujet-court
```

Préfixes utilisés : `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `refactor/`,
`test/`, `perf/`.

Exemples : `fix/hero-21-jours-pixelise`, `docs/workflow-contribution`.

## 2. Convention de commits

[Conventional Commits](https://www.conventionalcommits.org/) :
`type(scope): description à l'impératif`, en français ou en anglais.

```text
feat(scripts): outil de réinitialisation de l'essai gratuit
fix(functions): corriger le compteur de participants
chore(deps): mettre à jour les dépendances
ci(security): épingler les outils exécutés en CI
```

Un commit = un changement cohérent.

## 3. Vérifications locales

Les hooks `pre-commit` (gitleaks, contrôle anti-données personnelles
`scripts/check-no-pii.sh`, résolution des `require()` dans `functions/`) et
`pre-push` (lint + tests si `functions/` est touché) s'exécutent
automatiquement. En complément :

```bash
npm run build
npm --prefix functions test
```

### Données personnelles (RGPD)

- Ne jamais committer d'e-mails, noms, téléphones ou exports Firestore de
  clients : ni dans le code, ni dans les tests, ni dans les docs.
- Un script de maintenance qui manipule des données de production prend les
  e-mails **en argument** (`node scripts/mon-script.js prenom.nom@example.com`),
  jamais en dur dans le fichier.
- Les sauvegardes générées vont dans `scripts/logs/` (gitignoré).
- Les service accounts et secrets ne sont jamais commités (variables
  d'environnement ou secrets GitHub).

## 4. Ouvrir la pull request

- Titre selon la même convention que les commits.
- Décrire le **quoi** et le **pourquoi**, et signaler les impacts éventuels
  (Firestore, Stripe, e-mails, SEO, déploiement).
- Attendre que les 4 checks requis (**build**, **smoke-test**, **Gitleaks**,
  **functions**) soient verts avant de merger.
- Merger via le bouton GitHub (« Merge pull request ») plutôt qu'en local, puis
  supprimer la branche.

## 5. Scripts de maintenance destructifs

Pour tout script qui supprime ou modifie des données de production :

- proposer un mode `--dry-run` ;
- demander une confirmation interactive, ou exiger un flag `--yes` ;
- écrire une sauvegarde JSON des documents supprimés avant l'opération ;
- vérifier l'effet attendu à la fin (par exemple relire l'état via le service
  applicatif concerné) ;
- documenter l'usage et les options en en-tête du fichier.
