const test = require('node:test');
const assert = require('node:assert');

const {
  buildBlogOpsSummaries,
  ensureBlogSummary,
  resolvePendingDigestSummary,
  applyLeadEventToSummary,
  applyContactFormToSummary,
  buildOpsFooterLinks,
  formatOpsDigestHtml,
  formatOpsDigestText,
  formatOpsAlertText,
} = require('../blogOpsReporting');

const SITE_CONFIGS = {
  'techniquesdemeditation': {siteLabel: 'Techniques de Méditation', blogSource: 'blog-techniques'},
  'vie-explosive': {siteLabel: 'Vie Explosive', blogSource: 'blog-vie-explosive'},
  'fluance': {siteLabel: 'Fluance', blogSource: ''},
};

test('buildBlogOpsSummaries initialise un resume a zero par site connu', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);

  assert.deepStrictEqual(Object.keys(summaries), Object.keys(SITE_CONFIGS));
  Object.values(summaries).forEach((summary) => {
    assert.strictEqual(summary.optins, 0);
    assert.strictEqual(summary.confirmations, 0);
    assert.strictEqual(summary.pending, 0);
    assert.strictEqual(summary.reminders, 0);
    assert.strictEqual(summary.contacts, 0);
    assert.strictEqual(summary.turnstileFailures, 0);
    assert.strictEqual(summary.mailjetFailures, 0);
    assert.strictEqual(summary.internalErrors, 0);
  });
  assert.strictEqual(summaries.techniquesdemeditation.label, 'Techniques de Méditation');
});

test('ensureBlogSummary reutilise le resume existant et cree un resume pour un site inconnu', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);

  const existing = ensureBlogSummary(summaries, 'techniquesdemeditation');
  existing.optins = 3;
  assert.strictEqual(ensureBlogSummary(summaries, 'techniquesdemeditation').optins, 3);

  const unknown = ensureBlogSummary(summaries, '', 'blog-inconnu', 'Blog Inconnu');
  assert.strictEqual(unknown.siteId, 'inconnu');
  assert.strictEqual(unknown.label, 'Blog Inconnu');
  assert.strictEqual(unknown.blogSource, 'blog-inconnu');

  const labeledUnknown = ensureBlogSummary(summaries, 'nouveausite', '', 'Nouveau Site');
  assert.strictEqual(labeledUnknown.siteId, 'nouveausite');
  assert.strictEqual(labeledUnknown.label, 'Nouveau Site');
});

test('resolvePendingDigestSummary route par siteSource puis par optin puis par blogSource', () => {
  assert.deepStrictEqual(
      resolvePendingDigestSummary({siteSource: 'vie-explosive'}),
      {siteId: 'vie-explosive', blogSource: '', label: ''},
  );

  assert.deepStrictEqual(
      resolvePendingDigestSummary({sourceOptin: '5joursofferts'}),
      {siteId: 'fluance', blogSource: '', label: 'Fluance'},
  );

  assert.deepStrictEqual(
      resolvePendingDigestSummary({blogSource: 'blog-techniques'}),
      {siteId: '', blogSource: 'blog-techniques', label: ''},
  );
});

test('applyLeadEventToSummary compte les evenements et alimente les erreurs critiques', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);
  const criticalErrors = [];

  const tech = ensureBlogSummary(summaries, 'techniquesdemeditation');
  applyLeadEventToSummary({type_evenement: 'optin_capture_success'}, tech, criticalErrors);
  applyLeadEventToSummary({type_evenement: 'optin_capture_success'}, tech, criticalErrors);
  applyLeadEventToSummary({type_evenement: 'optin_confirmed'}, tech, criticalErrors);
  applyLeadEventToSummary({type_evenement: 'doi_reminder_sent'}, tech, criticalErrors);
  applyLeadEventToSummary({type_evenement: 'turnstile_failed_optin'}, tech, criticalErrors);

  applyLeadEventToSummary(
      {type_evenement: 'mailjet_send_failed_optin', email: 'user@example.com'},
      tech,
      criticalErrors,
  );
  applyLeadEventToSummary(
      {type_evenement: 'capture_lead_internal_error', error_message: 'boom'},
      tech,
      criticalErrors,
  );

  assert.strictEqual(tech.optins, 2);
  assert.strictEqual(tech.confirmations, 1);
  assert.strictEqual(tech.reminders, 1);
  assert.strictEqual(tech.turnstileFailures, 1);
  assert.strictEqual(tech.mailjetFailures, 1);
  assert.strictEqual(tech.internalErrors, 1);
  assert.strictEqual(criticalErrors.length, 2);
  assert.match(criticalErrors[0], /mailjet_send_failed_optin pour user@example\.com/);
  assert.match(criticalErrors[1], /capture_lead_internal_error - boom/);

  // Evenement inconnu: ni compteur ni erreur critique
  applyLeadEventToSummary({type_evenement: 'type_inconnu'}, tech, criticalErrors);
  assert.strictEqual(criticalErrors.length, 2);
});

