# Guide : Créer des comptes de démonstration

Ce guide explique comment créer des comptes de démonstration avec accès à **tous les produits** (`21jours`, `complet`, `sos-dos-cervicales`) et **tout le contenu débloqué**, sans recevoir les e-mails de nouveaux contenus.

## 📋 Prérequis

- Firebase CLI installé et connecté (`firebase login`)
- Node.js 24+
- Accès au compte de service Firebase (via `firebase login` ou `gcloud auth application-default-login`)

## 🚀 Créer un compte démo

Utilisez le script `scripts/create-demo-accounts.js` :

```bash
node scripts/create-demo-accounts.js <email1> <password1> [<email2> <password2> ...]
```

Exemple :
```bash
# Un compte
node scripts/create-demo-accounts.js "demo1@example.com" "DemoFluanceMonMdp1"

# Deux comptes
node scripts/create-demo-accounts.js "demo2@example.com" "DemoFluance7#kL9" "demo3@example.com" "DemoFluance3#mN2"
```

### Ce que fait le script

1. Crée les comptes **Firebase Auth** (email + mot de passe, email vérifié)
2. Crée les documents **Firestore** dans `users/{uid}` avec :
   - `products: ["21jours", "complet", "sos-dos-cervicales"]`
   - `startDate: 2024-01-01` (tout le contenu est débloqué)
   - `isDemo: true`

## 🔒 Pas d'e-mails de déblocage

La fonction `sendNewContentEmails` (`functions/index.js:6582`) ignore les utilisateurs avec `isDemo: true`.

Ils ne recevront aucun e-mail de :
- Nouveau contenu 21 jours
- Nouveau contenu Approche Complète
- Relance marketing post-21jours

Les autres e-mails transactionnels ne sont pas impactés.

## 🎟️ Simuler l'offre "Fluance Illimité" annuelle ou mensuelle

Les comptes démo possèdent le produit `complet` (Fluance Illimité), ce qui donne accès à
l'app PWA **Ma pratique** et à tous les contenus premium. Pour tester le **bonus annuel**
(formulaire « Une question ? Cédric vous répond » dans `/membre/`), il faut définir la
variante du produit `complet` :

```bash
# Bonus annuel (formulaire de question actif)
node scripts/set-complet-variant.js demo1@example.com ma_pratique_annuel

# Offre mensuelle (pas de bonus)
node scripts/set-complet-variant.js demo1@example.com ma_pratique_mensuel

# Retirer la variante
node scripts/set-complet-variant.js demo1@example.com --clear
```

La variante est stockée dans `users/{uid}.products[]` sur l'entrée `{ name: 'complet' }` et
vérifiée côté serveur par la callable `sendAnnualQuestion`. Voir `docs/ma-pratique.md`
(§ « Bonus annuel ») pour le détail.

> 💡 En local, sans `functions/serviceAccountKey.json`, lancer avec
> `GOOGLE_CLOUD_QUOTA_PROJECT=fluance-protected-content` (l'ADC gcloud exige un quota project).

## 📝 Comptes démo actuels

| Email | Mot de passe | Produits |
|-------|-------------|----------|
| demo1@example.com | Voir 1Password / note sécurisée | 21jours, complet, sos-dos-cervicales |
| demo2@example.com | Voir 1Password / note sécurisée | 21jours, complet, sos-dos-cervicales |
| demo3@example.com | Voir 1Password / note sécurisée | 21jours, complet, sos-dos-cervicales |

## 🔗 Accès

- Espace membre : `https://fluance.io/membre/`
- Connexion : `https://fluance.io/connexion-membre/`

---

**Date de création** : 2025-07-02
