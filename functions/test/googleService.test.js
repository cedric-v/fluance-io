const test = require('node:test');
const assert = require('node:assert/strict');

const {GoogleService} = require('../services/googleService');

function makeEvent(overrides = {}) {
  return {
    id: 'evt_123',
    summary: 'Cours Fluance test',
    start: {
      dateTime: '2026-08-07T14:00:00+02:00',
      timeZone: 'Europe/Zurich',
    },
    end: {
      dateTime: '2026-08-07T15:00:00+02:00',
      timeZone: 'Europe/Zurich',
    },
    description: 'Un cours de test [max:12] [price:30]',
    location: 'le duplex danse & bien-être',
    ...overrides,
  };
}

test('parseCalendarEvent retourne les données pour un événement public', () => {
  const svc = new GoogleService();
  const event = makeEvent({visibility: 'public'});
  const course = svc.parseCalendarEvent(event);

  assert.ok(course, 'un événement public doit être synchronisé');
  assert.equal(course.title, 'Cours Fluance test');
  assert.equal(course.date, '07/08/2026');
  assert.equal(course.time, '14:00');
  assert.equal(course.maxCapacity, 12);
  assert.equal(course.price, 30);
  assert.equal(course.status, 'active');
});

test('parseCalendarEvent ignore les événements privés', () => {
  const svc = new GoogleService();
  const event = makeEvent({visibility: 'private'});
  const course = svc.parseCalendarEvent(event);
  assert.equal(course, null, 'un événement privé ne doit pas être synchronisé');
});

test('parseCalendarEvent ignore les événements confidentiels', () => {
  const svc = new GoogleService();
  const event = makeEvent({visibility: 'confidential'});
  const course = svc.parseCalendarEvent(event);
  assert.equal(course, null, 'un événement confidentiel ne doit pas être synchronisé');
});

test('parseCalendarEvent accepte les événements à visibilité par défaut', () => {
  const svc = new GoogleService();
  const event = makeEvent({}); // pas de champ visibility => 'default'
  const course = svc.parseCalendarEvent(event);
  assert.ok(course, 'un événement à visibilité par défaut doit être synchronisé');
});

test('syncCalendarToFirestore supprime un cours annulé récemment', async () => {
  const svc = new GoogleService();
  svc.auth = {};

  const requests = [];
  svc.calendar = {
    events: {
      list: async (request) => {
        requests.push(request);
        if (!request.pageToken) {
          return {
            data: {
              items: [makeEvent({
                id: 'kept',
                start: {
                  dateTime: '2026-08-24T14:00:00+02:00',
                  timeZone: 'Europe/Zurich',
                },
              })],
              nextPageToken: 'next-page',
            },
          };
        }
        return {
          data: {
            items: [{id: 'deleted', status: 'cancelled'}],
          },
        };
      },
    },
  };

  const deletedIds = [];
  const writtenIds = [];
  const makeDoc = (id) => ({
    id,
    ref: {
      delete: async () => deletedIds.push(id),
    },
  });
  const coursesCollection = {
    doc: (id) => ({id}),
    where: (field, operator) => {
      const clauses = [{field, operator}];
      const query = {
        where: (nextField, nextOperator) => {
          clauses.push({field: nextField, operator: nextOperator});
          return query;
        },
        get: async () => ({
          // La première requête est celle de la fenêtre de synchronisation;
          // la seconde correspond à la purge historique.
          docs: clauses[0].operator === '>=' ? [makeDoc('deleted'), makeDoc('kept')] : [],
        }),
      };
      return query;
    },
  };

  const result = await svc.syncCalendarToFirestore(
      {
        collection: () => coursesCollection,
        runTransaction: async (fn) => fn({
          get: async () => ({exists: false, data: () => null}),
          set: (ref) => writtenIds.push(ref.id),
        }),
      },
      'calendar@test',
  );

  assert.equal(result.synced, 1);
  assert.equal(result.deleted, 1);
  assert.equal(result.errors, 0);
  assert.deepEqual(writtenIds, ['kept']);
  assert.deepEqual(deletedIds, ['deleted']);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].showDeleted, true);
  assert.equal(requests[0].singleEvents, true);
  assert.equal(requests[1].pageToken, 'next-page');
  assert.equal(requests[1].showDeleted, true);
});

// ============================================================
// Nombre minimum de participants ([min:X])
// ============================================================

