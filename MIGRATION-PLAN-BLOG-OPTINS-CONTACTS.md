# Plan de migration des opt-ins et formulaires contact vers Fluance

Date: 2026-04-30

## 1. Objet

Ce document décrit un plan d'implementation detaille, sans execution de code, pour deplacer:

- les opt-ins des blogs `techniquesdemeditation`, `vie-explosive` et `devperso-org`
- la mecanique centralisee des formulaires de contact associes

du hub actuel `instant-academie/instant-academie-FR-2026/` vers l'ecosysteme `fluance-io`.

L'objectif est de:

- decoupler ces flux d'`instant-academie` avant sa revente
- basculer la gestion email sur le compte Mailjet de Fluance
- conserver ou ameliorer le niveau actuel de securite, de tracabilite et de conformite
- clarifier le lien marketing et humain entre les blogs historiques et la liste Fluance

## 2. Constats sur l'existant

### 2.1 Hub actuel cote Instant Academie

Dans `instant-academie/instant-academie-FR-2026/`:

- les opt-ins des blogs pointent vers `functions/api/capture-lead.js`
- les formulaires contact pointent vers `functions/api/send-contact-email.js`
- `capture-lead.js` gere:
  - CORS multi-domaines
  - verification Turnstile par site
  - honeypot
  - logique double opt-in
  - ecriture dans Mailjet
  - notification admin
- `send-contact-email.js` gere:
  - CORS multi-domaines
  - verification Turnstile par site
  - honeypot
  - filtrage anti-spam simple
  - envoi transactionnel via Resend

### 2.2 Cote blogs

Dans les trois blogs:

- `devperso-org`, `vie-explosive` et `techniquesdemeditation` postent encore vers `https://instant-academie.com/api/...`
- chaque formulaire transmet deja des metadonnees utiles:
  - `site_id`
  - `form-name`
  - `redirect_url`
  - parfois `optin_url`
- une partie de la logique UX est cote front:
  - redirection apres succes
  - message inline pour les contacts
  - message "verifiez votre boite mail" pour les opt-ins

### 2.3 Cote Fluance

Dans `fluance-io/`:

- le site public est statique sur GitHub Pages
- le backend existe deja sur Firebase Functions
- Fluance utilise deja Mailjet de facon importante
- une fonction `subscribeToNewsletter` existe deja, mais en `onCall` Firebase, donc peu adaptee comme hub inter-sites externe
- la page `/contact/` actuelle de Fluance ne contient pas de formulaire, seulement des coordonnees

Conclusion importante:

- le bon modele n'est pas de "porter tel quel" les Functions Cloudflare vers le site statique Fluance
- il faut creer une couche backend dediee sur Firebase, exposee via une URL API stable, independante de GitHub Pages

## 3. Recommendation d'architecture

### 3.1 Recommendation principale

Mettre en place un **Lead Gateway Fluance** sur Firebase Functions, expose via un sous-domaine dedie:

- `https://api.fluance.io/capture-lead`
- `https://api.fluance.io/send-contact-email`
- `https://api.fluance.io/confirm-subscription`
- eventuellement `https://api.fluance.io/get-contact-info` pour l'administration

### 3.2 Pourquoi un sous-domaine API dedie

Je recommande `api.fluance.io` plutot que `fluance.io/api/*` pour 4 raisons:

- `fluance.io` est servi par GitHub Pages, qui n'est pas adapte pour router proprement des endpoints serveur
- cela evite d'ajouter une surcouche de proxy au site public
- l'API devient independante du mode d'hebergement du front
- on garde une separation nette entre site marketing et backend de collecte

### 3.3 Option a eviter sauf besoin fort

Eviter pour cette migration:

- une dependance a Firebase `httpsCallable` pour les blogs
- un mix API partiellement sur GitHub Pages et partiellement sur Firebase
- une logique de collecte directement dans chaque blog

Ces options augmentent le couplage, le risque de divergence et la maintenance.

## 4. Recommendation email: Mailjet vs Resend

### 4.1 Recommendation pragmatique

Pour cette migration, je recommande:

- **Mailjet comme systeme principal unique** pour les opt-ins
- **Mailjet aussi pour les emails de notification de contact**, au moins dans un premier temps

### 4.2 Raisons

- Fluance s'appuie deja fortement sur Mailjet
- les listes, proprietes, segments et automatisations y existent deja
- cela evite d'introduire un deuxieme fournisseur pendant une migration sensible
- la separation juridique et operationnelle avec Instant Academie sera plus claire si tout passe sur les credentials Fluance

### 4.3 Quand garder ou ajouter Resend

Resend n'est pertinent que si vous voulez specifiquement:

- une couche transactionnelle distincte de Mailjet
- une meilleure ergonomie pour certains emails applicatifs
- une separation stricte entre marketing et transactionnel

Dans ce cas, ma recommandation n'est pas de reutiliser un compte lie a Instant Academie, mais de creer **un compte Resend propre a Fluance** avec ses propres domaines et DNS.

