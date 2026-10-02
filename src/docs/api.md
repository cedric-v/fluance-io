---
layout: base.njk
title: API Fluance
description: Documentation humaine de l’API Fluance pour discovery agent, MCP, A2A, WebMCP et réservation de cours.
locale: fr
permalink: /docs/api/
robots: noindex,follow
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="space-y-4">
    <p class="cta-pill bg-[#8bc34a]/20 text-fluance inline-flex">Agent-Ready API</p>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">API Fluance</h1>
    <p class="text-lg text-[#3E3A35]/80">
      Cette API expose le planning des cours Fluance, le statut d’un pass et la réservation d’une séance.
      Elle alimente le site, les outils WebMCP du navigateur, un serveur MCP distant et un endpoint A2A.
    </p>
  </header>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">Endpoints principaux</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li><code>GET /api/courses</code> : liste des cours disponibles avec date, heure, lieu et places restantes. <strong>Public.</strong></li>
      <li><code>GET /api/course-status?courseId=...</code> : statut détaillé d’un cours. <strong>Public.</strong></li>
      <li><code>GET /api/status</code> : endpoint santé léger pour discovery automatisée. <strong>Public.</strong></li>
      <li><code>GET /api/pass-status?email=...</code> : vérifie si une personne dispose d’un pass actif (PII). <strong>Clé API (<code>pass:read</code>).</strong></li>
      <li><code>POST /api/bookings</code> : crée une réservation, avec ou sans pass. <strong>Clé API (<code>booking:write</code>).</strong></li>
      <li><code>POST /api/send-contact-email</code> : transmet une demande de contact au support. <strong>Clé API (<code>contact:write</code>).</strong></li>
    </ul>
    <p class="text-[#3E3A35]/80">
      Les routes protégées attendent la clé dans l’en-tête <code>X-API-Key</code> (ou
      <code>Authorization: Bearer flu_...</code>). Sans clé configurée côté Worker, ces routes
      répondent <code>503</code> ; avec une clé invalide, <code>401</code> ; sans le bon scope, <code>403</code>.
    </p>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">Plateformes d’agents</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li><strong>MCP</strong> : <code>POST /api/mcp</code> — serveur MCP distant (Streamable HTTP, JSON), outils en lecture seule.</li>
      <li><strong>A2A</strong> : <code>POST /api/a2a</code> — JSON-RPC <code>message/send</code>, agent card sur <code>/.well-known/agent-card.json</code>.</li>
      <li><strong>GPT Actions</strong> : importer <a class="text-fluance underline" href="{{ '/docs/api/openapi.json' | relativeUrl }}">openapi.json</a> (opérations de lecture en priorité).</li>
      <li><strong>Meta AI Connectors</strong> : s’appuie sur l’API REST (OpenAPI) et l’onboarding MCP ; OAuth pour l’account linking (roadmap).</li>
    </ul>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">Ressources de découverte</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li><code>/.well-known/api-catalog</code></li>
      <li><code>/.well-known/agent-card.json</code> (A2A)</li>
      <li><code>/.well-known/mcp/server-card.json</code></li>
      <li><code>/.well-known/agent-skills/index.json</code> et les <code>SKILL.md</code></li>
      <li><code>/.well-known/webmcp-context.json</code></li>
    </ul>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">OpenAPI</h2>
    <p class="text-[#3E3A35]">
      La description machine-readable est disponible ici :
      <a class="text-fluance underline" href="{{ '/docs/api/openapi.json' | relativeUrl }}">/docs/api/openapi.json</a>
    </p>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">WebMCP</h2>
    <p class="text-[#3E3A35]">
      Les pages Fluance déclarent des outils WebMCP pour :
    </p>
    <ul class="space-y-3 text-[#3E3A35]">
      <li>identifier à qui l’approche Fluance peut convenir,</li>
      <li>lister les cours disponibles,</li>
      <li>ouvrir le parcours de réservation pour une séance choisie.</li>
    </ul>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">État actuel et limites</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li>Les pages statiques sont servies par Cloudflare Pages ; les routes <code>/api/*</code> et <code>/.well-known/*</code> sont servies par le Worker Cloudflare <code>fluance-api-proxy</code>, tandis que les Cloud Functions Firebase restent le backend de référence.</li>
      <li>Les réponses dynamiques de l’API ne sont pas mises en cache.</li>
      <li>Le serveur MCP est volontairement en lecture seule ; la réservation passe par les routes REST protégées.</li>
      <li>Aucun endpoint OAuth/OIDC n’est encore publié. C’est un prérequis pour l’account linking (Meta AI Connectors) et les actions authentifiées au nom d’un utilisateur.</li>
      <li>Le site publie des ressources markdown dédiées aux agents, sans négociation de contenu <code>Accept: text/markdown</code> sur les pages HTML.</li>
    </ul>
  </article>
</section>
