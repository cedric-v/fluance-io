#!/usr/bin/env node

/**
 * Script de réparation : migre les utilisateurs « old format »
 * (products absent/vide + product renseigné) vers le format products[].
 *
 * Contexte : un utilisateur « old format » (products vide + product renseigné)
 * faisait planter sendNewContentEmails chaque jour (Timestamp.fromDate(Timestamp)),
 * bloquant toutes les séquences d'emails depuis janvier 2026.
 *
 * Usage :
 *   node scripts/fix-old-format-users.js            # mode dry-run (défaut)
 *   node scripts/fix-old-format-users.js --apply    # applique les changements
 */

const admin = require('firebase-admin');
const {getFirestore, Timestamp, FieldValue} = require('firebase-admin/firestore');

function toJsDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function main() {
  admin.initializeApp({
    projectId: 'fluance-protected-content',
    credential: admin.applicationDefault(),
  });
  const db = getFirestore();
  const apply = process.argv.includes('--apply');

  const snap = await db.collection('users').get();
  let migrated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const products = data.products || [];
    const hasOldFormat = products.length === 0 && data.product;

    if (!hasOldFormat) continue;

    const startDate = toJsDate(data.registrationDate) || toJsDate(data.createdAt) || new Date();
    const purchasedAt = toJsDate(data.createdAt) || startDate;
    const newProducts = [{
      name: data.product,
      startDate: Timestamp.fromDate(startDate),
      purchasedAt: Timestamp.fromDate(purchasedAt),
    }];

    console.log(`- ${data.email} (${doc.id}) : product="${data.product}" → products[${newProducts[0].name}] startDate=${startDate.toISOString()}`);

    if (apply) {
      await doc.ref.update({
        products: newProducts,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✅ migré`);
    }
    migrated++;
  }

  console.log(`\n${migrated} utilisateur(s) old format trouvé(s).`);
  if (!apply) {
    console.log('Mode dry-run : rien n\'a été modifié. Relancez avec --apply pour appliquer.');
  } else {
    console.log('Migration appliquée.');
  }
}

main().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