### 4.4 Decision recommandee

Pour la migration immediate:

- **phase 1**: tout passer sur Mailjet Fluance
- **phase 2 eventuelle**: reevaluer Resend apres stabilisation, uniquement si un vrai besoin apparait

## 5. Cible fonctionnelle

Le futur hub Fluance doit couvrir:

- opt-ins newsletter / lead magnets des 3 blogs
- double opt-in
- gestion des contacts deja connus
- envoi du lien de confirmation ou du lien de ressource
- formulaires de contact
- notifications admin
- journalisation des evenements critiques
- segmentation par blog et par type de formulaire

## 6. Principes de conception

### 6.1 Decouplage

Le hub Fluance ne doit dependra:

- ni du domaine `instant-academie.com`
- ni de credentials ou listes Mailjet Instant Academie
- ni d'un hebergement Cloudflare Pages

### 6.2 Compatibilite de transition

La migration doit permettre:

- de brancher blog par blog
- de tester endpoint par endpoint
- de revenir temporairement en arriere si necessaire

### 6.3 Observabilite

Chaque soumission doit etre tracable avec:

- horodatage
- type de flux
- site source
- origine HTTP
- resultat Turnstile
- statut Mailjet
- statut email transactionnel

### 6.4 Conformite

Il faut garder une preuve exploitable de:

- consentement
- date d'opt-in
- source exacte
- page d'origine
- etat de confirmation

## 7. Architecture cible detaillee

### 7.1 Backend

Creer dans `fluance-io/functions/` un module dedie au hub de leads avec:

- endpoints HTTP `onRequest`
- services reutilisables
- configuration centralisee par domaine/site

Structure recommandee:

- `functions/http/captureLead.js`
- `functions/http/sendContactEmail.js`
- `functions/http/confirmSubscription.js`
- `functions/services/mailjetLeadService.js`
- `functions/services/contactNotificationService.js`
- `functions/services/turnstileService.js`
- `functions/config/leadSites.js`

But:

- eviter d'enfler davantage `functions/index.js`
- isoler clairement le backend des blogs du reste de Fluance

### 7.2 Configuration par site

Centraliser une table de config par site avec:

- `siteId`
- domaines autorises
- secret Turnstile associe
- nom marketing du site
- destinataire contact
- langue par defaut
- pages de redirection
- type de lead magnet principal

Exemples:

- `devperso`
- `vie-explosive`
- `techniquesdemeditation`
- `fluance`

### 7.3 Stockage

Utiliser Mailjet comme source marketing principale, mais ajouter Firestore comme journal applicatif.

Collections recommandees:

- `leadEvents`
- `newsletterConfirmations`
- `contactSubmissions`

Raison:

- Mailjet est bon pour le marketing, moins pour l'audit applicatif fin
- Firestore donne de la visibilite sur les erreurs, doublons, expirations, relances et confirmations

### 7.4 Domaine et routage

Configurer:

- `api.fluance.io` vers Firebase Hosting ou vers un point d'entree HTTP Firebase approprie
- rewrites Firebase vers les Functions HTTP

Le site public `fluance.io` reste sur GitHub Pages.

## 8. Evolution fonctionnelle recommandee

### 8.1 Opt-ins

Refondre `capture-lead` cote Fluance autour des cas suivants:

- nouveau contact inconnu
- contact deja connu mais non confirme
- contact deja confirme
- contact deja client Fluance

Comportement recommande:

- **nouveau contact**: creation Mailjet + log Firestore + DOI email + notification admin
- **deja connu non confirme**: nouveau token ou re-emission contrôlee + log
- **deja confirme**: ne pas renvoyer un DOI inutile; envoyer l'acces promis ou rediriger proprement
- **deja client**: conserver une experience sobre, sans le traiter comme un prospect standard

### 8.2 Formulaires de contact

Creer un endpoint Fluance dedie qui:

- valide les champs
- applique anti-spam et Turnstile
- envoie une notification email
- journalise la soumission
- retourne une reponse JSON propre pour les blogs

Je recommande que la destination primaire soit une boite Fluance du type:

- `support@fluance.io`
- ou `support@actu.fluance.io`

avec `reply-to` positionne sur l'email de l'expediteur.

### 8.3 Confirmation et delivrabilite

Conserver ou ameliorer:

- email de confirmation sobre
- lien de confirmation signe ou tokenise
- expiration du token
- relance automatique si non confirme apres un delai defini

## 9. Plan d'implementation par phases

### Phase 0 - Cadrage et gouvernance

Objectif:

- figer les decisions structurantes avant toute modif

Actions:

- valider le choix `api.fluance.io`
- valider l'usage de Mailjet Fluance comme base unique
- choisir la ou les boites de reception contact Fluance
- definir les labels et proprietes Mailjet cibles
- definir la promesse marketing affichee sur chaque blog

Livrables:

- mapping des domaines
- mapping des formulaires
- mapping des proprietes Mailjet
- wording legal et marketing

### Phase 1 - Preparation infrastructure

