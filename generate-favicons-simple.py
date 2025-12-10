#!/usr/bin/env python3
"""
Script pour générer les favicons depuis fluance-favicon-highres.png
Utilise Pillow (PIL) pour le traitement d'images
"""

try:
    from PIL import Image
except ImportError:
    print("❌ Pillow n'est pas installé. Installez-le avec: pip3 install Pillow")
    exit(1)

import os

# Chemins
source_path = 'src/assets/img/fluance-favicon-highres.png'
output_dir = 'src/assets/img'

# Vérifier que l'image source existe
if not os.path.exists(source_path):
    print(f"❌ Image source non trouvée: {source_path}")
    exit(1)

# Charger l'image
print(f"📸 Chargement de {source_path}...")
img = Image.open(source_path)

# Convertir en RGB si nécessaire
if img.mode != 'RGB':
    print(f"🔄 Conversion de {img.mode} vers RGB...")
    img = img.convert('RGB')

print(f"✅ Image chargée: {img.size[0]}x{img.size[1]} pixels\n")

# Tailles à générer selon les bonnes pratiques modernes
sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
}

# Générer toutes les tailles
print("🎨 Génération des favicons...\n")
for filename, size in sizes.items():
    output_path = os.path.join(output_dir, filename)
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(output_path, 'PNG', optimize=True)
    print(f"✅ {filename} ({size}x{size})")

# Créer favicon.ico avec plusieurs tailles
print("\n📦 Création de favicon.ico (multi-taille)...")
icon_sizes = [(16, 16), (32, 32), (48, 48)]
icon_images = []
for size in icon_sizes:
    resized = img.resize(size, Image.Resampling.LANCZOS)
    icon_images.append(resized)

favicon_path = os.path.join(output_dir, 'favicon.ico')
# PIL peut créer des ICO avec plusieurs tailles
icon_images[0].save(
    favicon_path, 
    format='ICO', 
    sizes=[(16, 16), (32, 32), (48, 48)]
)
print(f"✅ favicon.ico créé avec les tailles: 16x16, 32x32, 48x48")

print("\n✨ Toutes les favicons ont été générées avec succès!")
print(f"📁 Fichiers créés dans: {output_dir}/")
