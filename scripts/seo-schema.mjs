#!/usr/bin/env node

/**
 * Validation externe des données structurées via Schema.org Validator.
 *
 * L'audit local reste la source bloquante au build. Cette commande est
 * exécutée par le workflow SEO planifié pour détecter les problèmes de
 * vocabulaire ou de type que le parsing JSON ne peut pas voir.
 */
import config from './seo-schema.config.mjs';

const validatorUrl = 'https://validator.schema.org/validate?output=json';
const failures = [];

function extractErrors(payload) {
  if (!Array.isArray(payload.errors)) return [];
  return payload.errors.map((error) => {
    if (typeof error === 'string') return error;
    return error.message || JSON.stringify(error);
  });
}

async function validate(url, attempt = 1) {
  try {
    const response = await fetch(validatorUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const payload = JSON.parse(text.replace(/^\)\]\}'\s*/, ''));
    if (payload.fetchError) throw new Error(payload.fetchError);

    return {
      url,
      errors: extractErrors(payload),
      warnings: payload.totalNumWarnings || 0,
      objects: payload.numObjects || 0,
      unavailable: false,
    };
  } catch (error) {
    if (attempt < 2) {
      const delaySeconds = 10;
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      return validate(url, attempt + 1);
    }
    return {
      url,
      errors: [],
      warnings: 0,
      objects: 0,
      unavailable: true,
      reason: error.message,
    };
  }
}

console.log(`🧩 Validation Schema.org — ${config.urls.length} URL(s).`);
for (const url of config.urls) {
  const result = await validate(url);
  if (result.unavailable) {
    console.warn(
      `⚠️ ${result.url} — service indisponible : ${result.reason}. Contrôle ignoré pour les URL suivantes.`,
    );
    break;
  } else if (result.errors.length > 0) {
    failures.push(...result.errors.map((error) => `${result.url} : ${error}`));
    console.error(`❌ ${result.url} — ${result.errors.length} erreur(s).`);
  } else {
    console.log(
      `✅ ${result.url} — ${result.objects} objet(s), ${result.warnings} avertissement(s).`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures.slice(0, 20)) console.error(`  ${failure}`);
  if (failures.length > 20) console.error(`  … et ${failures.length - 20} autre(s) erreur(s).`);
  process.exit(1);
}
