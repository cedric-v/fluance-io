#!/usr/bin/env node

/**
 * Campagne de ré-engagement « 5 jours » — envoi segmenté, multi-vagues.
 *
 * Vague 1 (--wave=1, défaut) :
 *  - Segment A : contacts avec double opt-in CONFIRMÉ   → email « vos 5 jours offerts »
 *  - Segment B : contacts SANS confirmation (tokens expirés) → email « cadeau + confirmation »
 *
 * Vagues suivantes (--wave=2, …) :
 *  - Relance ciblée sur les contacts de la vague précédente qui n'ont PAS cliqué
 *    (log `reengagementClicks` de l'endpoint reengage5jours).
 *  - Segment par défaut : A (email de relance). Délai minimal entre vagues :
 *    --days-after (défaut 14 jours).
 *
 * Pas de sunset automatique : les contacts peuvent être relancés plusieurs fois
 * si la campagne ne convertit pas assez (décision éditoriale).
 *
 * Exclusions automatiques : clients (produits achetés), comptes internes/test,
 * opt-ins récents (< 30 j, encore dans le funnel normal) — uniquement vague 1.
 *
 * Marquage après envoi : propriétés Mailjet `reengagement_sent` + `reengagement_wave`
 * + log Firestore (`reengagementSends`) → permet de cibler précisément les vagues
 * suivantes sans re-cibler ceux qui ont déjà été contactés dans cette vague.
 *
 * ⚠️ Rythme d'envoi (plan gratuit Mailjet : ~200 emails/jour) : le script compte
 * les envois du jour (Firestore `reengagementSends`) et bride chaque run au
 * budget restant (--daily-cap, défaut 200). Prévoir une marge pour les autres
 * envois du compte (contenu 21 jours, confirmations, relances…) : ex.
 * --daily-cap=150. Le délai entre envois (--delay, défaut 250 ms) limite le
 * débit instantané.
 *
 * Usage :
 *   export MAILJET_API_KEY="..." MAILJET_API_SECRET="..." REENGAGEMENT_SIGNING_SECRET="..."
 *   node scripts/send-reengagement-campaign.js                       # dry-run vague 1
 *   node scripts/send-reengagement-campaign.js --apply               # vague 1 réelle
 *   node scripts/send-reengagement-campaign.js --apply --daily-cap=150 --delay=250
 *   node scripts/send-reengagement-campaign.js --wave=2 --days-after=14   # dry-run relance J+14
 *   node scripts/send-reengagement-campaign.js --wave=2 --apply
 *
 * Vague 1 sur 428 contacts : 2-3 jours d'envoi à 150-200/jour (relancer le
 * script chaque jour, il reprend où il en est grâce au marquage).
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const {buildReengageUrl, buildEmailA, buildEmailB, buildEmailC} = require('./reengagement-content');

// ---------------------------------------------------------------- arguments
const APPLY = process.argv.includes('--apply');
const WAVE = parseInt(
    (process.argv.find((a) => a.startsWith('--wave=')) || '').split('=')[1] || '1', 10);
const DAYS_AFTER = parseInt(
    (process.argv.find((a) => a.startsWith('--days-after=')) || '').split('=')[1] || '14', 10);
const SEGMENT = ((process.argv.find((a) => a.startsWith('--segment=')) || '').split('=')[1] || 'ALL').toUpperCase();
const LIMIT = parseInt(
    (process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const DAILY_CAP = parseInt(
    (process.argv.find((a) => a.startsWith('--daily-cap=')) || '').split('=')[1] || '200', 10);
const DELAY_MS = parseInt(
    (process.argv.find((a) => a.startsWith('--delay=')) || '').split('=')[1] || '250', 10);
const FRESH_OPTIN_DAYS = 30; // vague 1 : opt-ins de moins de 30 j laissés au funnel normal

if (WAVE < 1 || !['A', 'B', 'ALL'].includes(SEGMENT)) {
  console.error('❌ Arguments invalides : --wave>=1, --segment=A|B|ALL');
  process.exit(1);
}
if (WAVE >= 2 && SEGMENT === 'B') {
  console.error('❌ La relance (vague >= 2) n\'a pour l\'instant d\'email que pour le segment A.');
  process.exit(1);
}

const API_KEY = process.env.MAILJET_API_KEY;
const API_SECRET = process.env.MAILJET_API_SECRET;
if (!API_KEY || !API_SECRET) {
  console.error('❌ MAILJET_API_KEY et MAILJET_API_SECRET requis');
  process.exit(1);
}
if (!process.env.REENGAGEMENT_SIGNING_SECRET) {
  console.error('❌ REENGAGEMENT_SIGNING_SECRET requis (liens signés)');
  process.exit(1);
}
const AUTH = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

// ---------------------------------------------------------------- helpers
function mailjet(method, pathUrl, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.mailjet.com',
      path: pathUrl,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${AUTH}`,
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}),
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(d); } catch { /* noop */ }
        resolve({status: res.statusCode, json, raw: d});
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Appel Mailjet avec 3 tentatives (réseau instable). */
async function mailjetRetry(method, pathUrl, body) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await mailjet(method, pathUrl, body);
    } catch (e) {
      lastError = e;
      if (attempt < 3) {
        console.warn(`⚠️ Tentative ${attempt}/3 échouée (${e.code || e.message}), nouvel essai…`);
        await sleep(800 * attempt);
      }
    }
  }
  throw lastError;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Vérifie/crée les propriétés Mailjet utilisées par la campagne
 * (Mailjet refuse d'écrire une propriété non déclarée : erreur 400
 * « Invalid key name »). Idempotent.
 */
