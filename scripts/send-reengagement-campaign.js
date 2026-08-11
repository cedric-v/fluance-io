#!/usr/bin/env node

/**
 * Campagne de ré-engagement « 5 jours » — envoi segmenté.
 *
 * Segments :
 *  - A : contacts avec double opt-in CONFIRMÉ   → email « vos 5 jours offerts » (1 clic → jour 1)
 *  - B : contacts SANS confirmation (tokens expirés) → email « cadeau + confirmation » (nouveau DOI)
 *
 * Exclusions automatiques : clients (produits achetés), comptes internes/test,
 * contacts déjà ré-engagés (propriété `reengagement_sent`), opt-ins récents (< 30 j,
 * encore dans le funnel normal).
 *
 * Marquage après envoi : propriété Mailjet `reengagement_sent` + log Firestore
 * (collection `reengagementSends`), pour ne jamais re-cibler deux fois.
 *
 * Sunset (RGPD + hygiène de liste) : contacts ré-engagés il y a ≥ 30 jours sans
 * action → suppression Mailjet + tokens Firestore.
 *
 * Usage :
 *   export MAILJET_API_KEY="..." MAILJET_API_SECRET="..." REENGAGEMENT_SIGNING_SECRET="..."
 *   node scripts/send-reengagement-campaign.js                 # dry-run (plan)
 *   node scripts/send-reengagement-campaign.js --apply         # envoi réel
 *   node scripts/send-reengagement-campaign.js --apply --limit=100 --delay=200
 *   node scripts/send-reengagement-campaign.js --sunset        # dry-run sunset
 *   node scripts/send-reengagement-campaign.js --sunset --apply
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const {buildReengageUrl, buildEmailA, buildEmailB} = require('./reengagement-content');

// ---------------------------------------------------------------- arguments
const APPLY = process.argv.includes('--apply');
const SUNSET = process.argv.includes('--sunset');
const LIMIT = parseInt(
    (process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const DELAY_MS = parseInt(
    (process.argv.find((a) => a.startsWith('--delay=')) || '').split('=')[1] || '150', 10);
const SUNSET_DAYS = 30;
const FRESH_OPTIN_DAYS = 30; // opt-ins de moins de 30 j : laissés au funnel normal

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Récupère tous les contacts Mailjet (paginé) avec leurs propriétés. */
async function fetchMailjetContacts() {
  const contacts = [];
  let offset = 0;
  while (true) {
    const r = await mailjet('GET', `/v3/REST/contact?Limit=100&Offset=${offset}`);
    const data = (r.json && r.json.Data) || [];
    contacts.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }

  const enriched = [];
  for (const c of contacts) {
    const props = {};
    const r = await mailjet('GET', `/v3/REST/contactdata/${encodeURIComponent(c.Email)}`);
    if (r.status === 200 && r.json && r.json.Data && r.json.Data.length && r.json.Data[0].Data) {
      r.json.Data[0].Data.forEach((i) => { if (i.Name) props[i.Name] = i.Value; });
    }
    enriched.push({
      email: c.Email.toLowerCase(),
      firstname: String(props.firstname || props.prenom || '').trim(),
      reengagementSent: props.reengagement_sent || null,
      estClient: props.est_client === 'True' || props.est_client === true,
      serie5joursDebut: props.serie_5jours_debut || null,
      sourceOptin: props.source_optin || '',
    });
    await sleep(40);
  }
  return enriched;
}

