# Guide : Créer des comptes de démonstration

Ce guide explique comment créer des comptes de démonstration avec accès à **tous les produits** (`21jours`, `complet`, `sos-dos-cervicales`) et **tout le contenu débloqué**, sans recevoir les e-mails de nouveaux contenus.

## 📋 Prérequis

- Firebase CLI installé et connecté (`firebase login`)
- Node.js 22+
- Accès au compte de service Firebase (via `firebase login` ou `gcloud auth application-default-login`)

## 🚀 Créer un compte démo

Utilisez le script `scripts/create-demo-accounts.js` :

```bash
node scripts/create-demo-accounts.js <email1> <password1> <email2> <password2>
```

Exemple :
```bash
node scripts/create-demo-accounts.js "nathalie@oxadi.ch" "DemoFluance7#kL9" "Luc@oxadi.ch" "DemoFluance3#mN2"
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

## 📝 Comptes démo actuels

| Email | Mot de passe | Produits |
|-------|-------------|----------|
| nathalie@oxadi.ch | Voir 1Password / note sécurisée | 21jours, complet, sos-dos-cervicales |
| Luc@oxadi.ch | Voir 1Password / note sécurisée | 21jours, complet, sos-dos-cervicales |

## 🔗 Accès

- Espace membre : `https://fluance.io/membre/`
- Connexion : `https://fluance.io/connexion-membre/`

---

**Date de création** : 2025-07-02
