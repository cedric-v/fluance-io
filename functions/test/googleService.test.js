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
    doc: (id) => ({
      set: async () => writtenIds.push(id),
    }),
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
      {collection: () => coursesCollection},
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