async function ensureReengagementProperties() {
  for (const name of ['reengagement_sent', 'reengagement_wave']) {
    const r = await mailjetRetry('POST', '/v3/REST/contactmetadata', {Name: name, Datatype: 'str'});
    if (r.status === 200 || r.status === 201) {
      console.log(`✅ Propriété Mailjet prête : ${name}`);
    } else if (r.status === 400 && r.raw.includes('already exists')) {
      console.log(`ℹ️ Propriété Mailjet déjà existante : ${name}`);
    } else {
      console.error(`❌ Création propriété ${name}: ${r.status} ${r.raw.slice(0, 150)}`);
    }
  }
}

/** Récupère tous les contacts Mailjet (paginé) avec leurs propriétés. */
async function fetchMailjetContacts() {
  const contacts = [];
  let offset = 0;
  while (true) {
    const r = await mailjetRetry('GET', `/v3/REST/contact?Limit=100&Offset=${offset}`);
    const data = (r.json && r.json.Data) || [];
    contacts.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }

  const enriched = [];
  for (const c of contacts) {
    const props = {};
    const r = await mailjetRetry('GET', `/v3/REST/contactdata/${encodeURIComponent(c.Email)}`);
    if (r.status === 200 && r.json && r.json.Data && r.json.Data.length && r.json.Data[0].Data) {
      r.json.Data[0].Data.forEach((i) => { if (i.Name) props[i.Name] = i.Value; });
    }
    enriched.push({
      email: c.Email.toLowerCase(),
      firstname: String(props.firstname || props.prenom || '').trim(),
      reengagementSent: props.reengagement_sent || null,
      reengagementWave: parseInt(props.reengagement_wave || '0', 10) || 0,
      estClient: props.est_client === 'True' || props.est_client === true,
    });
    await sleep(150); // limite de débit API Mailjet
  }
  return enriched;
}

/** Met à jour (fusion) les propriétés Mailjet d'un contact. */
async function updateMailjetProperties(email, properties) {
  const existing = {};
  const r = await mailjetRetry('GET', `/v3/REST/contactdata/${encodeURIComponent(email)}`);
  if (r.status === 200 && r.json && r.json.Data && r.json.Data.length && r.json.Data[0].Data) {
    r.json.Data[0].Data.forEach((i) => { if (i.Name) existing[i.Name] = i.Value; });
  }
  const merged = {...existing, ...properties};
  const dataArray = Object.entries(merged).map(([k, v]) => ({Name: k, Value: String(v)}));
  const up = await mailjetRetry('PUT', `/v3/REST/contactdata/${encodeURIComponent(email)}`, {Data: dataArray});
  if (up.status !== 200) {
    throw new Error(`Mailjet contactdata ${up.status}: ${up.raw.slice(0, 200)}`);
  }
}

