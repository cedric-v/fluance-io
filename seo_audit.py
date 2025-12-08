#!/usr/bin/env python3
"""
Script d'audit SEO pour Fluance.io
Vérifie la structure des titres, les métadonnées et les liens internes
"""

import os
import re
from pathlib import Path
from collections import defaultdict

# Configuration
SRC_DIR = Path("src")
FR_DIR = SRC_DIR / "fr"
EN_DIR = SRC_DIR / "en"

# Résultats
results = {
    "pages": [],
    "issues": [],
    "links": defaultdict(list)
}

def extract_frontmatter(content):
    """Extrait le frontmatter YAML d'un fichier markdown"""
    if not content.startswith("---"):
        return None, content
    
    parts = content.split("---", 2)
    if len(parts) < 3:
        return None, content
    
    frontmatter = parts[1]
    body = parts[2]
    
    metadata = {}
    for line in frontmatter.strip().split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            metadata[key] = value
    
    return metadata, body

def analyze_headings(content):
    """Analyse la structure des titres (h1, h2, h3)"""
    headings = {
        "h1": [],
        "h2": [],
        "h3": [],
        "h4": [],
        "h5": [],
        "h6": []
    }
    
    # Recherche des balises HTML
    h1_pattern = r'<h1[^>]*>(.*?)</h1>'
    h2_pattern = r'<h2[^>]*>(.*?)</h2>'
    h3_pattern = r'<h3[^>]*>(.*?)</h3>'
    h4_pattern = r'<h4[^>]*>(.*?)</h4>'
    
    headings["h1"] = re.findall(h1_pattern, content, re.DOTALL | re.IGNORECASE)
    headings["h2"] = re.findall(h2_pattern, content, re.DOTALL | re.IGNORECASE)
    headings["h3"] = re.findall(h3_pattern, content, re.DOTALL | re.IGNORECASE)
    headings["h4"] = re.findall(h4_pattern, content, re.DOTALL | re.IGNORECASE)
    
    # Nettoyage des balises HTML dans les titres
    for level in headings:
        headings[level] = [re.sub(r'<[^>]+>', '', h).strip() for h in headings[level]]
    
    return headings

def find_internal_links(content, locale):
    """Trouve tous les liens internes"""
    links = []
    
    # Pattern pour les liens avec relativeUrl
    pattern = r"\{\{\s*['\"]([^'\"]+)['\"]\s*\|\s*relativeUrl\s*\}\}"
    matches = re.findall(pattern, content)
    
    for match in matches:
        if match.startswith("/"):
            links.append(match)
        elif not match.startswith("http"):
            links.append(f"/{match}")
    
    return links