/** Met à jour (fusion) les propriétés Mailjet d'un contact. */
async function updateMailjetProperties(email, properties) {
  const existing = {};
  const r = await mailjet('GET', `/v3/REST/contactdata/${encodeURIComponent(email)}`);
  if (r.status === 200 && r.json && r.json.Data && r.json.Data.length && r.json.Data[0].Data) {
    r.json.Data[0].Data.forEach((i) => { if (i.Name) existing[i.Name] = i.Value; });
  }
  const merged = {...existing, ...properties};
  const dataArray = Object.entries(merged).map(([k, v]) => ({Name: k, Value: String(v)}));
  const up = await mailjet('PUT', `/v3/REST/contactdata/${encodeURIComponent(email)}`, {Data: dataArray});
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
  const r = await mailjet('POST', '/v3.1/send', payload);
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

// ---------------------------------------------------------------- plan d'envoi
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

  // Clients (produits achetés) → ne jamais ré-engager ni supprimer
  const clientEmails = new Set();
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    if (!email) return;
    const products = data.products || (data.product ? [{name: data.product}] : []);
    if (products.length > 0) clientEmails.add(email);
  });

  const byEmail = new Map(mailjetContacts.map((c) => [c.email, c]));
  const now = Date.now();
  const segmentA = [];
  const segmentB = [];

  for (const [email, tok] of Object.entries(tokensByEmail)) {
    if (isInternalOrTest(email)) continue;
    if (clientEmails.has(email)) continue;

    const mc = byEmail.get(email);
    if (mc && mc.reengagementSent) continue;        // déjà contacté
    if (mc && mc.estClient) continue;               // client côté Mailjet

    // Opt-ins récents (< 30 j) : laissés au funnel normal (séquence automatique)
    const lastOptin = tok.lastConfirmedAt * 1000;
    if (lastOptin && (now - lastOptin) < FRESH_OPTIN_DAYS * 86400000) continue;

    const firstname = (mc && mc.firstname) || '';
    if (tok.hasConfirmed) {
      segmentA.push({email, firstname});
    } else if (tok.hasPending) {
      segmentB.push({email, firstname});
    }
  }

  return {segmentA, segmentB};
}

// ---------------------------------------------------------------- envoi
async function sendCampaign(db, plan) {
  const {segmentA, segmentB} = plan;
  const total = segmentA.length + segmentB.length;
  let sent = 0;
  let errors = 0;
  const csvRows = ['email,segment,firstname,statut,detail'];

  const limit = LIMIT > 0 ? LIMIT : total;
  const all = [
    ...segmentA.map((r) => ({...r, segment: 'A'})),
    ...segmentB.map((r) => ({...r, segment: 'B'})),
  ].slice(0, limit);

  console.log(`\n📤 Envoi de ${all.length}/${total} email(s)` +
    ` (A=${segmentA.length}, B=${segmentB.length}, limit=${limit}, délai=${DELAY_MS}ms)\n`);

  for (const rec of all) {
    try {
      const cta = buildReengageUrl(rec.email, rec.firstname);
      const mail = rec.segment === 'A' ? buildEmailA(rec.firstname, cta) : buildEmailB(rec.firstname, cta);
      await sendMailjetEmail(rec.email, mail.subject, mail.html, mail.text);

      // Marquage (ne jamais re-cibler deux fois)
      await updateMailjetProperties(rec.email, {reengagement_sent: new Date().toISOString()});
      await db.collection('reengagementSends').add({
        email: rec.email,
        segment: rec.segment,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        link: cta,
      });

      sent++;
      console.log(`✅ [${rec.segment}] ${rec.email} — ${mail.subject.slice(0, 55)}`);
      csvRows.push(`${rec.email},${rec.segment},${rec.firstname},envoyé,ok`);
    } catch (e) {
      errors++;
      console.error(`❌ [${rec.segment}] ${rec.email}: ${e.message}`);
      csvRows.push(`${rec.email},${rec.segment},${rec.firstname},erreur,${e.message.slice(0, 80)}`);
    }
    await sleep(DELAY_MS);
  }

  const file = path.join(__dirname, `reengagement_plan_${new Date().toISOString().slice(0, 10)}.csv`);
  fs.writeFileSync(file, csvRows.join('\n') + '\n');
  console.log(`\n📄 Rapport : ${file}`);
  console.log(`✅ ${sent} envoyé(s), ${errors} erreur(s)`);
}

