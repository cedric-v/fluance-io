/**
 * Tests des garde-fous serveur : un cours annulé (nombre minimum de
 * participants non atteint) ne peut plus recevoir d'inscription, même par un
 * appel direct à l'API ou via un transfert depuis un autre cours.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCourseAvailability,
  processBooking,
  transferBooking,
} = require('../services/bookingService');

// ============================================================
// Fausse base Firestore minimale
// ============================================================

const FUTURE = new Date(Date.now() + 6 * 60 * 60 * 1000);

function makeFakeDb(seed = {}) {
  const store = {
    courses: {...(seed.courses || {})},
    bookings: {...(seed.bookings || {})},
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
    const set = async (data) => {
      store[name][id] = data;
    };
    return {
      id,
      exists: Object.prototype.hasOwnProperty.call(store[name], id),
      data: () => store[name][id],
      update,
      set,
      get: async () => makeDoc(name, id),
      ref: {id, update, set},
    };
  }

  function collection(name) {
    const filters = [];
    let max = Infinity;
    const api = {
      // `doc()` sans argument = nouvel ID (comme le SDK Firestore)
      doc: (id) => makeDoc(name, id || `auto_${Object.keys(store[name]).length + 1}`),
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
      add: async (payload) => {
        const id = `auto_${Object.keys(store[name]).length + 1}`;
        store[name][id] = payload;
        return {id, ref: makeDoc(name, id).ref};
      },
    };
    return api;
  }

  const db = {
    collection,
    runTransaction: async (fn) => fn({
      get: (ref) => ref.get(),
      update: (ref, data) => ref.update(data),
      set: (ref, data) => ref.set(data),
    }),
  };

  return {db, store};
}

const cancelledCourse = {
  id: 'course_cancelled',
  title: 'Hatha yoga',
  date: '02/12/2026',
  time: '18:00',
  startTime: FUTURE,
  maxCapacity: 10,
  minParticipants: 2,
  price: 25,
  status: 'cancelled',
  cancelledReason: 'min_participants',
  cancelledByOrganizer: true,
};

// ============================================================
// Disponibilité
// ============================================================

test('getCourseAvailability signale un cours annulé comme non réservable', async () => {
  const {db} = makeFakeDb({courses: {course_cancelled: cancelledCourse}});

  const status = await getCourseAvailability(db, 'course_cancelled');

  assert.equal(status.available, false);
  assert.equal(status.isCancelled, true);
  assert.equal(status.error, 'COURSE_CANCELLED');
  assert.equal(status.isFull, true);
  assert.equal(status.minParticipants, 2);
});

test('getCourseAvailability laisse un cours actif réservable', async () => {
  const {db} = makeFakeDb({
    courses: {
      course_ok: {...cancelledCourse, id: 'course_ok', status: 'active', cancelledReason: null},
    },
  });

  const status = await getCourseAvailability(db, 'course_ok');
  assert.equal(status.available, true);
  assert.equal(status.isCancelled, false);
});

// ============================================================
// Réservation
// ============================================================

test('processBooking refuse une réservation sur un cours annulé', async () => {
  const {db, store} = makeFakeDb({courses: {course_cancelled: cancelledCourse}});

  const result = await processBooking(
      db,
      null, // pas de Stripe : aucun paiement ne doit être tenté
      'course_cancelled',
      {email: 'person@example.com', firstName: 'Per', lastName: 'Son'},
      'cash',
      'single',
  );

  assert.equal(result.success, false);
  assert.equal(result.error, 'COURSE_CANCELLED');
  assert.match(result.message, /annulé/);
  assert.equal(Object.keys(store.bookings).length, 0, 'aucune réservation ne doit être créée');
});

test('transferBooking refuse de transférer vers un cours annulé', async () => {
  const {db} = makeFakeDb({
    bookings: {
      b1: {
        bookingId: 'b1',
        courseId: 'course_ok',
        courseName: 'Cours initial',
        email: 'person@example.com',
        status: 'confirmed',
      },
    },
    courses: {
      course_ok: {...cancelledCourse, id: 'course_ok', status: 'active', cancelledReason: null},
      course_cancelled: cancelledCourse,
    },
  });

  const result = await transferBooking(db, 'b1', 'course_cancelled', 'person@example.com');

  assert.equal(result.success, false);
  assert.equal(result.error, 'COURSE_CANCELLED');
});

test('confirmBookingPayment ne confirme pas une réservation si le cours a été annulé', async () => {
  const {confirmBookingPayment} = require('../services/bookingService');
  const {db, store} = makeFakeDb({
    bookings: {
      b1: {
        bookingId: 'b1',
        courseId: 'course_cancelled',
        status: 'pending',
        amount: 2500,
        stripePaymentIntentId: 'pi_123',
      },
    },
    courses: {course_cancelled: cancelledCourse},
  });

  const result = await confirmBookingPayment(db, 'b1', 'pi_123');

  assert.equal(result.success, false);
  assert.equal(result.error, 'COURSE_CANCELLED');
  const booking = store.bookings.b1;
  assert.equal(booking.status, 'cancelled');
  assert.equal(booking.refundRequired, true);
  assert.equal(booking.refundAmount, 2500);
});
