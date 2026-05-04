# Architecture leads/contact Fluance

Date de reference: 2026-05-01

## Objet

Ce document decrit l'architecture cible pour:

- les opt-ins des blogs relies a Fluance
- les formulaires de contact des blogs
- la journalisation associee

## Perimetre

Blogs relies:

- `techniquesdemeditation.com`
- `vie-explosive.fr`
- `developpementpersonnel.org`

Alias technique encore pris en charge:

- `devperso.org`

## Topologie

- front public `fluance.io`: GitHub Pages
- API centralisee: `api.fluance.io`
- entree de domaine API: Firebase Hosting
- execution backend: Firebase Functions HTTP
- stockage marketing: Mailjet
- stockage applicatif / preuves / journaux: Firestore

## Endpoints

- `POST https://api.fluance.io/capture-lead`
- `POST https://api.fluance.io/send-contact-email`

Compatibilite conservee:

- `POST https://api.fluance.io/api/capture-lead`
- `POST https://api.fluance.io/api/send-contact-email`

## Flux opt-in

1. Le blog envoie un `POST` vers `capture-lead`
2. Verification Turnstile par site
3. Creation ou mise a jour du contact dans Mailjet
4. Ajout a la liste Mailjet unique Fluance
5. Mise a jour des proprietes Mailjet en statut `en_attente`
6. Creation ou reutilisation d'un token DOI dans Firestore
7. Envoi de l'email de confirmation via Mailjet
8. Journalisation de l'evenement dans Firestore

## Flux confirmation DOI

1. Le visiteur clique le lien dans l'email
2. Le lien ouvre `https://fluance.io/confirm?...`
3. La page appelle `confirmNewsletterOptIn`
4. Le token est verifie
5. Les proprietes Mailjet passent en statut `confirme` / `consenti`
6. La page redirige vers la ressource finale du blog source

## Flux formulaire contact

1. Le blog envoie un `POST` vers `send-contact-email`
2. Verification Turnstile par site
3. Envoi d'un email interne vers `support@fluance.io`
4. `reply-to` positionne sur l'expediteur
5. Journalisation complete dans Firestore

Important:

- un formulaire de contact ne doit jamais inscrire un contact dans la liste marketing

## Expéditeurs Mailjet

DOI / relances DOI / emails newsletter lies aux opt-ins:

- From: `fluance@actu.fluance.io`
- Name: `Cedric de Fluance`

Transactionnel contact:

- From: `support@actu.fluance.io`
- Name: `Support de Fluance`
- To interne: `support@fluance.io`

## Invariants a ne pas casser

- tous les opt-ins passent par double opt-in
- tous les contacts blogs vont vers `support@fluance.io`
- une seule liste Mailjet est utilisee
- la segmentation se fait par proprietes, pas par multiplication de listes
- les formulaires contact ne creent pas de contact marketing
- les blogs gardent leurs `redirect_url` actuels en phase 1