test('applyContactFormToSummary compte les formulaires envoyes et les echecs Turnstile', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);
  const summary = ensureBlogSummary(summaries, 'vie-explosive');

  applyContactFormToSummary({statut: 'envoye'}, summary);
  applyContactFormToSummary({statut: 'envoye'}, summary);
  applyContactFormToSummary({statut: 'echec_turnstile'}, summary);
  applyContactFormToSummary({statut: 'autre_statut'}, summary);

  assert.strictEqual(summary.contacts, 2);
  assert.strictEqual(summary.turnstileFailures, 1);
});

test('buildOpsFooterLinks inclut les logs quand le projet est connu, sinon seulement le runbook', () => {
  const original = process.env.GCLOUD_PROJECT;

  process.env.GCLOUD_PROJECT = 'fluance-prod';
  const links = buildOpsFooterLinks('sendBlogLeadsIssueReport');
  assert.strictEqual(links.length, 2);
  assert.match(links[0].url, /console\.firebase\.google\.com.*fluance-prod.*sendBlogLeadsIssueReport/);
  assert.match(links[1].url, /docs\/leads-runbook\.md/);

  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;
  const fallbackLinks = buildOpsFooterLinks('sendBlogLeadsIssueReport');
  assert.strictEqual(fallbackLinks.length, 1);
  assert.strictEqual(fallbackLinks[0].label, 'Runbook ops');

  if (original !== undefined) {
    process.env.GCLOUD_PROJECT = original;
  }
});

test('formatOpsDigestText liste les sites, les avertissements et les erreurs', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);
  const tech = ensureBlogSummary(summaries, 'techniquesdemeditation');
  tech.optins = 5;
  tech.pending = 2;

  const text = formatOpsDigestText({
    title: 'Digest mensuel leads blogs (30 derniers jours)',
    dateLabel: 'février 2026',
    summaries,
    criticalErrors: ['Vie Explosive: mailjet_send_failed_contact pour user@example.org'],
    pendingTotal: 4,
    warnings: ['Seulement 10 rapports quotidiens sur 30 jours attendus'],
    footerLinks: buildOpsFooterLinks('sendBlogLeadsMonthlyDigest'),
  });

  assert.match(text, /Digest mensuel leads blogs \(30 derniers jours\) - février 2026/);
  assert.match(text, /DOI en attente ouverts: 4/);
  assert.match(text, /Techniques de Méditation: 5 opt-ins/);
  assert.match(text, /ATTENTION: Seulement 10 rapports quotidiens/);
  assert.match(text, /Vie Explosive: mailjet_send_failed_contact/);
  assert.match(text, /Liens utiles:/);
});

test('formatOpsDigestText sans erreur ni avertissement affiche le message par defaut', () => {
  const text = formatOpsDigestText({
    title: 'Soucis leads blogs (24h)',
    dateLabel: '01.03.2026',
    summaries: buildBlogOpsSummaries(SITE_CONFIGS),
    criticalErrors: [],
    pendingTotal: 0,
  });

  assert.match(text, /Aucune erreur critique detectee sur 24h/);
  assert.doesNotMatch(text, /Liens utiles:/);
});

test('formatOpsDigestHtml inclut tableau, avertissements et pieds de page', () => {
  const summaries = buildBlogOpsSummaries(SITE_CONFIGS);
  ensureBlogSummary(summaries, 'fluance').optins = 1;

  const html = formatOpsDigestHtml({
    title: 'Digest mensuel leads blogs (30 derniers jours)',
    dateLabel: 'février 2026',
    summaries,
    criticalErrors: [],
    pendingTotal: 1,
    warnings: ['Vie Explosive: aucun opt-in capture sur la periode'],
    footerLinks: [{label: 'Runbook ops', url: 'https://example.com/runbook'}],
    introLabel: 'des 30 derniers jours',
  });

  assert.match(html, /Vue operationnelle des 30 derniers jours/);
  assert.match(html, /⚠️ Vie Explosive: aucun opt-in capture sur la periode/);
  // Avec des avertissements mais aucune erreur, le fallback ne doit pas apparaitre
  assert.doesNotMatch(html, /Aucune erreur critique detectee sur 24h/);
  assert.match(html, /<a href="https:\/\/example\.com\/runbook">Runbook ops<\/a>/);
});

test('formatOpsDigestHtml sans erreur ni avertissement affiche le message par defaut', () => {
  const html = formatOpsDigestHtml({
    title: 'Soucis leads blogs (24h)',
    dateLabel: '01.03.2026',
    summaries: buildBlogOpsSummaries(SITE_CONFIGS),
    criticalErrors: [],
    pendingTotal: 0,
  });

  assert.match(html, /Aucune erreur critique detectee sur 24h/);
  assert.doesNotMatch(html, /Liens utiles:/);
});

test('formatOpsAlertText inclut les liens utilitaires en fin de message', () => {
  const text = formatOpsAlertText({
    title: 'Alerte ops blogs - Techniques de Méditation - server-errors-15m',
    lines: ['5 erreurs serveur sur les 15 dernieres minutes pour techniquesdemeditation.'],
    footerLinks: [{label: 'Logs de la fonction', url: 'https://example.com/logs'}],
  });

  assert.match(text, /Alerte ops blogs/);
  assert.match(text, /- 5 erreurs serveur/);
  assert.match(text, /Liens utiles:\n- Logs de la fonction: https:\/\/example\.com\/logs/);
});
