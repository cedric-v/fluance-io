# Runbook leads/contact

## Que faire si un opt-in ne fonctionne pas

Verifier:

1. que le formulaire pointe vers `https://api.fluance.io/capture-lead`
2. que le `site_id` est correct
3. que le secret Turnstile du site est configure dans Firebase Functions
4. que `MAILJET_API_KEY`, `MAILJET_API_SECRET` et `MAILJET_LIST_ID` sont presents
5. que l'evenement apparait dans `journal_evenements_leads`

## Que faire si un formulaire contact ne fonctionne pas

Verifier:

1. que le formulaire pointe vers `https://api.fluance.io/send-contact-email`
2. que le secret Turnstile du site est configure
3. que l'evenement apparait dans `journal_formulaires_contact`
4. que Mailjet accepte les envois transactionnels depuis `support@actu.fluance.io`

## Relances DOI

Calendrier:

- relance 1: J+1
- relance 2: J+5
- expiration: J+7

La fonction scheduled actuelle:

- `sendOptInReminders`

## Collections Firestore utiles

- `journal_evenements_leads`
- `journal_formulaires_contact`
- `newsletterConfirmations`
- `journal_alertes_ops`
- `digest_ops_history`

## Pilotage quotidien

Email attendu:

- un digest quotidien envoye a `support@fluance.io`

Contenu attendu:

- opt-ins par blog
- confirmations DOI par blog
- DOI en attente
- relances DOI
- contacts recus
- erreurs critiques

## Alertes critiques

Emails d'alerte attendus seulement si:

- erreurs serveur repetees sur `captureLead` ou `sendContactEmail`
- echec Mailjet sur DOI, relance DOI ou email contact
- pic d'echecs Turnstile

Si une alerte arrive:

1. verifier `journal_evenements_leads`
2. verifier `journal_formulaires_contact`
3. verifier l'etat Mailjet si l'alerte concerne un envoi
4. verifier les logs Firebase Functions si l'alerte concerne une erreur serveur

## Cas particulier important

Si un visiteur soumet plusieurs fois le meme opt-in avant confirmation:

- on privilegie la reutilisation d'un token encore valide quand c'est possible
- sinon un nouveau token peut etre genere

## Regle de securite produit

Si un developpeur ajoute un nouveau formulaire:

- il doit choisir entre `capture-lead` et `send-contact-email`
- il ne doit jamais reutiliser `send-contact-email` pour du marketing
- il ne doit jamais reutiliser `capture-lead` pour du support
