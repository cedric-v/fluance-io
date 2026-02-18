const test = require('node:test');
const assert = require('node:assert/strict');

const {confirmBookingPayment} = require('../services/bookingService');

class FakeDocSnapshot {
  constructor(data) {
    this._data = data;
  }
  get exists() {
    return !!this._data;
  }
  data() {
    return this._data;
  }
}

class FakeDocRef {
  constructor(db, collectionName, id) {
    this._db = db;
    this._collectionName = collectionName;
    this.id = id;
  }
  _getStore() {
    return this._db._store.get(this._collectionName);
  }
  get() {
    const store = this._getStore();
    const data = store ? store.get(this.id) : undefined;
    return Promise.resolve(new FakeDocSnapshot(data));
  }
  update(patch) {
    const store = this._getStore();
    const existing = store ? store.get(this.id) : undefined;
    if (!existing) return Promise.reject(new Error('doc-not-found'));
    store.set(this.id, {...existing, ...patch});
    return Promise.resolve();
  }
  set(data) {
    let store = this._getStore();
    if (!store) {
      store = new Map();
      this._db._store.set(this._collectionName, store);
    }
    store.set(this.id, data);
    return Promise.resolve();
  }
}

class FakeDB {
  constructor(initial = {}) {
    this._store = new Map();
    Object.entries(initial).forEach(([collectionName, docs]) => {
      const map = new Map();
      Object.entries(docs).forEach(([id, data]) => {
        map.set(id, data);
      });
      this._store.set(collectionName, map);
    });
  }
  collection(name) {
    return {
      doc: (id) => new FakeDocRef(this, name, id),
      add: async () => ({id: 'mock'}),
    };
  }
  async runTransaction(fn) {
    const transaction = {
      get: (ref) => ref.get(),
      update: (ref, data) => ref.update(data),
      set: (ref, data, opts) => {
        if (opts?.merge) {
          return ref.get().then((snap) => {
            const existing = snap.exists ? snap.data() : {};
            return ref.set({...existing, ...data});
          });
        }
        return ref.set(data);
      },
    };
    return fn(transaction);
  }
}

test('confirmBookingPayment is idempotent when already confirmed', async () => {
  const bookingId = 'booking_1';
  const paymentId = 'pi_123';
  const db = new FakeDB({
    bookings: {
      [bookingId]: {
        bookingId,
        courseId: 'course_1',
        status: 'confirmed',
        stripePaymentIntentId: paymentId,
        molliePaymentId: null,
      },
    },
    courses: {
      course_1: {
        participantCount: 5,
      },
    },
  });

  const result = await confirmBookingPayment(db, bookingId, paymentId);
  assert.equal(result.success, true);
  assert.equal(result.alreadyConfirmed, true);

  const course = await db.collection('courses').doc('course_1').get();
  assert.equal(course.data().participantCount, 5);
});
