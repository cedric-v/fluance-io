# Utilisation de MJML pour les templates d'emails

## Vue d'ensemble

Tous les emails sont maintenant gérés via **MJML**, un framework qui génère du HTML responsive pour les emails. Les templates sont compilés automatiquement par Eleventy lors du build.

## Structure

### Templates source (`.mjml`)
- **Emplacement** : `src/emails/*.mjml`
- **Format** : Fichiers MJML avec placeholders `{{variable}}`

### Templates compilés (`.html`)
- **Emplacement** : `functions/emails/*.html`
- **Génération** : Automatique lors de `npm run build:11ty`
- **Copie** : Automatique vers `functions/emails/` via le hook `eleventy.after`

## Templates disponibles

### Emails transactionnels

| Template | Usage | Variables |
|----------|-------|-----------|
| `confirmation-optin.mjml` | Confirmation double opt-in (2 pratiques, 5 jours) | `firstName`, `confirmationUrl` |
| `creation-compte.mjml` | Création compte après achat | `product`, `registrationUrl`, `expirationDays` |
| `reinitialisation-mot-de-passe.mjml` | Réinitialisation mot de passe | `resetLink` |
| `connexion.mjml` | Lien de connexion passwordless | `signInLink` |
| `notification-commentaire.mjml` | Notification nouveau commentaire | `name`, `comment`, `pageUrl`, `fullUrl` |

### Emails marketing

| Template | Usage | Variables |
|----------|-------|-----------|
| `promotion-5jours.mjml` | Promotion 5 jours (J+1) | `firstName` |
| `relance-5jours.mjml` | Relance 5 jours (J+3) | `firstName` |
| `promotion-21jours-jour6.mjml` | Jour 6 après 5 jours | `firstName` |
| `promotion-21jours-relance.mjml` | Relance clôture (J+10, J+8) | `firstName` |
| `promotion-21jours-final.mjml` | Message final (J+17, J+15, J+22) | `firstName` |

### Emails de contenu

| Template | Usage | Variables |
|----------|-------|-----------|
| `nouveau-contenu-21jours.mjml` | Nouveau contenu 21jours | `day`, `title` |
| `nouveau-contenu-complet.mjml` | Nouveau contenu complet | `week`, `title` |

## Workflow

### 1. Créer/Modifier un template

Éditez le fichier `.mjml` dans `src/emails/` :

```mjml
---
layout: false
permalink: /emails/mon-template.html
---
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Bonjour {{firstName}},
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

### 2. Compiler les templates

```bash
npm run build:11ty
```

Cela :
- Compile les `.mjml` en `.html` dans `_site/emails/`
- Copie automatiquement vers `functions/emails/`

### 3. Utiliser dans les Cloud Functions

```javascript
const emailHtml = loadEmailTemplate('mon-template', {
  firstName: 'Cédric',
});
```

## Variables et placeholders

### Format
- Placeholder : `{{variable}}`
- Espace avant : `Bonjour {{firstName}},` → `Bonjour Cédric,` ou `Bonjour,` (si vide)

### Gestion des espaces et attributs HTML
La fonction `loadEmailTemplate` gère automatiquement :
- **Placeholders avec espace avant** : Si variable vide, supprime l'espace avant `{{variable}}`
- **Placeholders sans espace** : Remplace directement (pour les attributs HTML comme `href`)

Exemples :
```mjml
Bonjour {{firstName}},  →  "Bonjour Cédric," ou "Bonjour," (si vide)
href="{{confirmationUrl}}"  →  href="https://fluance.io/confirm?..." (toujours remplacé)
```

**Important** : Les placeholders dans les attributs HTML (`href`, `src`, etc.) sont automatiquement remplacés, même sans espace avant.

## Exemple complet

### Template MJML (`src/emails/exemple.mjml`)

```mjml
---
layout: false
permalink: /emails/exemple.html
---
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Bonjour {{firstName}},
        </mj-text>
        <mj-text>
          Votre contenu : {{title}}
        </mj-text>
        <mj-button href="https://fluance.io/membre/">
          Accéder
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

### Utilisation dans Cloud Function

```javascript
const emailHtml = loadEmailTemplate('exemple', {
  firstName: 'Cédric',
  title: 'Nouveau contenu',
  registrationUrl: 'https://fluance.io/register?token=...',
});
```

## Avantages de MJML

1. **Responsive par défaut** : Compatible avec tous les clients email (même Outlook)
2. **Syntaxe simple** : Plus lisible que HTML table nesting
3. **Maintenabilité** : Modifications centralisées dans les templates
4. **Séparation des préoccupations** : Contenu (MJML) vs Logique (JavaScript)

## Documentation MJML

- [Documentation officielle](https://mjml.io/documentation/)
- [Composants disponibles](https://mjml.io/documentation/#mjml-body)
- [Try it live](https://mjml.io/try-it-live)

## Commandes utiles

```bash
# Compiler les templates
npm run build:11ty

# Build complet (CSS + templates)
npm run build

# Voir les templates compilés
ls functions/emails/
```

## Notes importantes

- ⚠️ **Toujours rebuild après modification** : `npm run build:11ty`
- ⚠️ **Les templates doivent être commités** : `src/emails/*.mjml`
- ✅ **Les templates compilés sont dans `.gitignore`** : `functions/emails/*.html` (générés automatiquement)
- ✅ **Variables vides** : L'espace avant `{{variable}}` est automatiquement supprimé
- ✅ **Liens dynamiques** : Les placeholders dans `href="{{url}}"` sont automatiquement remplacés
- ✅ **Migration complète** : Tous les emails utilisent maintenant MJML (100% migration)

## Migration depuis les templates MailJet

**Note** : Les anciens templates MailJet (comme le template ID 7571938) ont été remplacés par des templates MJML. Voir `MODIFIER_EMAIL_CONFIRMATION_DOUBLE_OPT_IN.md` pour l'historique, mais **tous les emails utilisent maintenant MJML**.
