# 🔒 Protection des données personnelles (RGPD) — Règles du dépôt

> Ce dépôt (`cedric-v/fluance-io`) est **public**. Tout ce qui y est poussé
> est visible par n'importe qui, indéfiniment (et reste récupérable dans
> l'historique Git même après suppression).

## ⛔ Interdit dans le dépôt (liste non exhaustive)

| Donnée | Exemples |
|---|---|
| **Données personnelles clients** (RGPD) | nom, prénom, email, téléphone, adresse, date d'achat, historique, identifiants |
| **Identifiants de compte** | UID Firebase, ID de paiement, numéro de commande |
| **Secrets / credentials** | tokens d'accès, clés API, clés privées, mots de passe, cookies d'admin |
| **Références à un client précis** | même dans les commentaires, messages de commit, noms de fichiers, exemples |

⚠️ **La PII inclut les noms de fichiers et les messages de commit** :
`fix-carla-pinto-access.js`, `INCIDENT_ACCES_CARLA_PINTO.md`, ou un commit
« accès client X » sont **déjà** une fuite RGPD.

## ✅ Ce qu'il faut faire à la place

### Scripts / outils d'administration
- **Paramétrer** l'email/token par **argument CLI** ou **variable d'environnement** :
  ```bash
  node scripts/fix-user-firestore.js "$EMAIL" 21jours
  EMAIL="$EMAIL" TOKEN="$TOKEN" node scripts/mon-script.js
  ```
- Utiliser les **secrets Firebase** (`firebase functions:secrets:set …`) pour
  les clés (Mailjet, Stripe…) — jamais de valeurs en dur dans le code.
- Conserver les valeurs sensibles dans un fichier **local gitignoré** (`.env`,
  `*-service-account.json`) — voir `.gitignore`.
- Anonymiser les **documents d'incident** : aucun nom, email, UID, référence de
  paiement. Les identifiants se trouvent via Firestore/le CRM, pas dans Git.

### Avant chaque commit
1. **Vérifier ce qui est stagé** : `git diff --cached` — aucun nom/email client, aucun secret.
2. **Hook pre-commit** (gitleaks) — à installer une fois par poste :
   ```bash
   pre-commit install
   # puis, en cas de doute :
   pre-commit run gitleaks --all-files
   ```
3. **CI** : le workflow `.github/workflows/gitleaks.yml` scanne chaque push et
   **bloque** en cas de nouvelle fuite.

## 🚨 En cas de fuite (procédure)

1. **Ne rien cacher** : la fuite reste dans l'historique tant qu'elle n'est pas purgée.
2. **Purger l'historique** (réécriture) puis **force-push** :
   ```bash
   git rebase -i <commit-avant-la-fuite>   # marquer le commit fautif « edit »
   # corriger/supprimer le fichier
   git add -A && git commit --amend --no-edit
   git rebase --continue
   git push --force-with-lease origin main
   ```
3. **Vérifier** qu'il ne reste rien d'atteignable :
   ```bash
   git grep -l "<email-ou-secret>" $(git rev-list --all) -- .   # doit être vide
   gitleaks git --log-opts="--all"                               # « no leaks found »
   ```
4. **Rendre le secret inerte** (rotation/révocation) même s'il est purgé :
   token marqué utilisé, clé régénérée, mot de passe changé.
5. **Si PII** : signaler l'incident (délai légal RGPD 72 h pour notifier l'autorité),
   informer la personne concernée.

## ⚠️ Piège connu : config Gitleaks

Une config `.gitleaks.toml` **sans les règles par défaut désactive toute la
détection** (0 fuite… parce que 0 règle). Toujours partir de la config officielle
`config/gitleaks.toml` (222 règles) et n'**ajouter** que l'allowlist des valeurs
publiques (clés web Firebase, sitekey Turnstile) et placeholders documentaires.
L'allowlist ne doit **jamais** contenir un secret réel — une vraie fuite se purge,
elle ne s'autorise pas.

## Checklist avant de pousser

- [ ] `git diff --cached` relu : aucune donnée personnelle ni secret
- [ ] Aucun nom/email client dans les noms de fichiers ni les messages de commit
- [ ] Valeurs sensibles passées en arguments / variables d'env / secrets Firebase
- [ ] `pre-commit` installé (`pre-commit install`) et vert
- [ ] `gitleaks git --log-opts="origin/main..HEAD"` → « no leaks found »
