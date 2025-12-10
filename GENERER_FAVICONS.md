# Génération des favicons depuis fluance-favicon-highres.png

## Méthode recommandée : Script Python

### Prérequis
```bash
pip3 install Pillow
```

### Exécution
```bash
python3 generate-favicons-simple.py
```

Le script génère automatiquement :
- `favicon.ico` (multi-taille : 16x16, 32x32, 48x48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `android-chrome-192x192.png` (192x192)
- `android-chrome-512x512.png` (512x512)

## Méthode alternative : Outil en ligne

1. Allez sur [realfavicongenerator.net](https://realfavicongenerator.net/)
2. Uploadez `src/assets/img/fluance-favicon-highres.png`
3. Configurez les options selon vos besoins
4. Téléchargez le package généré
5. Extrayez les fichiers dans `src/assets/img/`

## Méthode alternative : sips (macOS)

```bash
cd src/assets/img

# Générer les différentes tailles
sips -z 16 16 fluance-favicon-highres.png --out favicon-16x16.png
sips -z 32 32 fluance-favicon-highres.png --out favicon-32x32.png
sips -z 180 180 fluance-favicon-highres.png --out apple-touch-icon.png
sips -z 192 192 fluance-favicon-highres.png --out icon-192.png
sips -z 512 512 fluance-favicon-highres.png --out icon-512.png
sips -z 192 192 fluance-favicon-highres.png --out android-chrome-192x192.png
sips -z 512 512 fluance-favicon-highres.png --out android-chrome-512x512.png

# Pour créer favicon.ico, utilisez ImageMagick:
# convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico
```

## Fichiers générés

Tous les fichiers doivent être placés dans `src/assets/img/` :

- ✅ `favicon.ico` (multi-taille : 16x16, 32x32, 48x48)
- ✅ `favicon-16x16.png`
- ✅ `favicon-32x32.png`
- ✅ `apple-touch-icon.png` (180x180)
- ✅ `icon-192.png` (192x192)
- ✅ `icon-512.png` (512x512)
- ✅ `android-chrome-192x192.png` (192x192)
- ✅ `android-chrome-512x512.png` (512x512)

## Intégration

Les favicons sont déjà intégrés dans `src/_includes/base.njk` avec les bonnes pratiques modernes :

- ✅ Favicon classique (favicon.ico)
- ✅ Favicons PNG avec tailles spécifiées (16x16, 32x32)
- ✅ Apple Touch Icon (180x180)
- ✅ Web Manifest pour PWA
- ✅ Theme color (#82153e - couleur Fluance)

## Bonnes pratiques implémentées

1. **Favicon.ico** : Format classique multi-taille pour compatibilité maximale
2. **PNG avec tailles** : Favicons PNG avec attribut `sizes` pour optimisation
3. **Apple Touch Icon** : 180x180 pour iOS (iPhone, iPad)
4. **Web Manifest** : Pour PWA et Android Chrome
5. **Theme Color** : Couleur de thème pour les navigateurs modernes

## Vérification

Après génération, vérifiez que tous les fichiers sont présents :
```bash
ls -lh src/assets/img/favicon* src/assets/img/apple-touch-icon.png src/assets/img/icon-*.png src/assets/img/android-chrome-*.png
```
