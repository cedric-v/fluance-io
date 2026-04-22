---
layout: base.njk
title: API Fluance
description: Documentation humaine de l’API Fluance pour discovery agent, WebMCP et réservation de cours.
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
      Elle est utilisée par le site et par les outils WebMCP déclarés côté navigateur.
    </p>
  </header>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">Endpoints principaux</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li><code>GET /api/courses</code> : liste des cours disponibles avec date, heure, lieu et places restantes.</li>
      <li><code>GET /api/course-status?courseId=...</code> : statut détaillé d’un cours.</li>
      <li><code>GET /api/pass-status?email=...</code> : vérifie si une personne dispose d’un pass actif.</li>
      <li><code>POST /api/bookings</code> : crée une réservation, avec ou sans pass, et peut initier un paiement si nécessaire.</li>
      <li><code>GET /api/status</code> : endpoint santé léger pour discovery automatisée.</li>
    </ul>
  </article>

  <article class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance">État actuel</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li>Les ressources de discovery <code>/.well-known/api-catalog</code>, <code>/.well-known/agent-skills/index.json</code> et <code>/.well-known/mcp/server-card.json</code> sont publiées sur le site public.</li>
      <li>Les routes publiques same-origin <code>/api/*</code> existent et sont documentées pour les humains, les agents et la discovery automatique.</li>
      <li>Le frontend de réservation du site n’utilise pas ces routes en production. Il appelle directement les Cloud Functions publiques.</li>
      <li>Cette décision est volontaire car le site statique est déployé sur GitHub Pages, qui ne prend pas en charge les rewrites nécessaires pour faire fonctionner <code>/api/*</code> comme façade same-origin vers Firebase Functions.</li>
      <li>Les outils WebMCP peuvent exposer une surface agent prête à l’emploi, mais pour le navigateur public il faut considérer les endpoints Cloud Functions comme la source réelle d’exécution.</li>
      <li>Les routes <code>/api/*</code> doivent donc être considérées comme une façade documentaire et future-facing, à n’utiliser réellement en production que si un reverse proxy ou une couche edge est ajoutée devant le site.</li>
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
    <h2 class="text-2xl font-semibold text-fluance">Limites connues</h2>
    <ul class="space-y-3 text-[#3E3A35]">
      <li>GitHub Pages ne permet pas d’ajouter des en-têtes HTTP personnalisés sur la homepage. Les vérifications qui attendent des <code>Link</code> headers sur <code>/</code> resteront donc en échec sans proxy, CDN programmable ou migration d’hébergement.</li>
      <li>GitHub Pages ne permet pas non plus de forcer le type MIME idéal <code>application/linkset+json</code> pour le chemin sans extension <code>/.well-known/api-catalog</code>. Le fichier est publié, mais servi avec un type générique.</li>
      <li>Le site publie des ressources markdown dédiées pour les agents, mais ne fait pas encore de vraie négociation de contenu sur les pages HTML via <code>Accept: text/markdown</code>.</li>
      <li>Aucun endpoint OAuth/OIDC de discovery n’est publié pour l’instant, car l’API exposée publiquement ne repose pas encore sur un vrai serveur OAuth/OIDC dédié.</li>
      <li>Le server card MCP publié décrit la surface WebMCP navigateur. Il ne décrit pas un serveur MCP distant autonome en transport HTTP/SSE.</li>
      <li>Comme le site public est servi par GitHub Pages, les rewrites et headers Firebase Hosting définis dans <code>firebase.json</code> ne s’appliquent pas au site statique en production.</li>
    </ul>
  </article>
</section>