Objectif:

- rendre Fluance capable d'heberger le hub sans brancher encore les blogs

Actions:

- configurer le sous-domaine `api.fluance.io`
- preparer les secrets Firebase:
  - Mailjet
  - Turnstile par site
  - emails admin
- definir les rewrites Firebase
- preparer les templates email Fluance pour DOI et contacts

Bonnes pratiques:

- secrets separes par environnement
- pas de secret en dur
- domaine d'envoi authentifie SPF/DKIM/DMARC

### Phase 2 - Construction du backend commun

Objectif:

- recreer la mecanique centralisee cote Fluance

Actions:

- implementer `capture-lead` version Fluance en HTTP
- implementer `send-contact-email` version Fluance en HTTP
- implementer `confirm-subscription`
- factoriser la logique Mailjet / Turnstile / logging
- ajouter une structure d'erreurs stable et exploitable

Bonnes pratiques:

- conserver la compatibilite `FormData`
- reponses JSON coherentes
- idempotence raisonnable sur les resoumissions
- ne pas lier les endpoints a l'UI Fluance

### Phase 3 - Adaptation du modele de donnees Mailjet

Objectif:

- garantir une segmentation propre apres bascule

Proprietes recommandees ou a confirmer:

- `source_site`
- `source_form`
- `source_url`
- `lead_magnet`
- `lead_origin_brand`
- `consent_status`
- `consent_date`
- `double_optin_status`
- `double_optin_confirmed_at`
- `contact_type`
- `language`

Recommendation:

- distinguer clairement la **marque de collecte** et la **marque de destination**

Exemple:

- `source_site = devperso`
- `lead_origin_brand = DevPerso`
- `list_destination_brand = Fluance`

### Phase 4 - Migration des blogs

Objectif:

- rebrancher les 3 blogs un par un

Ordre recommande:

1. `techniquesdemeditation`
2. `vie-explosive`
3. `devperso-org`

Raison:

- commencer par le perimetre probablement le plus simple
- garder `devperso` pour la fin si vous voulez affiner le discours de marque

Actions par blog:

- remplacer l'URL des actions de formulaires
- ajuster si besoin les messages de succes
- mettre a jour les liens vers politique de confidentialite / mentions legales
- verifier les `site_id`, `redirect_url`, `form-name`
- retester opt-ins + contact + DOI + redirections

### Phase 5 - Double run et verification

Objectif:

- reduire le risque au moment du switch

Approche recommandee:

- bascule blog par blog
- verification des logs Firebase
- verification des contacts crees dans Mailjet
- verification de la reception des emails
- verification du lien de confirmation et de l'acces aux ressources

### Phase 6 - Nettoyage post-migration

Objectif:

- supprimer la dependance residuelle a Instant Academie

Actions:

- retirer des blogs tous les endpoints `instant-academie.com/api/*`
- retirer les mentions legales qui renvoient inutilement vers Instant Academie
- archiver la documentation de migration
- documenter le runbook Fluance

## 10. Strategie de migration recommandee

### 10.1 Pas de big bang

Je recommande explicitement de ne pas faire une bascule globale en une fois.

Faire:

- un backend Fluance pret
- un premier blog pilote
- correction des angles morts
- puis deploiement progressif

### 10.2 Compatibilite temporaire

Pendant la transition, prevoir:

- des endpoints Fluance testes en preproduction ou sur domaine dedie
- une possibilite de rollback simple par remise de l'URL de formulaire precedente

### 10.3 Ne pas migrer l'historique en urgence

Pour les anciens contacts:

- ne pas lancer une grande migration historique avant la stabilisation du nouveau flux
- d'abord migrer les **nouveaux flux entrants**
- ensuite seulement traiter, si utile, la question des historiques, tags et reconsolidations

## 11. Securite et anti-spam

Le nouveau hub doit reprendre au minimum:

- CORS strict par domaine
- Turnstile par site
- honeypot
- rate limiting si possible
- sanitisation des champs
- filtrage des messages abusifs
- logs d'erreurs exploitables

Recommendation supplementaire:

- ajouter un rate limiting par IP et par email sur les endpoints HTTP
- ajouter un plafond de taille de message
- normaliser les emails en lowercase trim

## 12. Observabilite, tests et runbook

### 12.1 Tests a prevoir

- opt-in simple par blog
- contact form par blog
- DOI pour nouveau contact
- resoumission d'un contact deja confirme
- echec Turnstile
- soumission bot honeypot
- erreur Mailjet
- redirection correcte apres succes

### 12.2 Journalisation

Chaque evenement important doit produire:

- `requestId`
- `siteId`
- `formName`
- `emailHash` ou email selon votre niveau de journalisation
- `outcome`
- `providerStatus`

### 12.3 Runbook

Documenter ensuite:

- comment changer un domaine autorise
- comment changer un destinataire contact
- comment relancer un DOI
- comment verifier un lead dans Mailjet
- comment diagnostiquer un echec Turnstile

## 13. Impacts juridiques et conformite

