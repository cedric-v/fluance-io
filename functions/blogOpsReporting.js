/**
 * Fonctions pures du reporting ops blogs (digests, rapports de soucis, alertes).
 *
 * Aucune dependance a firebase-admin: tout est testable sans emulateur.
 * Les fonctions dependentes de Firestore/env restent dans index.js.
 */

const BLOG_OPS_RUNBOOK_URL = 'https://github.com/cedric-v/fluance-io/blob/main/docs/leads-runbook.md';

const FLUANCE_OPS_SUMMARY_KEY = 'fluance';
const FLUANCE_OPS_SUMMARY_LABEL = 'Fluance';
const FLUANCE_PENDING_SOURCE_OPTINS = new Set([
  '2pratiques',
  '5joursofferts',
  'stages',
  'presentiel',
]);

/**
 * Liens actionnables a inclure dans les e-mails ops:
 * logs de la fonction concernee et runbook d'exploitation.
 */
function buildOpsFooterLinks(functionName) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  const logsUrl = projectId ?
    `https://console.firebase.google.com/u/0/project/${projectId}/functions/logs?functionFilter=${functionName}` :
    null;

  const links = [];
  if (logsUrl) {
    links.push({label: 'Logs de la fonction', url: logsUrl});
  }
  links.push({label: 'Runbook ops', url: BLOG_OPS_RUNBOOK_URL});
  return links;
}

function formatOpsFooterHtml(links) {
  const items = links.map((link) => `<a href="${link.url}">${link.label}</a>`).join(' &middot; ');
  return `<p style="margin:20px 0 0;font-size:13px;color:#6b655c;">Liens utiles: ${items}</p>`;
}

function formatOpsFooterText(links) {
  return links.map((link) => `- ${link.label}: ${link.url}`).join('\n');
}

function buildBlogOpsSummaries(siteConfigs = {}) {
  const summaries = {};

  Object.keys(siteConfigs).forEach((siteId) => {
    const site = siteConfigs[siteId];
    summaries[siteId] = {
      siteId,
      label: site.siteLabel,
      blogSource: site.blogSource,
      optins: 0,
      confirmations: 0,
      pending: 0,
      reminders: 0,
      contacts: 0,
      turnstileFailures: 0,
      mailjetFailures: 0,
      internalErrors: 0,
    };
  });

  return summaries;
}

function ensureBlogSummary(summaries, siteId, fallbackBlogSource = '', fallbackLabel = '') {
  if (siteId && summaries[siteId]) {
    return summaries[siteId];
  }

  const key = siteId || 'inconnu';
  if (!summaries[key]) {
    summaries[key] = {
      siteId: key,
      label: fallbackLabel || key,
      blogSource: fallbackBlogSource || '',
      optins: 0,
      confirmations: 0,
      pending: 0,
      reminders: 0,
      contacts: 0,
      turnstileFailures: 0,
      mailjetFailures: 0,
      internalErrors: 0,
    };
  }

  return summaries[key];
}

function resolvePendingDigestSummary(data) {
  if (data.siteSource) {
    return {
      siteId: data.siteSource,
      blogSource: data.blogSource || '',
      label: '',
    };
  }

  if (FLUANCE_PENDING_SOURCE_OPTINS.has(data.sourceOptin)) {
    return {
      siteId: FLUANCE_OPS_SUMMARY_KEY,
      blogSource: '',
      label: FLUANCE_OPS_SUMMARY_LABEL,
    };
  }

  return {
    siteId: '',
    blogSource: data.blogSource || '',
    label: '',
  };
}

/**
 * Applique un evenement du journal des leads a un resume de site.
 * Alimente aussi la liste des erreurs critiques le cas echeant.
 */
function applyLeadEventToSummary(data, summary, criticalErrors) {
  switch (data.type_evenement) {
    case 'optin_capture_success':
      summary.optins++;
      break;
    case 'optin_confirmed':
      summary.confirmations++;
      break;
    case 'doi_reminder_sent':
      summary.reminders++;
      break;
    case 'turnstile_failed_optin':
      summary.turnstileFailures++;
      break;
    case 'mailjet_send_failed_optin':
    case 'mailjet_send_failed_doi_reminder':
    case 'mailjet_send_failed_contact':
      summary.mailjetFailures++;
      criticalErrors.push(`${summary.label}: ${data.type_evenement} pour ${data.email || 'email inconnu'}`);
      break;
    case 'capture_lead_internal_error':
    case 'send_contact_internal_error':
    case 'doi_reminder_processing_error':
      summary.internalErrors++;
      criticalErrors.push(`${summary.label}: ${data.type_evenement} - ${data.error_message || 'sans detail'}`);
      break;
    default:
      break;
  }
}

