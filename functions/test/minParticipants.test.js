/**
 * Tests de l'annulation des cours sous le minimum de participants.
 *
 * Utilise une fausse base Firestore en mémoire (pas d'émulateur) pour vérifier
 * la chaîne complète : décision → annulation du cours → annulation des
 * réservations → recrédit des passes → emails (participants, liste d'attente,
 * organisateur) → reprise idempotente.
 *
 * ⚠️ Les templates d'emails (functions/emails/*.html) sont des artefacts
 * gitignorés : lancer `npm run build:email-templates` (à la racine) avant
 * `npm --prefix functions test`, sinon les tests qui rendent un email échouent
 * avec « Email template not found ». La CI le fait automatiquement.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_PARTICIPANTS_LEAD_HOURS,
  normalizeMinParticipants,
  getBookingLocale,
  getRebookingUrl,
  shouldCancelCourse,
  classifySettlement,
  buildParticipantCancellationEmail,
  runMinParticipantsCheck,
} = require('../services/minParticipantsService');

// ============================================================
// Fausse base Firestore (sous-ensemble utilisé par le service)
// ============================================================

function toMillis(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Une chaîne non-date (ex. statut 'active') ne doit PAS produire NaN :
    // sinon les comparaisons `===` échouent silencieusement.
    const parsed = new Date(value).getTime();
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function makeFakeDb(seed = {}) {
  const collections = {
    courses: {...(seed.courses || {})},
    bookings: {...(seed.bookings || {})},
    waitlist: {...(seed.waitlist || {})},
    userPasses: {...(seed.userPasses || {})},
  };

  function matches(data, filters) {
    return filters.every(({field, op, value}) => {
      const actual = data[field];
      if (op === '==') {
        const a = toMillis(actual);
        const b = toMillis(value);
        return (a !== null && b !== null) ? a === b : actual === value;
      }
      if (op === 'in') return Array.isArray(value) && value.includes(actual);
      const a = toMillis(actual);
      const b = toMillis(value);
      if (a === null || b === null) return false;
      if (op === '>=') return a >= b;
      if (op === '<=') return a <= b;
      if (op === '>') return a > b;
      if (op === '<') return a < b;
      throw new Error(`op non supportée: ${op}`);
    });
  }

  function docSnapshot(name, id) {
    const update = async (patch) => {
      collections[name][id] = {...collections[name][id], ...patch};
    };
    const remove = async () => {
      delete collections[name][id];
    };
    return {
      id,
      exists: Object.prototype.hasOwnProperty.call(collections[name], id),
      data: () => collections[name][id],
      // `doc.ref` dans le vrai SDK, mais `doc(id)` retourne un
      // DocumentReference qui expose aussi update()/delete() directement.
      update,
      delete: remove,
      ref: {id, update, delete: remove},
    };
  }

  function querySnapshot(name, filters) {
    const docs = Object.keys(collections[name])
        .filter((id) => matches(collections[name][id], filters))
        .map((id) => docSnapshot(name, id));
    return {docs, size: docs.length, empty: docs.length === 0};
  }

  function collection(name) {
    const filters = [];
    const api = {
      doc: (id) => docSnapshot(name, id),
      where: (field, op, value) => {
        filters.push({field, op, value});
        return api;
      },
      get: async () => querySnapshot(name, filters),
      add: async (payload) => {
        const id = `auto_${Object.keys(collections[name]).length + 1}`;
        collections[name][id] = payload;
        return {id, ref: docSnapshot(name, id).ref};
      },
    };
    return api;
  }

  return {
    db: {collection},
    collections,
  };
}

function fakeGoogleService() {
  const calls = [];
  return {
    calls,
    markBookingsCancelledInSheet: async (sheetId, bookingIds, options) => {
      calls.push({sheetId, bookingIds, options});
      return {updated: bookingIds.length};
    },
  };
}

function fakePassService() {
  const calls = [];
  return {
    calls,
    refundPassSession: async (_db, passId, courseId) => {
      calls.push({passId, courseId});
      return {success: true, sessionsRemaining: 10};
    },
  };
}

function hoursFrom(base, hours) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

const NOW = new Date('2026-12-02T10:00:00.000Z');

function makeSeed({minParticipants = 2, participants = 1, status = 'active'} = {}) {
  const courses = {
    course1: {
      title: 'Hatha yoga',
      date: '02/12/2026',
      time: '18:00',
      gcalId: 'course1',
      status,
      startTime: hoursFrom(NOW, 2), // commence dans 2 h → décision immédiate
      maxCapacity: 10,
      minParticipants,
      price: 25,
      location: 'le duplex',
    },
  };

  const bookings = {};
  for (let i = 0; i < participants; i++) {
    bookings[`b${i + 1}`] = {
      bookingId: `b${i + 1}`,
      courseId: 'course1',
      courseName: 'Hatha yoga',
      courseDate: '02/12/2026',
      courseTime: '18:00',
      email: `person${i + 1}@example.com`,
      firstName: `Person${i + 1}`,
      lastName: 'Test',
      status: 'confirmed',
      pricingOption: 'single',
      paymentMethod: 'card',
      amount: 2500,
      passId: null,
    };
  }

  return {courses, bookings};
}

// ============================================================
// Helpers purs
// ============================================================

test('normalizeMinParticipants traite les valeurs absentes ou invalides comme 1', () => {
  assert.equal(normalizeMinParticipants(undefined), 1);
  assert.equal(normalizeMinParticipants(null), 1);
  assert.equal(normalizeMinParticipants(0), 1);
  assert.equal(normalizeMinParticipants(-3), 1);
  assert.equal(normalizeMinParticipants('abc'), 1);
  assert.equal(normalizeMinParticipants('2'), 2);
  assert.equal(normalizeMinParticipants(3.7), 3);
});

test('getBookingLocale renvoie fr par défaut et en si la réservation est en anglais', () => {
  assert.equal(getBookingLocale({}), 'fr');
  assert.equal(getBookingLocale({locale: 'fr'}), 'fr');
  assert.equal(getBookingLocale({locale: 'en'}), 'en');
  assert.equal(getBookingLocale({langue: 'EN'}), 'en');
});

test('getRebookingUrl pointe vers la page de réservation dans la bonne langue', () => {
  assert.equal(getRebookingUrl('fr'), 'https://fluance.io/presentiel/reserver/');
  assert.equal(getRebookingUrl('en'), 'https://fluance.io/en/presentiel/reserver/');
});

test('shouldCancelCourse : décision uniquement dans la fenêtre des 2 dernières heures', () => {
  const start = new Date('2026-12-02T12:00:00.000Z');
  const course = {status: 'active', startTime: start};
  const base = {course, participantCount: 1, minParticipants: 2};

  // 3 h avant → trop tôt
  assert.equal(shouldCancelCourse({...base, now: hoursFrom(start, -3)}), false);
  // Exactement 2 h avant → décision prise
  assert.equal(shouldCancelCourse({...base, now: hoursFrom(start, -2)}), true);
  // 30 min avant → décision prise
  assert.equal(shouldCancelCourse({...base, now: hoursFrom(start, -0.5)}), true);
  // Cours commencé → on ne touche plus
  assert.equal(shouldCancelCourse({...base, now: hoursFrom(start, 0.1)}), false);
  // Seuil atteint → on maintient
  assert.equal(shouldCancelCourse({...base, participantCount: 2, now: start}), false);
  // Pas de minimum → jamais d'annulation
  assert.equal(shouldCancelCourse({...base, minParticipants: 1, now: hoursFrom(start, -1)}), false);
  // Cours déjà annulé → idempotent
  assert.equal(
      shouldCancelCourse({...base, course: {...course, status: 'cancelled'}, now: hoursFrom(start, -1)}),
      false,
  );
});

test('shouldCancelCourse : un cours créé moins de 2 h avant son début n\'est jamais annulé', () => {
  const start = new Date('2026-12-02T12:00:00.000Z');
  const base = {status: 'active', startTime: start, minParticipants: 3};

  // Créé 30 min avant le début → on laisse passer
  assert.equal(
      shouldCancelCourse({
        course: {...base, gcalCreatedAt: hoursFrom(start, -0.5)},
        participantCount: 1,
        minParticipants: 3,
        now: hoursFrom(start, -0.2),
      }),
      false,
  );

  // Créé 3 jours avant → la règle s'applique normalement
  assert.equal(
      shouldCancelCourse({
        course: {...base, gcalCreatedAt: hoursFrom(start, -72)},
        participantCount: 1,
        minParticipants: 3,
        now: hoursFrom(start, -1),
      }),
      true,
  );

  // Sans date de création connue (anciens documents) → la règle s'applique
  assert.equal(
      shouldCancelCourse({
        course: base,
        participantCount: 1,
        minParticipants: 3,
        now: hoursFrom(start, -1),
      }),
      true,
  );
});

test('la fenêtre de décision est bien de 2 heures', () => {
  assert.equal(MIN_PARTICIPANTS_LEAD_HOURS, 2);
});

test('buildParticipantCancellationEmail produit un email dans la langue demandée', () => {
  const fr = buildParticipantCancellationEmail({
    locale: 'fr',
    firstName: 'Camille',
    courseName: 'Hatha yoga',
    courseDate: '02/12/2026',
    courseTime: '18:00',
  });
  assert.match(fr.subject, /Cours annulé/);
  assert.match(fr.html, /Choisir un autre cours/);
  assert.match(fr.html, /https:\/\/fluance\.io\/presentiel\/reserver\//);
  assert.doesNotMatch(fr.html, /\{\{/);

  const en = buildParticipantCancellationEmail({
    locale: 'en',
    firstName: 'Camille',
    courseName: 'Hatha yoga',
    courseDate: '02/12/2026',
    courseTime: '18:00',
  });
  assert.match(en.subject, /Class cancelled/);
  assert.match(en.html, /Choose another class/);
  assert.match(en.html, /https:\/\/fluance\.io\/en\/presentiel\/reserver\//);
});

test('classifySettlement : seule une place payée à l\'unité demande un remboursement', () => {
  // Séance de pass utilisée → recréditée, rien à rembourser
  assert.equal(
      classifySettlement({passId: 'p1', amount: 0, status: 'confirmed'}).refundRequired,
      false,
  );
  // Achat d'un Flow Pass → le pass reste valable
  const passPurchase = classifySettlement({
    pricingOption: 'flow_pass',
    amount: 21000,
    status: 'confirmed',
  });
  assert.equal(passPurchase.refundRequired, false);
  assert.equal(passPurchase.kind, 'pass_purchase');
  // Cours d'essai gratuit
  assert.equal(
      classifySettlement({pricingOption: 'trial', amount: 0, status: 'confirmed'}).kind,
      'trial',
  );
  // Espèces à régler sur place : jamais encaissé
  assert.equal(
      classifySettlement({pricingOption: 'single', amount: 2500, status: 'pending_cash'})
          .refundRequired,
      false,
  );
  // Paiement carte réellement encaissé → remboursement à traiter
  const paid = classifySettlement({pricingOption: 'single', amount: 2500, status: 'confirmed'});
  assert.equal(paid.refundRequired, true);
  assert.equal(paid.amount, 2500);
  // Réservation en attente de paiement
  assert.equal(
      classifySettlement({pricingOption: 'single', amount: 2500, status: 'pending'}).refundRequired,
      false,
  );
});

// ============================================================
// Chaîne complète
// ============================================================

test('annule le cours sous le minimum et prévient inscrits, liste d\'attente et organisateur', async () => {
  const {db, collections} = makeFakeDb({
    ...makeSeed({minParticipants: 2, participants: 1}),
    waitlist: {
      w1: {
        courseId: 'course1',
        email: 'waiting@example.com',
        firstName: 'Wanda',
        status: 'waiting',
      },
    },
  });

  const emails = [];
  const passService = fakePassService();

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService,
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  // Cours annulé
  assert.equal(collections.courses.course1.status, 'cancelled');
  assert.equal(collections.courses.course1.cancelledReason, 'min_participants');
  assert.equal(collections.courses.course1.cancelledByOrganizer, true);
  assert.equal(collections.courses.course1.participantCountAtCancellation, 1);
  assert.ok(collections.courses.course1.cancellationNotifiedAt);

  // Réservation annulée + remboursement à traiter (paiement carte)
  const booking = collections.bookings.b1;
  assert.equal(booking.status, 'cancelled');
  assert.equal(booking.cancelledByOrganizer, true);
  assert.equal(booking.cancelledReason, 'min_participants');
  assert.equal(booking.refundRequired, true);
  assert.equal(booking.cancellationEmailSent, true);

  // Liste d'attente
  assert.equal(collections.waitlist.w1.status, 'cancelled');

  // Emails : 1 inscrit + 1 liste d'attente + 1 organisateur
  assert.equal(emails.length, 3);
  const toParticipant = emails.find((e) => e.to === 'person1@example.com');
  assert.ok(toParticipant);
  assert.match(toParticipant.html, /presentiel\/reserver/);
  assert.ok(emails.find((e) => e.to === 'waiting@example.com'));
  assert.ok(emails.find((e) => e.to === 'organisateur@example.com'));

  assert.equal(stats.cancelled, 1);
  assert.equal(stats.emailsSent, 3);
  assert.equal(stats.refundsRequired, 1);
});

test('met à jour le suivi Google Sheet (statut + colonnes annulation)', async () => {
  const {db} = makeFakeDb(makeSeed({minParticipants: 2, participants: 1}));
  const googleService = fakeGoogleService();

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    googleService,
    sheetId: 'sheet_123',
    sendEmail: async () => {},
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(googleService.calls.length, 1);
  assert.equal(googleService.calls[0].sheetId, 'sheet_123');
  assert.deepEqual(googleService.calls[0].bookingIds, ['b1']);
  assert.match(googleService.calls[0].options.reason, /minimum de 2 participants/);
  assert.equal(stats.sheetUpdated, 1);
});

test('une erreur de Google Sheet n\'empêche ni l\'annulation ni les emails', async () => {
  const {db, collections} = makeFakeDb(makeSeed({minParticipants: 2, participants: 1}));
  const emails = [];

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    googleService: {
      markBookingsCancelledInSheet: async () => {
        throw new Error('Sheets API down');
      },
    },
    sheetId: 'sheet_123',
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(collections.courses.course1.status, 'cancelled');
  assert.equal(collections.bookings.b1.status, 'cancelled');
  // 1 inscrit + 1 organisateur
  assert.equal(emails.length, 2);
  assert.equal(stats.sheetUpdated, 0);
  assert.equal(stats.errors, 0);
});

test('ne touche pas un cours qui atteint son minimum', async () => {
  const {db, collections} = makeFakeDb(makeSeed({minParticipants: 2, participants: 2}));
  const emails = [];

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(collections.courses.course1.status, 'active');
  assert.equal(emails.length, 0);
  assert.equal(stats.cancelled, 0);
});

test('ne touche pas un cours sans [min:X] (minParticipants absent)', async () => {
  const seed = makeSeed({minParticipants: 1, participants: 0});
  delete seed.courses.course1.minParticipants;
  const {db, collections} = makeFakeDb(seed);

  await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async () => {},
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(collections.courses.course1.status, 'active');
});

test('ne fait rien plus de 2 h avant le cours', async () => {
  const seed = makeSeed({minParticipants: 3, participants: 1});
  seed.courses.course1.startTime = hoursFrom(NOW, 5);
  const {db, collections} = makeFakeDb(seed);

  await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async () => {},
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(collections.courses.course1.status, 'active');
});

test('recrédite la séance du pass et laisse l\'essai gratuit réutilisable', async () => {
  const seed = makeSeed({minParticipants: 3, participants: 2});
  seed.bookings.b1.passId = 'pass1';
  seed.bookings.b1.pricingOption = 'flow_pass';
  seed.bookings.b1.amount = 0;
  seed.bookings.b1.paymentMethod = 'pass';
  seed.bookings.b2.pricingOption = 'trial';
  seed.bookings.b2.amount = 0;

  const {db, collections} = makeFakeDb(seed);
  const passService = fakePassService();

  await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService,
    sendEmail: async () => {},
    logger: {log() {}, warn() {}, error() {}},
  });

  // Séance recréditée via le service de pass (une seule fois, pour le bon cours)
  assert.deepEqual(passService.calls, [{passId: 'pass1', courseId: 'course1'}]);
  assert.equal(collections.bookings.b1.passSessionRefunded, true);
  assert.equal(collections.bookings.b1.refundRequired, undefined);

  // Essai gratuit : marqué réutilisable, pas de remboursement d'argent
  assert.equal(collections.bookings.b2.trialReusable, true);
  assert.equal(collections.bookings.b2.refundRequired, undefined);
});

test('envoie l\'email dans la langue enregistrée sur la réservation', async () => {
  const seed = makeSeed({minParticipants: 2, participants: 1});
  seed.bookings.b1.locale = 'en';
  const {db} = makeFakeDb(seed);
  const emails = [];

  await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  const participantEmail = emails.find((e) => e.to === 'person1@example.com');
  assert.match(participantEmail.subject, /Class cancelled/);
  assert.match(participantEmail.html, /en\/presentiel\/reserver/);
});

test('reprend les notifications interrompues (cours déjà annulé, emails non envoyés)', async () => {
  const seed = makeSeed({minParticipants: 2, participants: 1, status: 'cancelled'});
  seed.courses.course1.cancelledReason = 'min_participants';
  seed.courses.course1.cancellationNotifiedAt = null;
  const {db, collections} = makeFakeDb(seed);
  const emails = [];

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  assert.equal(stats.resumed, 1);
  assert.equal(collections.bookings.b1.status, 'cancelled');
  assert.equal(collections.bookings.b1.cancellationEmailSent, true);
  assert.ok(collections.courses.course1.cancellationNotifiedAt);
  assert.ok(emails.some((e) => e.to === 'person1@example.com'));
});

test('reprend un email d\'annulation qui n\'a pas pu partir (réservation déjà annulée)', async () => {
  const seed = makeSeed({minParticipants: 2, participants: 1, status: 'cancelled'});
  seed.courses.course1.cancelledReason = 'min_participants';
  seed.courses.course1.cancellationNotifiedAt = null;
  seed.courses.course1.cancellationAdminNotifiedAt = new Date(); // déjà envoyé
  // La réservation a bien été annulée, mais l'email du participant a échoué.
  seed.bookings.b1.status = 'cancelled';
  seed.bookings.b1.cancelledReason = 'min_participants';
  seed.bookings.b1.cancelledByOrganizer = true;

  const {db, collections} = makeFakeDb(seed);
  const emails = [];

  await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  });

  // Le participant est prévenu, l'organisateur n'est pas re-notifié
  assert.deepEqual(emails.map((e) => e.to), ['person1@example.com']);
  assert.equal(collections.bookings.b1.cancellationEmailSent, true);
  assert.ok(collections.courses.course1.cancellationNotifiedAt);
});

test('dryRun liste les cours concernés sans rien modifier ni envoyer', async () => {
  const {db, collections} = makeFakeDb(makeSeed({minParticipants: 2, participants: 1}));
  const emails = [];

  const stats = await runMinParticipantsCheck({
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
    dryRun: true,
  });

  assert.equal(collections.courses.course1.status, 'active');
  assert.equal(collections.bookings.b1.status, 'confirmed');
  assert.equal(emails.length, 0);
  assert.equal(stats.wouldCancel.length, 1);
  assert.equal(stats.wouldCancel[0].courseId, 'course1');
  assert.equal(stats.wouldCancel[0].participantCount, 1);
});

test('un deuxième passage n\'envoie pas de doublon d\'email', async () => {
  const {db, collections} = makeFakeDb(makeSeed({minParticipants: 2, participants: 1}));
  const emails = [];
  const options = {
    db,
    now: NOW,
    adminEmail: 'organisateur@example.com',
    passService: fakePassService(),
    sendEmail: async (message) => emails.push(message),
    logger: {log() {}, warn() {}, error() {}},
  };

  await runMinParticipantsCheck(options);
  const firstRunEmails = emails.length;

  // Le cours est maintenant annulé : il n'est plus dans la requête des cours
  // actifs, et la notification est marquée comme envoyée.
  await runMinParticipantsCheck(options);

  assert.equal(emails.length, firstRunEmails);
  assert.equal(collections.courses.course1.status, 'cancelled');
});
