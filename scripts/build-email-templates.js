#!/usr/bin/env node

/**
 * Compile les templates d'emails MJML (src/emails/*.mjml) vers
 * functions/emails/*.html, prêts à être embarqués dans les Cloud Functions.
 *
 * ⚠️ Pourquoi ce script existe :
 *  - functions/emails/*.html est gitignoré (artefacts de build).
 *  - L'ancien pipeline (Eleventy + hook eleventy.after) a eu un bug
 *    (mjml non awaité) qui n'a généré AUCUN template transactionnel →
 *    l'email « Créez votre compte » (creation-compte.html) manquait en
 *    production → clients payants sans accès (incident du 22/07/2026).
 *  - Ce script est déclenché automatiquement avant `firebase deploy`
 *    (hook predeploy dans firebase.json) : les templates sont donc
 *    TOUJOURS à jour dans le bundle des fonctions.
 *
 * Usage : node scripts/build-email-templates.js
 */

const fs = require('fs');
const path = require('path');
const mjml = require('mjml');

const SRC_DIR = path.join(__dirname, '..', 'src', 'emails');
const DEST_DIR = path.join(__dirname, '..', 'functions', 'emails');
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow">';

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  return content.slice(end + 4);
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Dossier source introuvable : ${SRC_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.mjml'));
  if (files.length === 0) {
    console.error('❌ Aucun template .mjml trouvé dans', SRC_DIR);
    process.exit(1);
  }

  let ok = 0;
  let errors = 0;
  for (const file of files) {
    const srcPath = path.join(SRC_DIR, file);
    const destName = file.replace(/\.mjml$/, '.html');
    const destPath = path.join(DEST_DIR, destName);

    try {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const withoutFrontmatter = stripFrontmatter(raw);
      const result = await mjml(withoutFrontmatter, {
        minify: false,
        validationLevel: 'soft',
      });

      if (!result || !result.html) {
        throw new Error('MJML n’a pas produit de HTML');
      }

      let html = result.html;
      if (!html.includes('name="robots"')) {
        html = html.replace('<head>', `<head>${ROBOTS_META}`);
      }

      fs.writeFileSync(destPath, html, 'utf8');
      console.log(`✅ ${destName}`);
      ok++;
    } catch (e) {
      console.error(`❌ ${destName} : ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📧 ${ok} template(s) compilé(s), ${errors} erreur(s) → ${DEST_DIR}`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error('❌ Erreur fatale :', e);
  process.exit(1);
});
