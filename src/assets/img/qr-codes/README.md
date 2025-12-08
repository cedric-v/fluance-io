# QR Codes pour Flyers

Ce dossier contient les codes QR générés pour les campagnes de flyers.

## QR Code actuel

- **Fichier PNG** : `flyer-fribourg-2025.png`
- **Fichier SVG** : `flyer-fribourg-2025.svg`
- **URL** : `https://fluance.io/?utm_campaign=flyer_2025&utm_term=fribourg`

## Générer un nouveau QR code

Pour générer un nouveau QR code avec des paramètres UTM différents, modifiez le script `scripts/generate-qr.js` :

1. Ouvrez `scripts/generate-qr.js`
2. Modifiez la variable `url` avec votre nouvelle URL et les paramètres UTM souhaités
3. Modifiez les noms de fichiers `outputFilePNG` et `outputFileSVG` si nécessaire
4. Exécutez le script :

```bash
node scripts/generate-qr.js
```

## Paramètres UTM recommandés

Pour le tracking dans Google Analytics, utilisez ces paramètres UTM :

- `utm_source` : Source du trafic (ex: `flyer`, `affiche`, `brochure`)
- `utm_medium` : Moyen de diffusion (ex: `qr_code`, `print`)
- `utm_campaign` : Nom de la campagne (ex: `flyer_2025`, `campagne_hiver_2025`)
- `utm_term` : Terme/mot-clé (ex: `fribourg`, `lausanne`, `bern`)
- `utm_content` : Contenu spécifique (ex: `flyer_1`, `flyer_2`, `verso`)

### Exemple d'URL complète

```
https://fluance.io/?utm_source=flyer&utm_medium=qr_code&utm_campaign=flyer_2025&utm_term=fribourg&utm_content=verso
```

## Formats disponibles

- **PNG** : Format raster, idéal pour l'affichage web (512x512px)
- **SVG** : Format vectoriel, idéal pour l'impression haute qualité (recommandé pour les flyers)

## Caractéristiques techniques

- **Niveau de correction d'erreur** : H (haute) - permet de scanner même si le QR code est partiellement endommagé
- **Marge** : 2 modules
- **Couleurs** : Noir sur blanc (standard pour l'impression)

## Vérification

Pour vérifier que le QR code fonctionne correctement :

1. Scannez-le avec votre téléphone
2. Vérifiez que l'URL est correcte
3. Testez le tracking dans Google Analytics après quelques visites

## Notes

- Les QR codes sont automatiquement trackés par Google Tag Manager
- Les paramètres UTM sont conservés dans l'URL et transmis à Google Analytics
- Pour un meilleur résultat d'impression, utilisez toujours la version SVG