// ---------------------------------------------------------------- sunset
async function sunset(db, mailjetContacts) {
  const now = Date.now();
  const cutoff = now - SUNSET_DAYS * 86400000;

  // Clients → jamais supprimés
  const clientEmails = new Set();
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach((d) => {
    const data = d.data();
    if (data.email) clientEmails.add(data.email.toLowerCase());
  });

  // Ré-optins depuis la date de ré-engagement
  const reOptinAfter = new Map();
  const snap = await db.collection('newsletterConfirmations').get();
  snap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    const ts = (data.confirmedAt?._seconds || 0) * 1000;
    if (email && ts && ts > (reOptinAfter.get(email) || 0)) reOptinAfter.set(email, ts);
  });

  const candidates = mailjetContacts.filter((c) => {
    if (!c.reengagementSent) return false;
    const sentTs = new Date(c.reengagementSent).getTime();
    if (isNaN(sentTs) || sentTs > cutoff) return false;   // pas encore 30 jours
    if (clientEmails.has(c.email)) return false;          // client
    if (c.estClient) return false;                        // client (Mailjet)
    if (reOptinAfter.get(c.email) > sentTs) return false; // a ré-opté depuis
    const serieTs = c.serie5joursDebut ? new Date(c.serie5joursDebut).getTime() : 0;
    if (!isNaN(serieTs) && serieTs > sentTs) return false; // série redémarrée depuis
    return true;
  });

  console.log(`\n🧹 Sunset (${SUNSET_DAYS} j sans action) : ${candidates.length} contact(s)`);
  if (!APPLY) {
    candidates.slice(0, 30).forEach((c) =>
      console.log(`  - ${c.email} (ré-engagé le ${c.reengagementSent.slice(0, 10)})`));
    if (candidates.length > 30) console.log(`  … et ${candidates.length - 30} autres`);
    console.log('\nDry-run : rien supprimé. Relancez avec --apply pour supprimer.');
    return;
  }

  let deleted = 0;
  let errors = 0;
  for (const c of candidates) {
    try {
      // Suppression du contact Mailjet
      const del = await mailjet('DELETE', `/v3/REST/contact/${encodeURIComponent(c.email)}`);
      if (del.status !== 200 && del.status !== 204 && del.status !== 404) {
        throw new Error(`DELETE ${del.status}: ${del.raw.slice(0, 150)}`);
      }
      // Suppression des tokens de confirmation associés
      const tokens = await db.collection('newsletterConfirmations')
          .where('email', '==', c.email).get();
      const delPromises = [];
      tokens.forEach((d) => delPromises.push(d.ref.delete()));
      await Promise.all(delPromises);
      // Trace
      await db.collection('reengagementSends').add({
        email: c.email,
        action: 'sunset',
        sunsetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      deleted++;
      console.log(`✅ supprimé : ${c.email}`);
    } catch (e) {
      errors++;
      console.error(`❌ ${c.email}: ${e.message}`);
    }
    await sleep(80);
  }
  console.log(`\n✅ ${deleted} contact(s) supprimé(s), ${errors} erreur(s)`);
}

// ---------------------------------------------------------------- main
async function main() {
  const db = await initDb();
  const mailjetContacts = await fetchMailjetContacts();
  console.log(`📇 ${mailjetContacts.length} contacts Mailjet chargés`);

  if (SUNSET) {
    await sunset(db, mailjetContacts);
    return;
  }

  const plan = await buildPlan(db, mailjetContacts);
  console.log(`\n📊 Plan de ré-engagement :`);
  console.log(`  Segment A (DOI confirmé)   : ${plan.segmentA.length}`);
  console.log(`  Segment B (sans DOI)       : ${plan.segmentB.length}`);
  console.log(`  Total                      : ${plan.segmentA.length + plan.segmentB.length}`);

  if (!APPLY) {
    console.log('\n— Aperçu segment A (5 premiers) —');
    plan.segmentA.slice(0, 5).forEach((r) => console.log(`  A | ${r.email} | ${r.firstname || '(sans prénom)'}`));
    console.log('— Aperçu segment B (5 premiers) —');
    plan.segmentB.slice(0, 5).forEach((r) => console.log(`  B | ${r.email} | ${r.firstname || '(sans prénom)'}`));
    console.log('\nDry-run : rien envoyé. Relancez avec --apply pour envoyer.');
    return;
  }

  await sendCampaign(db, plan);
}

main().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