/** Applique un formulaire de contact journalise a un resume de site. */
function applyContactFormToSummary(data, summary) {
  if (data.statut === 'envoye') {
    summary.contacts++;
  } else if (data.statut === 'echec_turnstile') {
    summary.turnstileFailures++;
  }
}

function formatOpsDigestHtml({
  title,
  dateLabel,
  summaries,
  criticalErrors,
  pendingTotal,
  warnings = [],
  footerLinks = [],
  introLabel = 'des 24 dernieres heures',
}) {
  const rows = Object.values(summaries)
      .map((item) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;">${item.label}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">${item.optins}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">${item.confirmations}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">${item.pending}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">${item.reminders}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">${item.contacts}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">
            ${item.turnstileFailures}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e7e1d8;text-align:center;">
            ${item.mailjetFailures + item.internalErrors}
          </td>
        </tr>`)
      .join('');

  const signalItems = [
    ...warnings.map((warning) => `<li>⚠️ ${warning}</li>`),
    ...criticalErrors.map((item) => `<li>${item}</li>`),
  ];

  const errorItems = signalItems.length > 0 ?
    signalItems.join('') :
    '<li>Aucune erreur critique detectee sur 24h.</li>';

  return `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#2d2a26;">
      <h1 style="font-size:24px;margin:0 0 16px;">${title} - ${dateLabel}</h1>
      <p style="margin:0 0 18px;">
        Vue operationnelle ${introLabel}. DOI en attente ouverts:
        <strong>${pendingTotal}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#fffaf4;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#efe4d6;">
            <th style="padding:10px;text-align:left;">Blog</th>
            <th style="padding:10px;">Opt-ins</th>
            <th style="padding:10px;">Confirmations</th>
            <th style="padding:10px;">DOI en attente</th>
            <th style="padding:10px;">Relances</th>
            <th style="padding:10px;">Contacts</th>
            <th style="padding:10px;">Echecs Turnstile</th>
            <th style="padding:10px;">Erreurs</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h2 style="font-size:18px;margin:24px 0 10px;">Erreurs critiques et signaux</h2>
      <ul>${errorItems}</ul>
      ${footerLinks.length > 0 ? formatOpsFooterHtml(footerLinks) : ''}
    </div>
  `.trim();
}

function formatOpsDigestText({
  title,
  dateLabel,
  summaries,
  criticalErrors,
  pendingTotal,
  warnings = [],
  footerLinks = [],
}) {
  const lines = [
    `${title} - ${dateLabel}`,
    '',
    `DOI en attente ouverts: ${pendingTotal}`,
    '',
  ];

  Object.values(summaries).forEach((item) => {
    lines.push(
        `${item.label}: ${item.optins} opt-ins, ${item.confirmations} confirmations, ` +
        `${item.pending} DOI en attente, ${item.reminders} relances, ` +
        `${item.contacts} contacts, ${item.turnstileFailures} echecs Turnstile, ` +
        `${item.mailjetFailures + item.internalErrors} erreurs`,
    );
  });

  lines.push('', 'Erreurs critiques et signaux:');
  warnings.forEach((warning) => lines.push(`- ATTENTION: ${warning}`));
  if (criticalErrors.length > 0) {
    criticalErrors.forEach((item) => lines.push(`- ${item}`));
  } else if (warnings.length === 0) {
    lines.push('- Aucune erreur critique detectee sur 24h.');
  }

  if (footerLinks.length > 0) {
    lines.push('', 'Liens utiles:', formatOpsFooterText(footerLinks));
  }

  return lines.join('\n');
}

function formatOpsAlertHtml({title, lines, footerLinks = []}) {
  const footer = footerLinks.length > 0 ? formatOpsFooterHtml(footerLinks) : '';
  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#2d2a26;">
      <h1 style="font-size:22px;margin:0 0 16px;">${title}</h1>
      <ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>
      ${footer}
    </div>
  `.trim();
}

function formatOpsAlertText({title, lines, footerLinks = []}) {
  const footer = footerLinks.length > 0 ? ['', 'Liens utiles:', formatOpsFooterText(footerLinks)] : [];
  return [title, '', ...lines.map((line) => `- ${line}`), ...footer].join('\n');
}

module.exports = {
  BLOG_OPS_RUNBOOK_URL,
  FLUANCE_PENDING_SOURCE_OPTINS,
  buildBlogOpsSummaries,
  ensureBlogSummary,
  resolvePendingDigestSummary,
  applyLeadEventToSummary,
  applyContactFormToSummary,
  buildOpsFooterLinks,
  formatOpsFooterHtml,
  formatOpsFooterText,
  formatOpsDigestHtml,
  formatOpsDigestText,
  formatOpsAlertHtml,
  formatOpsAlertText,
};
