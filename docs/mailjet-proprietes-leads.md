# Proprietes Mailjet pour les leads blogs

## Principe

Une seule liste Mailjet est utilisee.

La segmentation se fait via des proprietes en francais, en `snake_case`.

## Proprietes de phase 1

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

## Proprietes existantes preservees

Pour compatibilite avec l'existant Fluance:

- `source_optin`
- `date_optin`
- `statut`
- `est_client`
- `firstname`

## Valeurs recommandees

### `site_source`

- `techniquesdemeditation`
- `vie-explosive`
- `devperso`

### `blog_source`

- `techniquesdemeditation.com`
- `vie-explosive.fr`
- `developpementpersonnel.org`

### `type_optin`

- `newsletter`

### `statut_consentement`

- `en_attente`
- `consenti`

### `statut_double_optin`

- `en_attente`
- `confirme`

### `interets_declares`

- `meditation`
- `developpement_personnel`

## Regle importante

Les formulaires contact ne doivent pas enrichir ces proprietes marketing.

