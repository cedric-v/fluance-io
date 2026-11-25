/**
 * Tests du recrédit des séances (cours annulé) et de l'éligibilité au cours
 * d'essai gratuit.
 *
 * Contexte : quand un cours est annulé par l'organisation (nombre minimum de
 * participants non atteint), la séance décomptée doit être rendue et l'essai
 * gratuit doit redevenir utilisable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {refundPassSession, checkUserPass} = require('../services/passService');

// ============================================================
// Fausse base Firestore minimale
// ============================================================

function makeFakeDb(seed = {}) {
  const store = {
    bookings: {...(seed.bookings || {})},
    userPasses: {...(seed.userPasses || {})},
  };

  function matches(data, filters) {
    return filters.every(({field, op, value}) => {
      if (op === '==') return data[field] === value;
      if (op === 'in') return Array.isArray(value) && value.includes(data[field]);
      return true;
    });
  }

  function makeDoc(name, id) {
    const update = async (patch) => {
      store[name][id] = {...store[name][id], ...patch};
    };
    return {
      id,
      exists: Object.prototype.hasOwnProperty.call(store[name], id),
      data: () => store[name][id],
      update,
      get: async () => makeDoc(name, id),
      ref: {id, update, get: async () => makeDoc(name, id)},
    };
  }

  function collection(name) {
    const filters = [];
    let max = Infinity;
    const api = {
      doc: (id) => makeDoc(name, id),
      where: (field, op, value) => {
        filters.push({field, op, value});
        return api;
      },
      limit: (n) => {
        max = n;
        return api;
      },
      get: async () => {
        const docs = Object.keys(store[name])
            .filter((id) => matches(store[name][id], filters))
            .slice(0, max)
            .map((id) => makeDoc(name, id));
        return {docs, size: docs.length, empty: docs.length === 0};
      },
    };
    return api;
  }

  return {db: {collection}, store};
}

const EXPIRY = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

// ============================================================
// Recrédit d'une séance
// ============================================================

test('refundPassSession recrédite la séance du Flow Pass et réactive un pass épuisé', async () => {
  const {db, store} = makeFakeDb({
    userPasses: {
      pass1: {
        passType: 'flow_pass',
        status: 'exhausted',
        sessionsTotal: 10,
        sessionsUsed: 10,
        sessionsRemaining: 0,
        sessionsHistory: [
          {courseId: 'course1', usedAt: new Date('2026-11-01'), sessionNumber: 10},
        ],
      },
    },
  });

  const result = await refundPassSession(db, 'pass1', 'course1');

  assert.equal(result.success, true);
  assert.equal(result.sessionsRemaining, 1);
  const pass = store.userPasses.pass1;
  assert.equal(pass.sessionsRemaining, 1);
  assert.equal(pass.sessionsUsed, 9);
  assert.equal(pass.status, 'active');
  assert.equal(pass.sessionsHistory[0].refunded, true);
});

test('refundPassSession est idempotent (un deuxième appel ne recrédite pas)', async () => {
  const {db, store} = makeFakeDb({
    userPasses: {
      pass1: {
        passType: 'flow_pass',
        status: 'active',
        sessionsTotal: 10,
        sessionsUsed: 3,
        sessionsRemaining: 7,
        sessionsHistory: [{courseId: 'course1', usedAt: new Date()}],
      },
    },
  });

  const first = await refundPassSession(db, 'pass1', 'course1');
  const second = await refundPassSession(db, 'pass1', 'course1');

  assert.equal(first.sessionsRemaining, 8);
  assert.equal(second.alreadyRefunded, true);
  assert.equal(store.userPasses.pass1.sessionsRemaining, 8);
  assert.equal(store.userPasses.pass1.sessionsUsed, 2);
});

test('refundPassSession retire l\'entrée d\'historique pour un pass illimité', async () => {
  const {db, store} = makeFakeDb({
    userPasses: {
      pass1: {
        passType: 'semester_pass',
        status: 'active',
        sessionsTotal: -1,
        sessionsUsed: 0,
        sessionsRemaining: -1,
        sessionsHistory: [
          {courseId: 'course1', usedAt: new Date(), type: 'unlimited_session'},
          {courseId: 'course2', usedAt: new Date(), type: 'unlimited_session'},
        ],
      },
    },
  });

  const result = await refundPassSession(db, 'pass1', 'course1');

  assert.equal(result.success, true);
  assert.equal(result.unlimited, true);
  assert.equal(store.userPasses.pass1.sessionsRemaining, -1);
  assert.deepEqual(
      store.userPasses.pass1.sessionsHistory.map((h) => h.courseId),
      ['course2'],
  );
});

test('refundPassSession ne touche pas un pass sans séance pour ce cours', async () => {
  const {db, store} = makeFakeDb({
    userPasses: {
      pass1: {
        passType: 'flow_pass',
        status: 'active',
        sessionsTotal: 10,
        sessionsUsed: 1,
        sessionsRemaining: 9,
        sessionsHistory: [{courseId: 'autre-cours', usedAt: new Date()}],
      },
    },
  });

  const result = await refundPassSession(db, 'pass1', 'course1');
  assert.equal(result.success, false);
  assert.equal(store.userPasses.pass1.sessionsRemaining, 9);
});

test('refundPassSession lève une erreur si le pass n\'existe pas', async () => {
  const {db} = makeFakeDb({});
  await assert.rejects(() => refundPassSession(db, 'inconnu', 'course1'), /Pass not found/);
});

// ============================================================
// Essai gratuit réutilisable
// ============================================================

test('checkUserPass : une réservation annulée par l\'organisation rend l\'essai réutilisable', async () => {
  const {db} = makeFakeDb({
    bookings: {
      b1: {
        email: 'person@example.com',
        status: 'cancelled',
        cancelledReason: 'min_participants',
        cancelledByOrganizer: true,
        pricingOption: 'trial',
      },
    },
  });

  const status = await checkUserPass(db, 'person@example.com');
  assert.equal(status.isFirstVisit, true);
  assert.equal(status.canUseTrial, true);
  assert.equal(status.hasActivePass, false);
});

test('checkUserPass : une annulation faite par l\'utilisateur ne rend pas l\'essai réutilisable', async () => {
  const {db} = makeFakeDb({
    bookings: {
      b1: {
        email: 'person@example.com',
        status: 'cancelled',
        cancelledReason: 'Désinscription via email',
        pricingOption: 'trial',
      },
    },
  });

  const status = await checkUserPass(db, 'person@example.com');
  assert.equal(status.isFirstVisit, false);
  assert.equal(status.canUseTrial, false);
});

test('checkUserPass : une réservation confirmée bloque l\'essai gratuit', async () => {
  const {db} = makeFakeDb({
    bookings: {
      b1: {email: 'person@example.com', status: 'confirmed', pricingOption: 'trial'},
    },
  });

  const status = await checkUserPass(db, 'person@example.com');
  assert.equal(status.canUseTrial, false);
});

test('checkUserPass : un pass actif est prioritaire sur l\'essai', async () => {
  const {db} = makeFakeDb({
    userPasses: {
      pass1: {
        email: 'person@example.com',
        passType: 'flow_pass',
        status: 'active',
        sessionsTotal: 10,
        sessionsUsed: 2,
        sessionsRemaining: 8,
        purchaseDate: new Date(),
        expiryDate: EXPIRY,
      },
    },
  });

  const status = await checkUserPass(db, 'person@example.com');
  assert.equal(status.hasActivePass, true);
  assert.equal(status.canUseTrial, false);
  assert.equal(status.pass.sessionsRemaining, 8);
});
