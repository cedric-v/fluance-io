# Configuration DNS et domaine pour `api.fluance.io`

## Architecture retenue

- `fluance.io` reste sur GitHub Pages
- `api.fluance.io` pointe vers Firebase Hosting
- Firebase Hosting route ensuite vers les Functions HTTP
- les Functions, Firestore et secrets restent dans le meme projet Firebase que `fluance-io`

## Recommandation de structure

La bonne separation n'est pas de creer un second projet Firebase. La bonne separation est:

- un seul projet Firebase pour `fluance-io`
- un site Firebase Hosting dedie a l'API
- un custom domain `api.fluance.io` attache a ce site Hosting
- GitHub Pages conserve le front public `fluance.io`

Architecture cible:

- `fluance.io` -> GitHub Pages
- `api.fluance.io` -> Firebase Hosting site dedie API
- Firebase Hosting API -> rewrites vers les Functions HTTP
- Firestore / secrets / Mailjet / cron -> meme projet Firebase que le reste de Fluance

## Point de vigilance sur le projet Firebase

Dans ce repository, le fichier `.firebaserc` pointe actuellement vers le projet par defaut:

- `fluance-protected-content`

Si, dans la console Firebase, tu vois un projet affiche comme `fluance-website`, il faut distinguer:

- le nom affiche dans la console
- le `project id` reel utilise par la CLI

Avant toute commande, verifier le projet actif:

```bash
cd "/Users/cedric 1/Documents/coding/fluance-io"
firebase use
```

Si besoin, lister les projets accessibles:

```bash
firebase projects:list
```

Puis selectionner explicitement le bon projet:

```bash
firebase use <PROJECT_ID>
```

## Ce que le code prepare deja

Dans `firebase.json`, les routes suivantes existent:

- `/capture-lead` -> `captureLead`
- `/send-contact-email` -> `sendContactEmail`
- `/api/capture-lead` -> `captureLead`
- `/api/send-contact-email` -> `sendContactEmail`

## Creation du site Hosting dedie a l'API

Je recommande de creer un site Hosting dedie, par exemple:

- site id Firebase Hosting: `fluance-api`
- target local Firebase CLI: `api`

Commandes:

```bash
cd "/Users/cedric 1/Documents/coding/fluance-io"
firebase hosting:sites:create fluance-api
firebase target:apply hosting api fluance-api
```

Effet attendu:

- `fluance.io` continue a vivre sur GitHub Pages
- Firebase Hosting n'est utilise que pour `api.fluance.io`
- les futurs deploys deviennent explicites avec `hosting:api`

Une fois cela fait, `.firebaserc` contiendra une section `targets` similaire a:

```json
{
  "targets": {
    "<PROJECT_ID>": {
      "hosting": {
        "api": [
          "fluance-api"
        ]
      }
    }
  }
}
```

Le `PROJECT_ID` exact depend de ton projet Firebase reel.

## Ce qu'il faut faire manuellement dans Firebase

1. Verifier le bon projet Firebase avec `firebase use`
2. Creer le site Hosting dedie API si ce n'est pas deja fait
3. Ouvrir Firebase Hosting
4. Selectionner le site Hosting dedie API
5. Ajouter `api.fluance.io` comme custom domain
6. Laisser Firebase afficher les DNS records exacts requis

## Ce qu'il faut faire manuellement dans Cloudflare DNS

1. Ouvrir la zone DNS de `fluance.io`
2. Creer exactement les records demandes par Firebase
3. Pendant la verification initiale:
   - preferer `DNS only` si Firebase ne valide pas
4. Attendre la validation du domaine et le certificat TLS

## Important

- ne pas inventer une cible manuelle
- ne pas mettre un autre record concurrent sur `api`
- suivre strictement les valeurs affichees par Firebase Hosting

## Verification finale

Une fois DNS et certificat en place, tester:

- `https://api.fluance.io/capture-lead`
- `https://api.fluance.io/send-contact-email`

Les deux doivent repondre:

- `405 Method Not Allowed` en GET

Ce resultat est normal et montre que le routage arrive bien sur la Function.

## Commandes de deploiement recommandees

Pour eviter toute confusion avec GitHub Pages, je recommande de deployer explicitement:

```bash
cd "/Users/cedric 1/Documents/coding/fluance-io"
firebase deploy --only functions,hosting:api
```

Cela suppose que le target Hosting `api` a bien ete associe au site `fluance-api`.

Si tu veux verifier le routage Hosting avant un deploy complet:

```bash
firebase target
```

## Ce qu'il ne faut pas faire

- ne pas creer un second projet Firebase juste pour l'API
- ne pas utiliser le site Hosting Firebase pour le front `fluance.io` tant que GitHub Pages reste en place
- ne pas lancer un deploy Hosting ambigu sans target explicite si plusieurs usages coexistent
- ne pas creer de record DNS concurrent sur `api`