### 13.1 Mentions et politique de confidentialite

Les blogs ne doivent plus renvoyer par defaut vers la politique d'Instant Academie si le responsable / la base de traitement bascule vers Fluance.

Il faudra mettre a jour:

- mentions legales
- politique de confidentialite
- formulation de consentement
- identite du responsable de traitement ou sous-traitants

### 13.2 Consentement clair

Le formulaire ne doit pas laisser entendre:

- que la personne s'inscrit a une newsletter de blog "autonome"

si en realite:

- elle entre dans l'ecosysteme editorial Fluance

Le lien doit etre explicite, pas cache.

## 14. Recommendation marketing et humaine

### 14.1 Principe central

La bonne pratique n'est pas de "deverser" silencieusement les listes blogs dans Fluance.

Il faut plutot formuler:

- une **continuite editoriale**
- un **elargissement de l'accompagnement**
- et une **promesse claire sur ce qui sera recu**

### 14.2 Positionnement recommande

Je recommande une formule du type:

- les blogs restent des portes d'entree thematiques
- Fluance devient la maison relationnelle commune
- chaque opt-in explique que la suite de la relation email est geree par Fluance

### 14.3 Message concret a afficher sur les opt-ins

Exemple de base:

"En vous inscrivant, vous recevrez la ressource demandee ainsi que des emails de la part de Fluance, en lien avec les themes de ce site: meditation, corps, conscience, equilibre interieur et evolution personnelle."

Version plus douce:

"Ce blog fait partie de l'ecosysteme editorial relie a Fluance. Votre inscription vous permet de recevoir la ressource demandee puis des messages selectionnes, utiles et peu frequents, envoyes par Fluance."

### 14.4 Message concret a afficher apres inscription

Exemple:

"Vous allez recevoir un email de confirmation. Ensuite, vos prochains messages seront envoyes via Fluance, qui centralise des contenus et ressources issus de ce blog et d'autres approches complementaires."

### 14.5 Message concret dans l'email DOI

L'email de confirmation doit expliciter:

- la ressource immediate
- la marque d'envoi
- le lien avec le blog d'origine

Exemple:

"Vous vous etes inscrit depuis Techniques de Meditation. Fluance gere l'envoi de cette ressource et des prochains emails associes. Confirmez votre adresse pour recevoir votre acces."

### 14.6 Segmenter la suite relationnelle

Ne pas envoyer la meme suite a tout le monde.

Recommendation:

- conserver une entree par blog
- segmenter les sequences selon l'intention initiale

Exemples:

- `techniquesdemeditation` -> angle meditation, attention, conscience
- `vie-explosive` -> angle elan, changement, energie, passage a l'action
- `devperso` -> angle clarte, croissance, psychologie, transformation

Puis seulement ensuite:

- introduire Fluance comme cadre plus large

### 14.7 Sequence de bienvenue recommandee

Je recommande une sequence en 4 temps:

1. Email 1: livraison stricte de la ressource promise
2. Email 2: rappel de la promesse editoriale et de qui ecrit
3. Email 3: pont entre le theme du blog et l'approche Fluance
4. Email 4: invitation douce vers une page Fluance pertinente

### 14.8 Page de transition recommandee

Creer sur Fluance une page du type:

- `/ecosysteme`
- ou `/a-propos-des-blogs`

Qui explique:

- le lien entre les blogs historiques et Fluance
- pourquoi la relation email est centralisee
- ce que les abonnes peuvent attendre
- comment se desinscrire ou gerer leurs preferences

### 14.9 Preference center a moyen terme

Bonne pratique forte a moyen terme:

- permettre aux abonnes de choisir leurs centres d'interet

Exemples:

- meditation
- corps et mouvement
- conscience et vie interieure
- developpement personnel
- actualites et offres

Ainsi, la centralisation devient percue comme un service, pas comme une capture opaque.

## 15. Recommandation finale de mise en oeuvre

### Decision que je recommande

1. Utiliser `fluance-io` comme nouveau hub central
2. Exposer ce hub via `api.fluance.io`
3. Refaire les endpoints en Firebase HTTP, pas en callable
4. Unifier sur Mailjet Fluance pour cette migration
5. Ajouter Firestore comme journal des evenements et confirmations
6. Migrer blog par blog, pas en une fois
7. Rendre explicite dans les formulaires et emails que l'inscription est geree par Fluance

### Point de vigilance principal

Le vrai sujet n'est pas seulement technique. C'est surtout:

- la clarte du consentement
- la coherence de marque
- et la perception de la transition par les abonnes

Si la bascule est explicite, sobre et utile, elle sera defendable juridiquement et plus saine commercialement.

## 16. Recommendation d'hebergement moyen terme pour Fluance

### Recommendation courte

Je recommande a moyen terme:

- **garder le repository Git de Fluance sur GitHub**
- **mais deployer le site public via Cloudflare Pages plutot que GitHub Pages**

### Pourquoi je recommande Cloudflare Pages

Pour le cas Fluance, Cloudflare Pages apporte plusieurs avantages concrets:

- meilleur controle des redirects et headers
- integration plus naturelle avec des endpoints edge ou des proxys HTTP
- previsualisations de branches plus simples
- capacite a remettre plus tard des routes `api/*` ou un proxy `fluance.io -> Firebase` sans bricolage lourd
- meilleure marge de manoeuvre si vous voulez reunifier un jour front statique et couche API sous le meme domaine

### Pourquoi GitHub reste le bon endroit pour le repo

Je ne vois pas de raison de sortir le code de GitHub:

- GitHub reste un excellent systeme source-of-truth
- l'integration CI/CD est simple
- vous gardez vos habitudes de versioning et de revue
- Cloudflare Pages se branche tres bien sur un repo GitHub

### Pourquoi GitHub Pages devient limitant

GitHub Pages reste correct pour un site purement statique, mais il devient vite limitant si vous voulez:

- attacher des headers specifiques
- gerer des rewrites fines
- exposer une couche edge
- proxifier proprement une API externe
- faire evoluer le site vers une architecture plus unifiee

Dans votre cas, ces limites sont deja visibles car `fluance.io` est statique sur GitHub Pages alors que le backend vit ailleurs.

### Recommendation pragmatique

Je ne recommande pas de faire de ce changement un prerequis a la migration des opt-ins.

Ordre recommande:

1. migrer d'abord le hub leads/contact vers Fluance via Firebase + `api.fluance.io`
2. stabiliser les flux
3. ensuite seulement evaluer la bascule du front public `fluance.io` de GitHub Pages vers Cloudflare Pages

### Verdict

- **court terme**: GitHub Pages peut rester en place
- **moyen terme**: Cloudflare Pages est le meilleur choix si vous voulez plus de souplesse d'hebergement et une meilleure cohesion entre front public et architecture API

## 17. Perimetre d'implementation futur

Quand vous validerez ce plan, l'implementation devra probablement couvrir:

- backend Fluance des endpoints HTTP
- DNS / routage `api.fluance.io`
- adaptation des trois blogs
- mise a jour des formulaires et des messages
- mise a jour des mentions / politique
- tests de bout en bout
- documentation d'exploitation

## 18. Questions a trancher avant implementation

- Voulez-vous que les formulaires contact des blogs envoient vers une seule boite Fluance, ou une destination differente par blog?
- Voulez-vous garder les pages de remerciement actuelles de chaque blog, ou en profiter pour les refaire?
- Voulez-vous une promesse email uniforme entre les blogs, ou un wording adapte par blog?
- Voulez-vous un centre de preferences des la phase 1, ou plus tard?
- Voulez-vous introduire Resend plus tard pour les emails transactionnels, ou viser une stabilite 100% Mailjet?

## 19. Decisions deja prises apres revue

### 19.1 Boite de destination pour les contacts

Decision:

- tous les formulaires contact des blogs enverront vers une seule boite: `support@fluance.io`

Implication:

- l'endpoint contact Fluance doit envoyer un email transactionnel a `support@fluance.io`
- avec `reply-to` positionne sur l'email du visiteur
- sans inscription du contact dans la liste email marketing
- sans copie cachee vers une autre boite

### 19.2 Email marketing

Decision:

- promesse email adaptee par blog

Implication:

- les textes de consentement, pages de confirmation et emails DOI doivent mentionner Fluance
- mais avec un angle editorial specifique a chaque blog

### 19.3 Fournisseur email

Decision:

- viser une stabilite `100% Mailjet`

Implication:

- les opt-ins utiliseront Mailjet + proprietes + listes + DOI
- les emails transactionnels de contact utiliseront egalement Mailjet
- mais les formulaires contact ne doivent pas creer ou enrichir la liste marketing

### 19.4 Hebergement du front Fluance

Decision:

- garder GitHub Pages pour le moment

Implication:

- la migration ne doit pas dependre d'une bascule immediate du front public
- `api.fluance.io` doit etre pense comme une couche separee

### 19.5 Domaine API et environnements

Decision:

- domaine de production confirme: `api.fluance.io`
- pas d'environnement de preproduction dedie pour cette migration

Implication:

- il faudra etre rigoureux sur la sequence de deploiement et les tests avant bascule
- la compatibilite de transition doit etre geree directement dans la strategie de migration

### 19.6 UX actuelle des blogs

Decision:

- conserver pour le moment l'UX actuelle des blogs
- conserver les `redirect_url` actuels
- conserver les pages de succes / messages inline actuels

Implication:

- l'implementation doit rester compatible avec les comportements front deja en place

### 19.7 Lead magnets et destinations

Decision:

- conserver les lead magnets, promesses immediates et URLs de destination actuels a l'identique en phase 1

Implication:

- l'implementation doit surtout changer l'infrastructure et le wording relationnel, pas l'offre immediate

### 19.8 Double opt-in et consentement

Decision:

- meme pour les contacts deja connus, conserver un email de confirmation avant tout acces
- objectif explicite: garantir le double opt-in et la tracabilite du consentement RGPD

