#!/usr/bin/env node
/**
 * Génère une paire de clés VAPID pour les notifications Web Push, l'écrit dans
 * `functions/.vapid-keys.json` (gitignoré) et affiche les étapes suivantes.
 *
 * Usage : node scripts/generate-vapid-keys.mjs
 *
 * ⚠️ Régénérer les clés invalide tous les abonnements push existants.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webpushPath = path.join(__dirname, '..', 'functions', 'node_modules', 'web-push');
if (!fs.existsSync(webpushPath)) {
  console.error('❌ Le paquet web-push est introuvable. Lancez : npm install --prefix functions');
  process.exit(1);
}
const webpush = require(webpushPath);

const outPath = path.join(__dirname, '..', 'functions', '.vapid-keys.json');
if (fs.existsSync(outPath)) {
  console.error('❌ functions/.vapid-keys.json existe déjà.');
  console.error('   Supprimez-le pour régénérer (attention : les abonnements push existants seront invalidés).');
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
fs.writeFileSync(outPath, JSON.stringify(keys, null, 2) + '\n', 'utf8');

console.log('✅ Clés VAPID générées dans functions/.vapid-keys.json (gitignoré).\n');
console.log('1) Clé PUBLIQUE (à mettre dans .env et dans les GitHub secrets → WEBPUSH_PUBLIC_KEY) :\n');
console.log(`   WEBPUSH_PUBLIC_KEY=${keys.publicKey}\n`);
console.log('2) Clé PRIVÉE — à stocker en secret Firebase :\n');
console.log('   node -e "process.stdout.write(require(\'./functions/.vapid-keys.json\').privateKey)" | firebase functions:secrets:set WEBPUSH_PRIVATE_KEY\n');
console.log('3) Redéployer :');
console.log('   firebase deploy --only functions:savePushSubscription,functions:removePushSubscription,functions:sendPracticeReminders\n');
