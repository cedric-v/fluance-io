#!/usr/bin/env node

/**
 * Tableau de bord du ré-engagement « 5 jours » (vague 1).
 *
 * Affiche par jour (depuis le début de la campagne) :
 *   envoyés · clics · taux de clic · ré-optins confirmés · désinscrits
 * + totaux et taux de conversion, + estimation des candidats relance J+14.
 *
 * Sources :
 *  - Firestore `reengagementSends` (envois, wave + sentAt)
 *  - Firestore `reengagementClicks` (clics journalisés par l'endpoint)
 *  - Firestore `newsletterConfirmations` (ré-optins : tokens confirmés depuis
 *    le début de la campagne, pour des destinataires de la vague 1)
 *  - Mailjet `listrecipient` (désinscriptions sur la liste principale)
 *
 * Usage :
 *   export MAILJET_API_KEY="..." MAILJET_API_SECRET="..."
 *   node scripts/reengagement-monitor.js
 */

const https = require('https');
const {initializeApp, applicationDefault} = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');

const API_KEY = process.env.MAILJET_API_KEY;
const API_SECRET = process.env.MAILJET_API_SECRET;
if (!API_KEY || !API_SECRET) {
  console.error('❌ MAILJET_API_KEY et MAILJET_API_SECRET requis');
  process.exit(1);
}
const AUTH = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
const LIST_ID = 10524140;
const RELANCE_DAYS = 14; // fenêtre de relance (non-cliqueurs)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mailjet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.mailjet.com',
      path,
      method: 'GET',
      headers: {Authorization: `Basic ${AUTH}`},
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
    req.end();
  });
}

const dayKey = (ms) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));

async function main() {
  initializeApp({
    projectId: 'fluance-protected-content',
    credential: applicationDefault(),
  });
  const db = getFirestore();

  // 1) Envois vague 1
  const sends = [];
  const sendsByEmail = new Map();
  const sendsSnap = await db.collection('reengagementSends').get();
  sendsSnap.forEach((d) => {
    const data = d.data();
    if (data.wave !== 1) return;
    const ts = (data.sentAt?._seconds || 0) * 1000;
    sends.push({email: data.email.toLowerCase(), ts, segment: data.segment || 'A', day: dayKey(ts)});
    if (ts > (sendsByEmail.get(data.email.toLowerCase()) || 0)) {
      sendsByEmail.set(data.email.toLowerCase(), ts);
    }
  });
  const sentEmails = new Set(sendsByEmail.keys());
  const campaignStart = Math.min(...sends.map((s) => s.ts));

  // 2) Clics
  const clicks = [];
  const clicksSnap = await db.collection('reengagementClicks').get();
  clicksSnap.forEach((d) => {
    const data = d.data();
    const ts = (data.clickedAt?._seconds || 0) * 1000;
    if (ts >= campaignStart && sentEmails.has((data.email || '').toLowerCase())) {
      clicks.push({email: data.email.toLowerCase(), ts, day: dayKey(ts)});
    }
  });
  // Dernier clic par email (pour les candidats relance)
  const lastClickByEmail = new Map();
  clicks.forEach((c) => {
    if (c.ts > (lastClickByEmail.get(c.email) || 0)) lastClickByEmail.set(c.email, c.ts);
  });

  // 3) Ré-optins (tokens confirmés depuis le début de campagne, destinataires vague 1)
  const reoptins = [];
  const confSnap = await db.collection('newsletterConfirmations').get();
  confSnap.forEach((d) => {
    const data = d.data();
    if (data.confirmed !== true) return;
    const ts = (data.confirmedAt?._seconds || 0) * 1000;
    const email = (data.email || '').toLowerCase();
    if (ts >= campaignStart && sentEmails.has(email)) {
      reoptins.push({email, ts, day: dayKey(ts)});
    }
  });

  // 4) Désinscriptions Mailjet (liste principale) depuis le début de campagne
  const unsubs = [];
  let offset = 0;
  while (true) {
    const r = await mailjet(`/v3/REST/listrecipient?ListID=${LIST_ID}&Limit=100&Offset=${offset}`);
    const data = (r.json && r.json.Data) || [];
    data.forEach((lr) => {
      if (lr.IsUnsubscribed === true && lr.UnsubscribedAt) {
        const ts = new Date(lr.UnsubscribedAt).getTime();
        const email = (lr.ContactEmail || lr.email || '').toLowerCase();
        if (ts >= campaignStart && sentEmails.has(email)) {
          unsubs.push({email, ts, day: dayKey(ts)});
        }
      }
    });
    if (data.length < 100) break;
    offset += 100;
    await sleep(150);
  }

  // 5) Tableau par jour
  const days = [];
  const startDay = new Date(campaignStart);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 0);
  for (let d = new Date(startDay); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(dayKey(d.getTime()));
  }

  const count = (arr, day) => arr.filter((x) => x.day === day).length;

  console.log(`\n📊 Ré-engagement « 5 jours » — vague 1 (début : ${dayKey(campaignStart)})`);
  console.log('═'.repeat(72));
  console.log('Date        | Envoyés | Clics | Taux clic | Ré-optins | Désinscrits');
  console.log('─'.repeat(72));
  for (const day of days) {
    const env = count(sends, day);
    const cli = count(clicks, day);
    const reo = count(reoptins, day);
    const uns = count(unsubs, day);
    const taux = env ? ((cli / env) * 100).toFixed(1) : '—';
    console.log(
        `${day} | ${String(env).padStart(7)} | ${String(cli).padStart(5)} | ` +
        `${String(taux).padStart(8)}% | ${String(reo).padStart(8)} | ${String(uns).padStart(10)}`,
    );
  }
  console.log('─'.repeat(72));
  const totalEnv = sends.length;
  const totalCli = clicks.length;
  const totalReo = reoptins.length;
  const totalUns = unsubs.length;
  console.log(
      `TOTAL       | ${String(totalEnv).padStart(7)} | ${String(totalCli).padStart(5)} | ` +
      `${((totalCli / totalEnv) * 100).toFixed(1).padStart(8)}% | ` +
      `${String(totalReo).padStart(8)} | ${String(totalUns).padStart(10)}`,
  );
  console.log(`\nTaux de clic : ${((totalCli / totalEnv) * 100).toFixed(1)} %` +
    ` · Ré-optins (conversions) : ${((totalReo / totalEnv) * 100).toFixed(1)} %` +
    ` · Désinscrits : ${((totalUns / totalEnv) * 100).toFixed(1)} %`);

  // 6) Candidats relance J+14 (segment A, sans clic, ≥ 14 jours)
  const now = Date.now();
  const relance = [...sendsByEmail.entries()].filter(([email, sentTs]) => {
    const s = sends.find((x) => x.email === email && x.segment === 'A');
    if (!s) return false;
    if ((now - sentTs) < RELANCE_DAYS * 86400000) return false;
    return !lastClickByEmail.has(email);
  });
  console.log(`\n🎯 Relance J+14 : ${relance.length} candidat(s) (segment A, sans clic, ≥ ${RELANCE_DAYS} j)`);
  relance.slice(0, 10).forEach(([email, ts]) =>
    console.log(`   - ${email} (envoyé le ${dayKey(ts)})`));
  if (relance.length > 10) console.log(`   … et ${relance.length - 10} autres`);
}

main().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
