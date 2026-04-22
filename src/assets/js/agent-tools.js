(function () {
  'use strict';

  const FALLBACK_API_BASE_URL = 'https://europe-west1-fluance-protected-content.cloudfunctions.net';
  const PRESELECTED_COURSE_STORAGE_KEY = 'fluance_preselected_course_id';
  const registeredToolNames = [];

  function getLocale() {
    if (window.location.pathname.startsWith('/en/')) {
      return 'en';
    }

    return 'fr';
  }

  function getApiBaseUrl() {
    const isLocalPreview =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    return isLocalPreview ? FALLBACK_API_BASE_URL : `${window.location.origin}/api`;
  }

  function getBookingPageUrl(locale) {
    return locale === 'en'
      ? `${window.location.origin}/en/presentiel/reserver/`
      : `${window.location.origin}/presentiel/reserver/`;
  }

  function normalizeGoals(goals) {
    if (!Array.isArray(goals)) {
      return [];
    }

    return goals
      .map((goal) => String(goal || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function buildFitRecommendation(input) {
    const locale = input.locale === 'en' ? 'en' : 'fr';
    const goals = normalizeGoals(input.goals);
    const wantsInPerson = Boolean(input.wantsInPerson);
    const wantsOnline = Boolean(input.wantsOnline);
    const restlessForMeditation = Boolean(input.restlessForMeditation);

    const matches = [];
    const rationale = [];

    const hasStressGoal = goals.some((goal) =>
      ['stress', 'calm', 'serenity', 'respiration', 'breath', 'anxiety', 'tension'].some((term) => goal.includes(term))
    );
    const hasMobilityGoal = goals.some((goal) =>
      ['mobility', 'fluidity', 'movement', 'souplesse', 'body', 'corps', 'douleur', 'pain'].some((term) => goal.includes(term))
    );
    const hasShortFormatGoal = goals.some((goal) =>
      ['short', 'quick', 'busy', 'court', 'rapide', 'routine'].some((term) => goal.includes(term))
    );

    if (restlessForMeditation) {
      rationale.push(
        locale === 'en'
          ? 'Fluance is particularly relevant for people who struggle with seated meditation and access calm more easily through movement.'
          : 'Fluance est particulièrement pertinent pour les personnes qui ont du mal avec la méditation assise et accèdent plus facilement au calme par le mouvement.'
      );
    }

    if (wantsInPerson || (!wantsOnline && !hasShortFormatGoal)) {
      matches.push({
        id: 'weekly-classes',
        title: locale === 'en' ? 'Weekly in-person classes' : 'Cours hebdomadaires en présentiel',
        url: locale === 'en' ? '/en/presentiel/cours-hebdomadaires/' : '/presentiel/cours-hebdomadaires/',
        bookingUrl: locale === 'en' ? '/en/presentiel/reserver/' : '/presentiel/reserver/',
      });
      rationale.push(
        locale === 'en'
          ? 'The in-person classes fit people who want guided practice, a regular group setting, and direct feedback.'
          : 'Les cours en présentiel conviennent bien aux personnes qui veulent une pratique guidée, un cadre de groupe régulier et un retour direct.'
      );
    }

    if (wantsOnline || hasShortFormatGoal || hasStressGoal || hasMobilityGoal) {
      matches.push({
        id: '21-days',
        title: locale === 'en' ? '21-Day online journey' : 'Parcours en ligne 21 jours',
        url: locale === 'en' ? '/en/cours-en-ligne/21-jours-mouvement/' : '/fr/cours-en-ligne/21-jours-mouvement/',
      });
      rationale.push(
        locale === 'en'
          ? 'The 21-day format is a good fit for people who want short daily practices and a gentle entry point.'
          : 'Le format 21 jours est adapté aux personnes qui veulent des pratiques courtes au quotidien et une porte d’entrée progressive.'
      );
    }

    matches.push({
      id: 'complete-approach',
      title: locale === 'en' ? 'Complete Fluance approach' : 'Approche Fluance complète',
      url: locale === 'en' ? '/en/cours-en-ligne/approche-fluance-complete/' : '/fr/cours-en-ligne/approche-fluance-complete/',
    });

    return {
      locale,
      recommendation:
        locale === 'en'
          ? 'Fluance can help if the person is looking for a body-based, gentle way to release tension, regain fluidity, and calm the mind through movement rather than rigid technique.'
          : 'Fluance peut aider si la personne cherche une voie corporelle, douce et accessible pour relâcher les tensions, retrouver de la fluidité et apaiser le mental par le mouvement plutôt que par une technique rigide.',
      rationale,
      bestMatches: matches,
      nextStep:
        locale === 'en'
          ? 'If the person wants to try quickly, start with the free first in-person session or the short online practices.'
          : 'Si la personne veut tester rapidement, commencez par la première séance présentielle offerte ou par les pratiques courtes en ligne.',
    };
  }

  async function listAvailableCourses(input) {
    const locale = input.locale === 'en' ? 'en' : getLocale();
    const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(12, input.limit)) : 6;
    const response = await fetch(`${getApiBaseUrl()}/courses`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch courses (${response.status})`);
    }

    const payload = await response.json();
    const courses = Array.isArray(payload.courses) ? payload.courses.slice(0, limit) : [];

    return {
      locale,
      count: courses.length,
      bookingUrl: locale === 'en' ? '/en/presentiel/reserver/' : '/presentiel/reserver/',
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        date: course.date,
        time: course.time,
        location: course.location,
        spotsRemaining: course.spotsRemaining,
        isFull: course.isFull,
        price: course.price,
      })),
    };
  }

  async function reserveSession(input) {
    const locale = input.locale === 'en' ? 'en' : getLocale();
    const courseId = String(input.courseId || '').trim();

    if (!courseId) {
      throw new Error('courseId is required');
    }

    sessionStorage.setItem(PRESELECTED_COURSE_STORAGE_KEY, courseId);

    if (window.FluanceBooking && window.location.pathname.includes('/presentiel/reserver/')) {
      await window.FluanceBooking.loadAvailableCourses();
      return {
        opened: true,
        bookingUrl: window.location.pathname,
        courseId,
        message:
          locale === 'en'
            ? 'The booking flow was opened on the current page.'
            : 'Le parcours de réservation a été ouvert sur la page courante.',
      };
    }

    const bookingUrl = `${getBookingPageUrl(locale)}?courseId=${encodeURIComponent(courseId)}`;
    window.location.href = bookingUrl;

    return {
      opened: false,
      redirected: true,
      bookingUrl,
      courseId,
      message:
        locale === 'en'
          ? 'Redirecting to the Fluance booking page.'
          : 'Redirection vers la page de réservation Fluance.',
    };
  }

  function getTools() {
    return [
      {
        name: 'identify-fluance-fit',
        description: 'Determine who Fluance can help, explain why, and suggest the most relevant Fluance course or format.',
        inputSchema: {
          type: 'object',
          properties: {
            goals: {
              type: 'array',
              description: 'User goals, pains, or outcomes they are looking for.',
              items: {
                type: 'string',
              },
            },
            wantsInPerson: {
              type: 'boolean',
              description: 'Whether the person prefers guided in-person sessions.',
            },
            wantsOnline: {
              type: 'boolean',
              description: 'Whether the person prefers online programs.',
            },
            restlessForMeditation: {
              type: 'boolean',
              description: 'Whether the person finds seated meditation difficult and responds better to movement-based practices.',
            },
            locale: {
              type: 'string',
              enum: ['fr', 'en'],
              description: 'Preferred response language.',
            },
          },
        },
        execute: async (input) => buildFitRecommendation(input || {}),
      },
      {
        name: 'list-fluance-courses',
        description: 'List currently available Fluance in-person classes with dates, locations, and remaining spots.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of classes to return. Defaults to 6.',
            },
            locale: {
              type: 'string',
              enum: ['fr', 'en'],
              description: 'Preferred response language.',
            },
          },
        },
        execute: async (input) => listAvailableCourses(input || {}),
      },
      {
        name: 'reserve-fluance-session',
        description: 'Open the Fluance booking flow for a selected in-person class so the user can complete the reservation.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Fluance course identifier returned by list-fluance-courses.',
            },
            locale: {
              type: 'string',
              enum: ['fr', 'en'],
              description: 'Preferred booking locale.',
            },
          },
          required: ['courseId'],
        },
        execute: async (input) => reserveSession(input || {}),
      },
    ];
  }

  function registerWithFallback(tools) {
    if (!navigator.modelContext) {
      return;
    }

    if (typeof navigator.modelContext.provideContext === 'function') {
      navigator.modelContext.provideContext({ tools });
      return;
    }

    if (typeof navigator.modelContext.unregisterTool === 'function') {
      registeredToolNames.forEach((name) => {
        try {
          navigator.modelContext.unregisterTool(name);
        } catch (error) {
          console.warn('Unable to unregister WebMCP tool', name, error);
        }
      });
      registeredToolNames.length = 0;
    }

    if (typeof navigator.modelContext.registerTool === 'function') {
      tools.forEach((tool) => {
        navigator.modelContext.registerTool(tool);
        registeredToolNames.push(tool.name);
      });
    }
  }

  function init() {
    if (!('modelContext' in navigator)) {
      return;
    }

    try {
      registerWithFallback(getTools());
    } catch (error) {
      console.error('Failed to register Fluance WebMCP tools', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