Implication:

- pas d'acces direct a la ressource sans confirmation
- il faut une gestion propre des re-inscriptions et des reconfirmations

### 19.9 Relance des DOI non confirmes

Decision:

- oui, prevoir des relances automatiques des double opt-in non confirmes

Implication:

- il faut journaliser la creation du DOI, son statut, sa ou ses relances et son expiration
- le delai exact de relance reste a fixer avant implementation

### 19.10 Journalisation

Decision:

- oui, journal complet de tout ce qui est pertinent, dans le respect des bonnes pratiques et du RGPD

Implication:

- le systeme doit journaliser les opt-ins, confirmations, relances DOI, soumissions contact, echecs provider, erreurs de securite et evenements critiques
- la journalisation doit etre utile aux humains et lisible par une IA de maintenance ou d'audit

### 19.11 Mailjet

Decision:

- une seule liste Mailjet existante, segmentee par proprietes
- noms de proprietes en francais

Implication:

- il faut definir une convention de nommage francaise, stable et documentee

### 19.12 Turnstile

Decision:

- garder la configuration actuelle, avec secret par site

Implication:

- la couche API Fluance doit etre compatible avec les `site_id` existants et les widgets deja deploies

### 19.13 Juridique

Decision:

- mettre a jour aussi les mentions legales / politique de confidentialite des trois blogs dans cette implementation

Implication:

- ce perimetre fait partie de la migration, il n'est pas reporte a plus tard

### 19.14 Preference center

Decision:

- pas active en phase 1
- mais preparer le terrain pour pouvoir l'ajouter plus tard

Implication:

- il faut penser les proprietes et la documentation pour qu'un centre de preferences puisse etre branche sans refonte lourde

### 19.15 DOI, expiration et relances

Decision:

- expiration du lien DOI: `7 jours`
- relances DOI: `24h` puis `5 jours`

Recommendation retenue:

- plusieurs relances ne sont utiles que si elles restent sobres
- pour la phase 1, la bonne configuration est:
  - relance 1 a `J+1`
  - relance 2 a `J+5`
  - expiration definitive a `J+7`

Implication:

- la logique de relance doit eviter les envois multiples inutiles
- chaque relance doit etre journalisee

### 19.16 Expediteur email

Decision:

- adresse expediteur pour DOI / newsletter: `fluance@actu.fluance.io`
- nom expediteur pour DOI / newsletter: `Cedric de Fluance`
- adresse expediteur pour transactionnel contact: `support@actu.fluance.io`
- nom expediteur pour transactionnel contact: `Support de Fluance`

Recommendation:

- c'est une bonne pratique si ces adresses sont deja utilisees, reputees et correctement authentifiees
- il faut garder une coherence forte entre:
  - From
  - Reply-To
  - domaine DKIM/SPF/DMARC

Point d'attention:

- pour les formulaires contact, l'email interne ira vers `support@fluance.io`
- l'expediteur technique de l'email de contact reste `support@actu.fluance.io` avec `reply-to` sur le visiteur
- les emails DOI et relances DOI partent depuis `fluance@actu.fluance.io`

### 19.17 Contact forms

Decision:

- pas d'accuse de reception automatique au visiteur en phase 1
- uniquement l'email interne vers `support@fluance.io`

Implication:

- flux plus simple
- moins de risques de bruit ou de confusion

### 19.18 Politique de confidentialite

Decision:

- suivre la recommandation de centraliser la politique cote Fluance

Implementation recommandee:

- une politique centralisee Fluance
- des mentions et liens adaptes sur chaque blog
- des formulations locales minimales quand necessaire

### 19.19 Domaines

Decision:

- domaines vivants a traiter:
  - `techniquesdemeditation.com`
  - `vie-explosive.fr`
  - `developpementpersonnel.org`
- `devperso.org` est traite comme alias

### 19.20 Identifiants techniques

Decision:

- conserver les `site_id` actuels:
  - `techniquesdemeditation`
  - `vie-explosive`
  - `devperso`

### 19.21 Retention et stockage

Decision:

- suivre mes recommandations initiales

Recommendation retenue:

- stocker le message complet des formulaires contact dans Firestore
- avec retention documentee et acces limite
- retention cible:
  - `confirmations DOI`: `24 mois`
  - `journaux contact`: `24 mois`
  - `journaux techniques detailles`: duree plus courte, recommandee `90 jours` a `180 jours` selon volume et utilite

Justification:

- le message complet est utile pour l'exploitation, le support et l'audit
- mais il faut encadrer sa retention et son acces

## 20. Recommandation sur les pages de remerciement

### Conseil

Je recommande:

- **phase 1**: conserver les pages de remerciement actuelles pour limiter le risque
- **phase 2**: les refaire ensuite de maniere intentionnelle

### Pourquoi

Changer en meme temps:

- l'infrastructure
- les endpoints
- le routage
- les messages de consentement
- et les pages de remerciement

augmente inutilement le risque.