/** Envoi transactionnel v3.1. */
async function sendMailjetEmail(to, subject, html, text) {
  const payload = {
    Messages: [{
      From: {Email: 'fluance@actu.fluance.io', Name: 'Cédric de Fluance'},
      To: [{Email: to}],
      Subject: subject,
      TextPart: text,
      HTMLPart: html,
    }],
  };
  const r = await mailjetRetry('POST', '/v3.1/send', payload);
  if (r.status !== 200) {
    throw new Error(`Mailjet send ${r.status}: ${r.raw.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------- exclusions
function isInternalOrTest(email) {
  const e = email.toLowerCase();
  if (e.endsWith('@fluance.io') || e.endsWith('@actu.fluance.io')) return true;
  if (e.startsWith('support@')) return true;
  if (e.startsWith('cedricjourney')) return true; // comptes admin/test
  if (e.startsWith('c.vonlanthen')) return true;  // comptes test
  if (e.includes('+test')) return true;           // alias test
  return false;
}

// ---------------------------------------------------------------- Firestore
async function initDb() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'fluance-protected-content',
      credential: admin.credential.applicationDefault(),
    });
  }
  return admin.firestore();
}

// ---------------------------------------------------------------- plan
async function buildPlan(db, mailjetContacts) {
  // Tokens de confirmation (Firestore) groupés par email
  const tokensByEmail = {};
  const snap = await db.collection('newsletterConfirmations').get();
  snap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    if (!email) return;
    tokensByEmail[email] = tokensByEmail[email] || {hasConfirmed: false, hasPending: false, lastConfirmedAt: 0};
    if (data.confirmed === true) {
      tokensByEmail[email].hasConfirmed = true;
      const ts = data.confirmedAt?._seconds || data.createdAt?._seconds || 0;
      if (ts > tokensByEmail[email].lastConfirmedAt) tokensByEmail[email].lastConfirmedAt = ts;
    } else {
      tokensByEmail[email].hasPending = true;
    }
  });

  // Clients (produits achetés) → jamais ré-engagés
  const clientEmails = new Set();
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    if (!email) return;
    const products = data.products || (data.product ? [{name: data.product}] : []);
    if (products.length > 0) clientEmails.add(email);
  });

  // Clics de ré-engagement (endpoint reengage5jours) → dernier clic par email
  const lastClickByEmail = new Map();
  const clicksSnap = await db.collection('reengagementClicks').get();
  clicksSnap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    const ts = (data.clickedAt?._seconds || 0) * 1000;
    if (email && ts && ts > (lastClickByEmail.get(email) || 0)) lastClickByEmail.set(email, ts);
  });

  const byEmail = new Map(mailjetContacts.map((c) => [c.email, c]));
  const now = Date.now();
  const segmentA = [];
  const segmentB = [];

  for (const [email, tok] of Object.entries(tokensByEmail)) {
    if (isInternalOrTest(email)) continue;
    if (clientEmails.has(email)) continue;

    const mc = byEmail.get(email);
    if (mc && mc.estClient) continue;

    const segment = tok.hasConfirmed ? 'A' : (tok.hasPending ? 'B' : null);
    if (!segment) continue;
    if (SEGMENT !== 'ALL' && SEGMENT !== segment) continue;

    if (WAVE === 1) {
      // Vague 1 : jamais contacté + opt-in de plus de 30 jours (funnel normal sinon)
      if (mc && mc.reengagementWave >= 1) continue;
      const lastOptin = tok.lastConfirmedAt * 1000;
      if (lastOptin && (now - lastOptin) < FRESH_OPTIN_DAYS * 86400000) continue;
    } else {
      // Vagues suivantes : contacté à la vague précédente, délai écoulé, sans clic
      if (!mc || mc.reengagementWave !== WAVE - 1) continue;
      const sentTs = mc.reengagementSent ? new Date(mc.reengagementSent).getTime() : 0;
      if (isNaN(sentTs) || (now - sentTs) < DAYS_AFTER * 86400000) continue;
      const lastClick = lastClickByEmail.get(email) || 0;
      if (lastClick > sentTs) continue; // a déjà cliqué → pas de relance
    }

    const firstname = (mc && mc.firstname) || '';
    if (segment === 'A') segmentA.push({email, firstname});
    else segmentB.push({email, firstname});
  }

  return {segmentA, segmentB};
}

// ---------------------------------------------------------------- envoi
async function sendCampaign(db, plan) {
  const {segmentA, segmentB} = plan;
  const total = segmentA.length + segmentB.length;
  let sent = 0;
  let errors = 0;
  const csvRows = ['email,segment,wave,firstname,statut,detail'];

  // ── Cap journalier (plan gratuit Mailjet : 200 envois/jour) ──────────────
  // Compte les envois de ré-engagement d'aujourd'hui (Firestore) et bride la
  // taille de ce run au budget restant. Penser à réserver une marge pour les
  // autres envois du compte (emails de contenu, confirmations, relances…).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaySends = await db.collection('reengagementSends')
      .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .count()
      .get();
  const alreadyToday = todaySends.data().count;
  const remaining = Math.max(0, DAILY_CAP - alreadyToday);

  if (remaining <= 0) {
    console.log(`\n⛔ Cap journalier atteint : ${alreadyToday}/${DAILY_CAP} envoyés aujourd'hui.`);
    console.log('   Relancez le script demain pour la suite.');
    return;
  }

  const limit = LIMIT > 0 ? Math.min(LIMIT, remaining) : remaining;
  const all = [
    ...segmentA.map((r) => ({...r, segment: 'A'})),
    ...segmentB.map((r) => ({...r, segment: 'B'})),
  ].slice(0, limit);

  const label = WAVE === 1 ? 'email initial (A/B)' : `relance (email C, J+${DAYS_AFTER})`;
  console.log(`\n📤 Vague ${WAVE} — envoi de ${all.length}/${total} email(s) ` +
    `(A=${segmentA.length}, B=${segmentB.length}, ${label})`);
  console.log(`   📅 Cap journalier : ${alreadyToday}/${DAILY_CAP} déjà envoyés aujourd'hui` +
    ` → budget ce run : ${limit}`);
  if (total > limit) {
    console.log(`   ℹ️  ${total - limit} restant(s) à envoyer demain (ou via --limit/--daily-cap).`);
  }
  console.log('');

  for (const rec of all) {
    try {
      const cta = buildReengageUrl(rec.email, rec.firstname);
      const mail = WAVE === 1
        ? (rec.segment === 'A' ? buildEmailA(rec.firstname, cta) : buildEmailB(rec.firstname, cta))
        : buildEmailC(rec.firstname, cta);
      await sendMailjetEmail(rec.email, mail.subject, mail.html, mail.text);

      // Marquage vague (jamais re-ciblé deux fois dans la même vague)
      await updateMailjetProperties(rec.email, {
        reengagement_sent: new Date().toISOString(),
        reengagement_wave: String(WAVE),
      });
      await db.collection('reengagementSends').add({
        email: rec.email,
        segment: rec.segment,
        wave: WAVE,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        link: cta,
      });

      sent++;
      console.log(`✅ [${rec.segment}/v${WAVE}] ${rec.email} — ${mail.subject.slice(0, 50)}`);
      csvRows.push(`${rec.email},${rec.segment},${WAVE},${rec.firstname},envoyé,ok`);
    } catch (e) {
      errors++;
      console.error(`❌ [${rec.segment}/v${WAVE}] ${rec.email}: ${e.message}`);
      csvRows.push(`${rec.email},${rec.segment},${WAVE},${rec.firstname},erreur,${e.message.slice(0, 80)}`);
    }
    await sleep(DELAY_MS);
  }

  const file = path.join(__dirname, `reengagement_wave${WAVE}_${new Date().toISOString().slice(0, 10)}.csv`);
  fs.writeFileSync(file, csvRows.join('\n') + '\n');
  console.log(`\n📄 Rapport : ${file}`);
  console.log(`✅ ${sent} envoyé(s), ${errors} erreur(s)`);
}

// ---------------------------------------------------------------- main
async function main() {
  const db = await initDb();
  await ensureReengagementProperties();
  const mailjetContacts = await fetchMailjetContacts();
  console.log(`📇 ${mailjetContacts.length} contacts Mailjet chargés`);

  const plan = await buildPlan(db, mailjetContacts);
  const total = plan.segmentA.length + plan.segmentB.length;
  console.log(`\n📊 Vague ${WAVE}${WAVE === 1 ? '' : ` (J+${DAYS_AFTER}, non-cliqueurs de la vague ${WAVE - 1})`} :`);
  console.log(`  Segment A (DOI confirmé) : ${plan.segmentA.length}`);
  console.log(`  Segment B (sans DOI)     : ${plan.segmentB.length}`);
  console.log(`  Total                    : ${total}`);

  if (!APPLY) {
    console.log('\n— Aperçu (5 premiers) —');
    [...plan.segmentA.slice(0, 5).map((r) => `  A | ${r.email} | ${r.firstname || '(sans prénom)'}`),
      ...plan.segmentB.slice(0, 5).map((r) => `  B | ${r.email} | ${r.firstname || '(sans prénom)'}`)]
        .forEach((l) => console.log(l));
    console.log('\nDry-run : rien envoyé. Relancez avec --apply pour envoyer.');
    return;
  }

  await sendCampaign(db, plan);
}

main().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