test('parseCalendarEvent lit [min:X] et le retire de la description', () => {
  const svc = new GoogleService();
  const event = makeEvent({
    description: 'Cours de test [max:12] [price:30] [min:3]',
  });
  const course = svc.parseCalendarEvent(event);

  assert.equal(course.minParticipants, 3);
  assert.equal(course.maxCapacity, 12);
  assert.equal(course.price, 30);
  assert.doesNotMatch(course.description, /\[min:/);
  assert.doesNotMatch(course.description, /\[max:/);
  assert.doesNotMatch(course.description, /\[price:/);
});

test('parseCalendarEvent : absence de [min:X] => minParticipants = 1 (aucune annulation auto)', () => {
  const svc = new GoogleService();
  const course = svc.parseCalendarEvent(makeEvent({description: 'Un cours [max:12]'}));
  assert.equal(course.minParticipants, 1);
});

test('parseCalendarEvent : [min:0] ou valeur invalide => 1', () => {
  const svc = new GoogleService();
  assert.equal(svc.parseCalendarEvent(makeEvent({description: '[min:0]'})).minParticipants, 1);
  assert.equal(svc.parseCalendarEvent(makeEvent({description: '[min:-2]'})).minParticipants, 1);
  assert.equal(svc.parseCalendarEvent(makeEvent({description: '[min:abc]'})).minParticipants, 1);
});

test('parseCalendarEvent : [min:X] supérieur à [max:Y] est ignoré (saisie incohérente)', () => {
  const svc = new GoogleService();
  const course = svc.parseCalendarEvent(
      makeEvent({description: 'Cours [max:4] [min:9]'}),
  );
  assert.equal(course.maxCapacity, 4);
  assert.equal(course.minParticipants, 1, 'un minimum > capacité annulerait tous les cours');
});

test('parseCalendarEvent : le tag [min:X] est insensible à la casse', () => {
  const svc = new GoogleService();
  const course = svc.parseCalendarEvent(makeEvent({description: '[MIN:2] [MAX:8]'}));
  assert.equal(course.minParticipants, 2);
  assert.equal(course.maxCapacity, 8);
});

test('applyCancellationPolicy conserve une annulation système lors de la synchronisation', () => {
  const svc = new GoogleService();
  const courseData = svc.parseCalendarEvent(makeEvent({description: '[min:2]'}));
  const previous = {
    status: 'cancelled',
    cancelledReason: 'min_participants',
    cancelledAt: 'date-annulation',
    cancelledByOrganizer: true,
    minParticipants: 2,
  };

  const result = svc.applyCancellationPolicy(courseData, previous);

  assert.equal(result.status, 'cancelled', 'la synchro ne doit pas ressusciter le cours');
  assert.equal(result.cancelledReason, 'min_participants');
  assert.equal(result.cancelledAt, 'date-annulation');
  assert.equal(result.cancelledByOrganizer, true);
});

test('applyCancellationPolicy réactive le cours si le tag [min:X] est retiré', () => {
  const svc = new GoogleService();
  // L'organisateur a retiré [min:2] de Google Agenda : plus de minimum
  const courseData = svc.parseCalendarEvent(makeEvent({description: 'Un cours [max:12]'}));
  const previous = {status: 'cancelled', cancelledReason: 'min_participants'};

  const result = svc.applyCancellationPolicy(courseData, previous);

  assert.equal(result.status, 'active');
  assert.ok(result.reactivatedAt, 'trace de réactivation attendue');
});

test('applyCancellationPolicy réactive le cours si [min:0] est mis dans la description', () => {
  const svc = new GoogleService();
  const courseData = svc.parseCalendarEvent(makeEvent({description: 'Cours [min:0]'}));
  const result = svc.applyCancellationPolicy(courseData, {
    status: 'cancelled',
    cancelledReason: 'min_participants',
  });
  assert.equal(result.status, 'active');
});

test('applyCancellationPolicy ne touche pas un cours actif', () => {
  const svc = new GoogleService();
  const courseData = svc.parseCalendarEvent(makeEvent({description: '[min:2]'}));
  const result = svc.applyCancellationPolicy(courseData, {status: 'active'});
  assert.equal(result.status, 'active');
  assert.equal(result.reactivatedAt, undefined);
});

test('syncCalendarToFirestore relit le statut dans la transaction : un cours annulé entre-temps reste annulé', async () => {
  const svc = new GoogleService();
  svc.auth = {};
  svc.calendar = {
    events: {list: async () => ({data: {items: [makeEvent({id: 'c1', description: '[max:10] [min:2]'})]}})},
  };

  const written = {};
  const coursesCollection = {
    doc: (id) => ({id}),
    where: () => {
      const query = {where: () => query, get: async () => ({docs: []})};
      return query;
    },
  };
  const db = {
    collection: () => coursesCollection,
    // Le cron vient d'annuler le cours : la transaction doit le voir.
    runTransaction: async (fn) => fn({
      get: async () => ({exists: true, data: () => ({status: 'cancelled', cancelledReason: 'min_participants', minParticipants: 2})}),
      set: (ref, data) => {
        written[ref.id] = data;
      },
    }),
  };

  await svc.syncCalendarToFirestore(db, 'calendar@test');
  assert.equal(written.c1.status, 'cancelled');
  assert.equal(written.c1.cancelledReason, 'min_participants');
});