def analyze_page(file_path, locale):
    """Analyse une page complète"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {"error": str(e)}
    
    metadata, body = extract_frontmatter(content)
    
    if not metadata:
        return {"error": "No frontmatter found"}
    
    # Analyse
    page_data = {
        "file": str(file_path),
        "locale": locale,
        "title": metadata.get("title", ""),
        "description": metadata.get("description", ""),
        "permalink": metadata.get("permalink", ""),
        "headings": analyze_headings(body),
        "links": find_internal_links(body, locale),
        "issues": []
    }
    
    # Vérifications SEO
    # 1. Vérifier présence de title
    if not page_data["title"]:
        page_data["issues"].append("❌ Pas de titre (title) défini")
    
    # 2. Vérifier présence de description
    if not page_data["description"]:
        page_data["issues"].append("❌ Pas de description définie")
    elif len(page_data["description"]) < 50:
        page_data["issues"].append(f"⚠️ Description trop courte ({len(page_data['description'])} caractères, recommandé: 50-160)")
    elif len(page_data["description"]) > 160:
        page_data["issues"].append(f"⚠️ Description trop longue ({len(page_data['description'])} caractères, recommandé: 50-160)")
    
    # 3. Vérifier structure des titres
    h1_count = len(page_data["headings"]["h1"])
    if h1_count == 0:
        page_data["issues"].append("❌ Aucun H1 trouvé")
    elif h1_count > 1:
        page_data["issues"].append(f"⚠️ Plusieurs H1 trouvés ({h1_count}), devrait être unique")
    
    # 4. Vérifier ordre des titres (h1 avant h2, etc.)
    if page_data["headings"]["h2"] and h1_count == 0:
        page_data["issues"].append("⚠️ H2 présent sans H1")
    
    if page_data["headings"]["h3"] and not page_data["headings"]["h2"]:
        page_data["issues"].append("⚠️ H3 présent sans H2")
    
    return page_data

def scan_directory(directory, locale):
    """Scanne un répertoire pour trouver tous les fichiers .md"""
    pages = []
    
    for md_file in directory.rglob("*.md"):
        # Ignorer les fichiers dans node_modules ou autres
        if "node_modules" in str(md_file):
            continue
        
        page_data = analyze_page(md_file, locale)
        if "error" not in page_data:
            pages.append(page_data)
    
    return pages

def generate_report():
    """Génère le rapport d'audit SEO"""
    print("=" * 80)
    print("AUDIT SEO - FLUANCE.IO")
    print("=" * 80)
    print()
    
    # Scanner les pages
    fr_pages = scan_directory(FR_DIR, "fr")
    en_pages = scan_directory(EN_DIR, "en")
    all_pages = fr_pages + en_pages
    
    print(f"📄 Pages analysées: {len(all_pages)} ({len(fr_pages)} FR, {len(en_pages)} EN)")
    print()
    
    # 1. RAPPORT PAR PAGE
    print("=" * 80)
    print("1. RAPPORT PAR PAGE")
    print("=" * 80)
    print()
    
    for page in sorted(all_pages, key=lambda x: (x["locale"], x["file"])):
        print(f"📄 {page['locale'].upper()}: {page['file']}")
        print(f"   Title: {page['title']}")
        print(f"   Description: {page['description'][:80]}..." if len(page['description']) > 80 else f"   Description: {page['description']}")
        print(f"   Permalink: {page['permalink']}")
        print(f"   H1: {len(page['headings']['h1'])} | H2: {len(page['headings']['h2'])} | H3: {len(page['headings']['h3'])}")
        
        if page['issues']:
            for issue in page['issues']:
                print(f"   {issue}")
        else:
            print("   ✅ Aucun problème détecté")
        
        if page['links']:
            print(f"   Liens internes: {len(page['links'])}")
            for link in page['links'][:3]:  # Afficher les 3 premiers
                print(f"      - {link}")
            if len(page['links']) > 3:
                print(f"      ... et {len(page['links']) - 3} autres")
        
        print()
    
    # 2. PROBLÈMES GLOBAUX
    print("=" * 80)
    print("2. PROBLÈMES DÉTECTÉS")
    print("=" * 80)
    print()
    
    all_issues = []
    for page in all_pages:
        for issue in page['issues']:
            all_issues.append((page['file'], issue))
    
    if not all_issues:
        print("✅ Aucun problème détecté !")
    else:
        for file, issue in all_issues:
            print(f"❌ {file}")
            print(f"   {issue}")
            print()
    
    # 3. STATISTIQUES DES MÉTADONNÉES
    print("=" * 80)
    print("3. STATISTIQUES DES MÉTADONNÉES")
    print("=" * 80)
    print()
    
    titles_without_desc = [p for p in all_pages if not p['description']]
    desc_too_short = [p for p in all_pages if p['description'] and len(p['description']) < 50]
    desc_too_long = [p for p in all_pages if p['description'] and len(p['description']) > 160]
    
    print(f"Pages sans description: {len(titles_without_desc)}")
    print(f"Descriptions trop courtes (<50): {len(desc_too_short)}")
    print(f"Descriptions trop longues (>160): {len(desc_too_long)}")
    print()
    
    # 4. STRUCTURE DES TITRES
    print("=" * 80)
    print("4. STRUCTURE DES TITRES")
    print("=" * 80)
    print()
    
    pages_without_h1 = [p for p in all_pages if len(p['headings']['h1']) == 0]
    pages_multiple_h1 = [p for p in all_pages if len(p['headings']['h1']) > 1]
    
    print(f"Pages sans H1: {len(pages_without_h1)}")
    if pages_without_h1:
        for p in pages_without_h1:
            print(f"   - {p['file']}")
    print()
    
    print(f"Pages avec plusieurs H1: {len(pages_multiple_h1)}")
    if pages_multiple_h1:
        for p in pages_multiple_h1:
            print(f"   - {p['file']} ({len(p['headings']['h1'])} H1)")
    print()
    
    # 5. LIENS INTERNES
    print("=" * 80)
    print("5. ANALYSE DES LIENS INTERNES")
    print("=" * 80)
    print()
    
    all_links = set()
    for page in all_pages:
        all_links.update(page['links'])
    
    print(f"Total de liens internes uniques trouvés: {len(all_links)}")
    print()
    
    # Vérifier si les liens pointent vers des pages existantes
    permalinks = {p['permalink'] for p in all_pages if p['permalink']}
    broken_links = []
    
    for page in all_pages:
        for link in page['links']:
            # Normaliser le lien
            normalized_link = link.rstrip('/')
            if normalized_link not in permalinks and not link.startswith('javascript'):
                broken_links.append((page['file'], link))
    
    if broken_links:
        print(f"⚠️ Liens potentiellement cassés: {len(broken_links)}")
        for file, link in broken_links[:10]:  # Afficher les 10 premiers
            print(f"   - {file}: {link}")
        if len(broken_links) > 10:
            print(f"   ... et {len(broken_links) - 10} autres")
    else:
        print("✅ Tous les liens internes semblent valides")
    
    print()
    print("=" * 80)
    print("FIN DU RAPPORT")
    print("=" * 80)

if __name__ == "__main__":
    generate_report()








