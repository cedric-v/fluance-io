/**
 * Réinitialise l'éligibilité au cours d'essai gratuit pour un ou plusieurs emails.
 *
 * L'éligibilité est calculée dans functions/services/passService.js :
 *   isFirstVisit = aucune réservation dans la collection "bookings"
 *   canUseTrial = isFirstVisit
 *
 * Ce script supprime donc les réservations (et les tokens d'annulation associés)
 * des emails indiqués, en sauvegardant auparavant les documents supprimés.
 * Aucun pass actif ne doit exister (sinon l'essai ne serait pas proposé) : le
 * script refuse de traiter un email ayant un pass actif.
 *
 * Usage:
 *   node scripts/reset-trial-eligibility.js email1@example.com [email2@example.com ...]
 *   node scripts/reset-trial-eligibility.js --dry-run email1@example.com
 *   node scripts/reset-trial-eligibility.js --yes email1@example.com
 *
 * Options:
 *   --dry-run : affiche ce qui serait supprimé, sans rien écrire
 *   --yes     : ne demande pas de confirmation
 *
 * Connexion Firestore : service account (GOOGLE_APPLICATION_CREDENTIALS,
 * functions/serviceAccountKey.json, new-project-service-account.json) ou
 * Application Default Credentials (gcloud auth application-default login).
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "fluance-protected-content";

function initFirebase() {
  if (getApps().length) return;

  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "../functions/serviceAccountKey.json"),
    path.join(__dirname, "../new-project-service-account.json"),
  ];

  const serviceAccountPath = possiblePaths.find((p) => p && fs.existsSync(p));

  if (serviceAccountPath) {
    console.log(`📁 Service account : ${serviceAccountPath}`);
    initializeApp({
      credential: cert(require(serviceAccountPath)),
      projectId: PROJECT_ID,
    });
  } else {
    console.log("🔐 Application Default Credentials");
    initializeApp({ projectId: PROJECT_ID });
  }
}

const normalizeEmail = (email) => (email || "").toLowerCase().trim();

async function collectData(db, email) {
  const normalizedEmail = normalizeEmail(email);

  const [bookings, passes, cancellationTokens] = await Promise.all([
    db.collection("bookings").where("email", "==", normalizedEmail).get(),
    db.collection("userPasses").where("email", "==", normalizedEmail).get(),
    db
      .collection("cancellationTokens")
      .where("email", "==", normalizedEmail)
      .get(),
  ]);

  return {
    email: normalizedEmail,
    bookings: bookings.docs.map((doc) => ({
      id: doc.id,
      path: doc.ref.path,
      data: doc.data(),
    })),
    passes: passes.docs.map((doc) => ({
      id: doc.id,
      path: doc.ref.path,
      data: doc.data(),
    })),
    cancellationTokens: cancellationTokens.docs.map((doc) => ({
      id: doc.id,
      path: doc.ref.path,
      data: doc.data(),
    })),
  };
}

function describeBooking(booking) {
  const d = booking.data;
  return (
    `${d.courseName || "Cours"} - ${d.courseDate || "?"} ${d.courseTime || ""} ` +
    `[${d.status || "?"}] ${d.pricingOption || ""} ${d.amount === 0 ? "gratuit" : `${d.amount || "?"} ${d.currency || ""}`}`
  );
}

async function resetEmail(db, entry, { dryRun }) {
  const { email, bookings, passes, cancellationTokens } = entry;

  const activePasses = passes.filter((p) => p.data.status === "active");
  if (activePasses.length > 0) {
    console.log(
      `⛔ ${email} : pass actif détecté, email ignoré (aucune suppression).`,
    );
    return { email, skipped: true, reason: "active_pass", deletedBookings: 0 };
  }

  if (bookings.length === 0 && cancellationTokens.length === 0) {
    console.log(
      `ℹ️  ${email} : aucune donnée à réinitialiser, l'essai est déjà disponible.`,
    );
    return { email, deletedBookings: 0, deletedTokens: 0 };
  }

  console.log(`\n👤 ${email}`);
  bookings.forEach((b) =>
    console.log(`   - booking ${b.id} : ${describeBooking(b)}`),
  );
  cancellationTokens.forEach((t) =>
    console.log(
      `   - cancellationToken ${t.id} (cours ${t.data.courseId || "?"})`,
    ),
  );

  if (dryRun) {
    console.log(
      `   🔎 --dry-run : ${bookings.length} réservation(s) et ${cancellationTokens.length} token(s) seraient supprimés.`,
    );
    return { email, dryRun: true, deletedBookings: 0, deletedTokens: 0 };
  }

  // Décrémenter les compteurs de participants des cours encore existants.
  const courseDecrements = new Map();
  for (const booking of bookings) {
    if (
      ["confirmed", "pending_cash"].includes(booking.data.status) &&
      booking.data.courseId
    ) {
      courseDecrements.set(
        booking.data.courseId,
        (courseDecrements.get(booking.data.courseId) || 0) + 1,
      );
    }
  }

  for (const [courseId, count] of courseDecrements.entries()) {
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) continue;
    const currentCount = courseDoc.data().participantCount || 0;
    const newCount = Math.max(0, currentCount - count);
    if (newCount !== currentCount) {
      await courseRef.update({ participantCount: newCount });
      console.log(
        `   📊 Cours ${courseId} : ${currentCount} → ${newCount} participant(s)`,
      );
    }
  }

  // Suppression par lots (max 500 opérations par batch Firestore).
  const refs = [...bookings, ...cancellationTokens].map((item) =>
    db.doc(item.path),
  );
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    refs.slice(i, i + 500).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  console.log(
    `   ✅ ${bookings.length} réservation(s) et ${cancellationTokens.length} token(s) supprimés.`,
  );
  return {
    email,
    deletedBookings: bookings.length,
    deletedTokens: cancellationTokens.length,
  };
}

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^o(ui)?$/i.test(answer.trim()));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const assumeYes = args.includes("--yes");
  const emails = args
    .filter((a) => !a.startsWith("--"))
    .map(normalizeEmail)
    .filter(Boolean);

  if (emails.length === 0) {
    console.error(
      "Usage: node scripts/reset-trial-eligibility.js [--dry-run] [--yes] email1@example.com [...]",
    );
    process.exit(1);
  }

  initFirebase();
  const db = getFirestore();

  const entries = [];
  for (const email of emails) {
    entries.push(await collectData(db, email));
  }

  console.log("\n════════════════════════════════════════");
  console.log(
    dryRun
      ? "🔎 MODE DRY-RUN (aucune écriture)"
      : "♻️  RÉINITIALISATION DES ESSAIS GRATUITS",
  );
  console.log("════════════════════════════════════════");

  if (!dryRun && !assumeYes) {
    const totalBookings = entries.reduce((n, e) => n + e.bookings.length, 0);
    const totalTokens = entries.reduce(
      (n, e) => n + e.cancellationTokens.length,
      0,
    );
    const ok = await askConfirmation(
      `\nSupprimer définitivement ${totalBookings} réservation(s) et ${totalTokens} token(s) ` +
        `pour ${entries.length} email(s) ? (oui/non) `,
    );
    if (!ok) {
      console.log("Annulé.");
      process.exit(0);
    }
  }

  // Sauvegarde avant suppression (réversible).
  let backupPath = null;
  if (
    !dryRun &&
    entries.some((e) => e.bookings.length || e.cancellationTokens.length)
  ) {
    const logsDir = path.join(__dirname, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    backupPath = path.join(
      logsDir,
      `reset-trial-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), entries }, null, 2),
    );
    console.log(`💾 Sauvegarde : ${backupPath}`);
  }

  const results = [];
  for (const entry of entries) {
    results.push(await resetEmail(db, entry, { dryRun }));
  }

  // Vérification : canUseTrial doit être true après réinitialisation.
  if (!dryRun) {
    const { checkUserPass } = require("../functions/services/passService");
    console.log("\n🔍 Vérification (checkUserPass) :");
    for (const email of emails) {
      const status = await checkUserPass(db, email);
      console.log(
        `   - ${email} : isFirstVisit=${status.isFirstVisit}, canUseTrial=${status.canUseTrial}, ` +
          `hasActivePass=${status.hasActivePass}`,
      );
    }
  }

  console.log("\n📊 Résumé :");
  results.forEach((r) => {
    if (r.skipped) console.log(`   - ${r.email} : ignoré (${r.reason})`);
    else
      console.log(
        `   - ${r.email} : ${r.deletedBookings} réservation(s), ${r.deletedTokens} token(s) supprimés`,
      );
  });
  if (backupPath)
    console.log(`\n💾 Restauration possible depuis ${backupPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
