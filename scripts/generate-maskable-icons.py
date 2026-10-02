#!/usr/bin/env python3
"""
Génère les icônes PWA « maskable » (Android adaptive icons).

Pourquoi : une icône maskable est recadrée par Android (cercle, squircle,
carré arrondi…). Le contenu essentiel doit tenir dans un cercle de 40 % du
côté (safe zone), sans quoi le logo peut être rogné. Les icônes
`android-chrome-*.png` ont le logo presque à ras du bord : on crée donc une
variante avec le logo réduit et recentré, sur fond plein (pas de coins
transparents) pour éviter tout liseré blanc.

Usage :
    python3 scripts/generate-maskable-icons.py
"""

import math
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("❌ Pillow n'est pas installé. Installez-le avec : pip3 install Pillow")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "assets", "img")

# Rayon maximal du logo une fois redimensionné (en proportion du côté).
# La norme maskable est 40 % ; on garde une petite marge de sécurité.
SAFE_RATIO = 0.39

SOURCES = [
    "android-chrome-512x512.png",
    "android-chrome-192x192.png",
]


def is_logo_pixel(r, g, b):
    """Logo doré sur fond magenta : jaune = beaucoup de rouge/vert, peu de bleu."""
    return r > 180 and g > 150 and b < 130


def build(src_path, dst_path):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    px = im.load()
    background = px[0, 0]

    cx, cy = w / 2, h / 2
    max_distance = 0.0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if is_logo_pixel(r, g, b):
                max_distance = max(max_distance, math.hypot(x - cx, y - cy))

    if max_distance == 0:
        print(f"⚠️  Aucun logo détecté dans {src_path}, ignoré.")
        return

    target = SAFE_RATIO * w
    scale = min(0.85, target / max_distance)
    inner = im.resize(
        (max(1, round(w * scale)), max(1, round(h * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGB", (w, h), background)
    canvas.paste(inner, ((w - inner.size[0]) // 2, (h - inner.size[1]) // 2))
    canvas.save(dst_path, "PNG", optimize=True)
    print(f"✅ {os.path.basename(dst_path)} ({w}x{h}, logo à {scale * 100:.0f} %)")


def main():
    print("🎨 Génération des icônes PWA maskable…\n")
    for name in SOURCES:
        src = os.path.join(IMG_DIR, name)
        if not os.path.exists(src):
            print(f"❌ Source introuvable : {src}")
            sys.exit(1)
        dst = os.path.join(IMG_DIR, name.replace("android-chrome-", "android-chrome-maskable-"))
        build(src, dst)
    print("\n✨ Terminé.")


if __name__ == "__main__":
    main()