### Ce que je conseille concretement

Pour l'implementation initiale:

- garder les URLs actuelles de redirection
- ajuster seulement le wording minimal pour mentionner Fluance quand c'est necessaire

Puis, apres stabilisation:

- refaire les pages de remerciement en les transformant en vraies pages de transition relationnelle

Objectif des futures pages:

- rassurer
- expliquer le DOI
- expliciter le lien entre le blog et Fluance
- suggerer une action simple
- reduire les pertes entre opt-in et confirmation

## 21. Ce que j'entends par "centre de preferences"

Un centre de preferences est une page ou un bloc qui permet a un abonne de choisir:

- les themes qui l'interessent
- la langue
- le type de messages qu'il souhaite recevoir
- voire la frequence

Exemple simple:

- meditation
- developpement personnel
- corps et mouvement
- conscience / vie interieure
- actualites Fluance

### Pourquoi c'est utile

Quand plusieurs blogs alimentent une meme infrastructure email:

- cela rend la centralisation plus transparente
- cela reduit le risque de desabonnement total
- cela permet un marketing plus propre et plus humain

### Ma recommandation

Je **ne recommande pas** un centre de preferences en phase 1.

Je recommande:

- phase 1: pas de centre de preferences, mais une segmentation propre par blog source
- phase 2: centre de preferences leger, une fois la migration stable

Preparation minimale a faire des la phase 1:

- une propriete `source_blog`
- une propriete `interets_declares` ou reserve equivalente
- une documentation claire de ce qui pourra devenir pilotable par l'abonne plus tard

## 22. Configuration recommandee de `api.fluance.io` sur Cloudflare

### Architecture recommandee

Puisque `fluance.io` reste sur GitHub Pages pour le moment, je recommande:

- un site Firebase Hosting dedie pour l'API
- une association du sous-domaine `api.fluance.io` a ce site Firebase Hosting
- des rewrites Firebase Hosting vers les Firebase Functions HTTP

Schema:

- `api.fluance.io` -> Firebase Hosting
- Firebase Hosting -> rewrites vers `captureLead`, `sendContactEmail`, `confirmSubscription`

### Pourquoi passer par Firebase Hosting pour l'API

Cela permet:

- un domaine propre et stable
- HTTPS gere par Firebase
- un point d'entree unique
- des routes plus lisibles que les URLs natives Cloud Functions

### Etapes de configuration

1. Dans Firebase:
   - creer ou reutiliser un site Hosting dedie a l'API
   - ajouter des rewrites vers les fonctions HTTP
   - declarer `api.fluance.io` comme custom domain dans Firebase Hosting

2. Dans Cloudflare DNS:
   - ajouter les enregistrements demandes exactement par l'assistant Firebase
   - ne pas improviser de cible manuelle si Firebase fournit des records precis
   - laisser le proxy Cloudflare desactive pendant la phase de verification si Firebase l'exige ou si la validation coince

3. Dans Firebase:
   - verifier la propriete du domaine
   - attendre le provisioning TLS
   - tester les routes API en HTTPS

### Sequence concrete recommandee

1. Deployer d'abord les fonctions HTTP sur Firebase
2. Configurer un site Firebase Hosting dedie a l'API avec les rewrites
3. Ajouter `api.fluance.io` dans Firebase Hosting
4. Recuperer dans l'assistant Firebase les DNS records exacts demandes
5. Creer ces records dans Cloudflare DNS
6. En cas de doute pendant la verification, laisser les records en `DNS only`
7. Attendre l'emission du certificat
8. Verifier:
   - `https://api.fluance.io/capture-lead`
   - `https://api.fluance.io/send-contact-email`
   - `https://api.fluance.io/confirm-subscription`
9. Basculer ensuite les blogs un par un

### Points d'attention Cloudflare

Bonnes pratiques:

- suivre exactement les records demandes par Firebase Hosting pour le custom domain
- si Firebase demande un `CNAME` ou des `A records`, utiliser ces valeurs exactes
- si la verification echoue, passer temporairement le record en `DNS only`
- ne pas ajouter de record concurrent sur `api.fluance.io`

### Option a eviter

Je ne recommande pas en phase 1:

- un Worker Cloudflare qui proxy manuellement vers des URLs Firebase Functions

Cela ajoute une couche supplementaire alors qu'un custom domain Firebase Hosting suffit generalement.

## 23. Convention de donnees et journalisation recommandees

### 23.1 Proprietes Mailjet recommandees

Convention:

- noms en francais
- snake_case
- valeurs normalisees

Proprietes minimales recommandees:

- `site_source`
- `blog_source`
- `formulaire_source`
- `url_source`
- `type_optin`
- `statut_consentement`
- `date_consentement`
- `statut_double_optin`
- `date_double_optin`
- `langue_source`
- `lead_magnet_source`
- `prenom`

Proprietes de preparation future:

- `interets_declares`
- `frequence_souhaitee`

Nomenclature finale recommandee pour la phase 1:

