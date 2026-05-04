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

## Cas particulier important

Si un visiteur soumet plusieurs fois le meme opt-in avant confirmation:

- on privilegie la reutilisation d'un token encore valide quand c'est possible
- sinon un nouveau token peut etre genere

## Regle de securite produit

Si un developpeur ajoute un nouveau formulaire:

- il doit choisir entre `capture-lead` et `send-contact-email`
- il ne doit jamais reutiliser `send-contact-email` pour du marketing
- il ne doit jamais reutiliser `capture-lead` pour du support

