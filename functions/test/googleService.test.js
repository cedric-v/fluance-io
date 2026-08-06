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