- `site_source`
- `blog_source`
- `formulaire_source`
- `url_source`
- `type_optin`
- `statut_consentement`
- `date_consentement`
- `statut_double_optin`
- `date_double_optin`
- `date_derniere_relance_doi`
- `nombre_relances_doi`
- `langue_source`
- `lead_magnet_source`
- `prenom`
- `interets_declares`

### 23.2 Collections Firestore recommandees

- `journal_evenements_leads`
- `journal_formulaires_contact`
- `confirmations_double_optin`
- `journal_traitements_email`

### 23.3 Principes RGPD de journalisation

Journaliser seulement ce qui est utile et justifiable:

- horodatage
- site source
- formulaire
- etat du traitement
- identifiants techniques utiles
- email si necessaire a l'operation

Eviter de journaliser inutilement:

- des contenus excessifs
- des donnees superflues
- des messages en clair au-dela de ce qui est utile

Bonne pratique:

- definir une retention explicite pour les logs applicatifs
- separer les journaux marketing des journaux purement techniques
- documenter qui a acces a quoi

## 24. Documentation a produire pour les humains et pour l'IA

### 24.1 Objectif

Documenter non seulement le code, mais aussi:

- les decisions prises
- l'etat actuel
- les dependances
- les conventions de donnees
- les choix reportes a plus tard
- les pistes d'amelioration futures

### 24.2 Documentation humaine a prevoir

Dans `fluance-io/`, je recommande au minimum:

- un fichier d'architecture du hub leads/contact
- un guide d'exploitation
- un guide DNS / domaine `api.fluance.io`
- un guide Mailjet / proprietes / segmentation
- un guide juridique et wording des formulaires

Exemples de fichiers:

- `docs/leads-architecture.md`
- `docs/leads-runbook.md`
- `docs/api-fluance-dns.md`
- `docs/mailjet-proprietes-leads.md`
- `docs/migration-blogs-vers-fluance.md`

### 24.3 Documentation orientee IA

Je recommande aussi un document tres explicite, optimise pour une IA ou un futur agent:

- perimetre
- topologie
- conventions de nommage
- invariants a ne pas casser
- flux critiques
- decisions non negociables
- dette technique acceptee

Exemple:

- `docs/ai-context-leads.md`

Contenu recommande:

- "les formulaires contact ne doivent jamais inscrire en liste marketing"
- "tous les opt-ins doivent passer par DOI"
- "la liste Mailjet est unique, la segmentation se fait par proprietes"
- "les blogs gardent leurs redirects actuels en phase 1"
- "GitHub Pages reste en place pour le front"
- "api.fluance.io est porte par Firebase Hosting + Functions"

### 24.4 Ameliorations futures a documenter explicitement

- ajout d'un centre de preferences
- eventuelle migration du front public vers Cloudflare Pages
- affinage de la retention RGPD des journaux
- tableaux de bord d'observabilite
- harmonisation avancee des pages de remerciement
- templates DOI plus fins par blog
- relances DOI plus intelligentes

## 25. Etat cible de phase 1

Quand la phase 1 sera terminee:

- les 3 blogs posteront vers `api.fluance.io`
- les opt-ins utiliseront Mailjet Fluance
- les contacts iront vers `support@fluance.io`
- les contacts ne seront pas inscrits en liste marketing
- tous les opt-ins passeront par DOI
- les redirects et pages actuelles seront conserves
- les politiques et mentions des blogs seront mises a jour
- un journal complet et utile existera dans Firebase
- la documentation humaine et IA sera presente dans le repo

## 26. Decisions finales verrouillees avant implementation

Pour eviter toute ambiguite, voici la synthese finale:

- API de production: `api.fluance.io`
- front public Fluance: GitHub Pages conserve en phase 1
- backend API: Firebase Hosting + Firebase Functions HTTP
- contacts blogs: email interne unique vers `support@fluance.io`
- expediteur DOI / newsletter: `fluance@actu.fluance.io`
- nom expediteur DOI / newsletter: `Cedric de Fluance`
- expediteur transactionnel contact: `support@actu.fluance.io`
- nom expediteur transactionnel contact: `Support de Fluance`
- aucune inscription marketing depuis les formulaires contact
- liste Mailjet unique existante pour tous les opt-ins
- segmentation par proprietes Mailjet en francais
- DOI obligatoire pour tous les opt-ins
- relances DOI a `24h` puis `5 jours`
- expiration DOI a `7 jours`
- aucun accuse auto au visiteur pour les formulaires contact en phase 1
- redirects actuels des blogs conserves
- pages de succes actuelles conservees en phase 1
- lead magnets et promesses immediates conserves en phase 1
- Turnstile conserve tel quel, secret par site
- politique de confidentialite centralisee Fluance
- domaines principaux:
  - `techniquesdemeditation.com`
  - `vie-explosive.fr`
  - `developpementpersonnel.org`
- alias:
  - `devperso.org`
- `site_id` conserves a l'identique
- journal complet Firestore avec retention documentee
- documentation humaine + IA incluse dans le repo
