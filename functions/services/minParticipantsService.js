/**
 * Min Participants Service - Annulation des cours sous le seuil minimum
 *
 * Règle métier :
 *   Le nombre minimum de participants est indiqué dans la description de
 *   l'événement Google Agenda, à côté de [max:XX] et [price:XX] :
 *
 *     [min:2]
 *
 *   2 heures avant le début du cours, si le nombre d'inscrits confirmés est
 *   inférieur à ce minimum, le cours est annulé automatiquement :
 *     - le cours passe en `status: 'cancelled'` → il disparaît de la page de
 *       réservation et toute nouvelle inscription est refusée côté serveur ;
 *     - les inscrits et l'organisateur reçoivent un email (dans leur langue) ;
 *     - les séances déjà décomptées sont recréditées (Flow Pass) et l'essai
 *       gratuit redevient utilisable ;
 *     - les personnes en liste d'attente sont prévenues ;
 *     - aucune inscription n'est remboursée automatiquement : l'email propose
 *       de choisir un autre créneau (le remboursement reste manuel).
 *
 * Documentation : GESTION_MINIMUM_PARTICIPANTS.md
 */

const {Timestamp} = require('firebase-admin/firestore');
const {loadEmailTemplate} = require('./emailTemplates');

/** Délai avant le début du cours où la décision est prise. */
const MIN_PARTICIPANTS_LEAD_HOURS = 2;

/** Même délai, en millisecondes. */
const MIN_PARTICIPANTS_LEAD_MS = MIN_PARTICIPANTS_LEAD_HOURS * 60 * 60 * 1000;

/** Valeur stockée dans `courses.cancelledReason`. */
const CANCELLATION_REASON = 'min_participants';

/** Statuts de réservation qui comptent comme une place occupée. */
const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending_cash'];

/** Statuts de réservation qui doivent être annulés lors de l'annulation du cours. */
const CANCELLABLE_BOOKING_STATUSES = ['confirmed', 'pending_cash', 'pending'];

/** Statuts d'essai (gratuit) — la séance doit redevenir utilisable. */
const TRIAL_PRICING_OPTIONS = ['trial'];

/**
 * Options tarifaires qui achètent un PASS (et non une place à l'unité).
 * Le pass reste valable et utilisable sur un autre cours : il n'y a donc rien
 * à rembourser, contrairement à un paiement à la carte.
 */
const PASS_PURCHASE_PRICING_OPTIONS = ['flow_pass', 'semester_pass'];

const SITE_BASE_URL = 'https://fluance.io';

// ============================================================
// Helpers purs (testés dans functions/test/minParticipants.test.js)
// ============================================================

/**
 * Convertit une valeur Firestore (Timestamp | Date | string | number) en Date.
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalise la valeur `minParticipants` d'un cours.
 * Toute valeur absente ou invalide vaut 1 (aucune contrainte), pour ne jamais
 * annuler un cours par accident (donnée manquante, tag mal orthographié...).
 * @param {*} value
 * @returns {number}
 */
function normalizeMinParticipants(value) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

/**
 * Locale d'un inscrit ('fr' ou 'en'), avec repli sur le français.
 * La locale est enregistrée à la réservation (`booking.locale`) ; à défaut on
 * utilise la langue du compte.
 * @param {Object} booking
 * @returns {'fr'|'en'}
 */
function getBookingLocale(booking) {
  const raw = String(
      (booking && (booking.locale || booking.langue || booking.language)) || 'fr',
  ).toLowerCase();
  return raw.startsWith('en') ? 'en' : 'fr';
}

/**
 * URL de la page de réservation, dans la langue de la personne.
 * @param {'fr'|'en'} locale
 * @returns {string}
 */
function getRebookingUrl(locale) {
  return locale === 'en' ?
    `${SITE_BASE_URL}/en/presentiel/reserver/` :
    `${SITE_BASE_URL}/presentiel/reserver/`;
}

/**
 * Décide si un cours doit être annulé.
 *
 * La décision se prend dans la fenêtre ]début - 2 h ; début[ : jamais après le
 * début du cours, jamais plus tôt que 2 h avant.
 *
 * Exception volontaire : un cours **créé moins de 2 h avant son début** n'est
 * jamais annulé automatiquement. L'organisateur l'a programmé tardivement, en
 * connaissance de cause : le seuil minimum n'a pas pu jouer son rôle de
 * « laissons une chance aux inscriptions ».
 *
 * @param {Object} params
 * @param {Object} params.course - Document cours (startTime, status, gcalCreatedAt)
 * @param {number} params.participantCount - Inscrits confirmés
 * @param {number} params.minParticipants - Minimum requis (normalisé)
 * @param {Date} params.now - Instant de référence
 * @returns {boolean}
 */
function shouldCancelCourse({course, participantCount, minParticipants, now}) {
  if (!course) return false;
  if (course.status !== 'active') return false;

  const min = normalizeMinParticipants(minParticipants);
  if (min <= 1) return false; // Pas de minimum → jamais d'annulation auto

  const start = toDate(course.startTime);
  if (!start) return false;

  // Cours programmé à la dernière minute : on le laisse avoir lieu.
  const gcalCreatedAt = toDate(course.gcalCreatedAt);
  if (gcalCreatedAt && start.getTime() - gcalCreatedAt.getTime() < MIN_PARTICIPANTS_LEAD_MS) {
    return false;
  }

  const stop = toDate(now) || new Date();
  const deadline = new Date(start.getTime() - MIN_PARTICIPANTS_LEAD_MS);
  if (stop < deadline) return false; // Trop tôt : laissons une chance aux inscriptions
  if (stop >= start) return false; // Cours déjà commencé / passé

  return participantCount < min;
}

/**
 * Détermine ce que l'inscrit a « payé » et s'il y a un remboursement à traiter.
 *
 * - séance de pass utilisée (`passId`) → séance recréditée, rien à rembourser ;
 * - achat d'un Flow Pass / Pass Semestriel → le pass reste valable, rien à rembourser ;
 * - cours d'essai gratuit → rien à rembourser, l'essai redevient utilisable ;
 * - paiement à la carte réellement encaissé (carte/TWINT) → remboursement à
 *   traiter manuellement (aucun remboursement automatique : choix produit,
 *   l'email propose le report sur un autre cours) ;
 * - paiement en espèces « à régler sur place » (pending_cash) → jamais encaissé.
 *
 * @param {Object} booking
 * @returns {{kind: string, label: string, refundRequired: boolean, amount: number}}
 */
function classifySettlement(booking) {
  const amount = Number(booking.amount) || 0;
  const pricingOption = String(booking.pricingOption || '');
  const status = booking.status;

  if (booking.passId) {
    return {
      kind: 'pass_session',
      label: 'séance de pass (recréditée)',
      refundRequired: false,
      amount: 0,
    };
  }

  if (PASS_PURCHASE_PRICING_OPTIONS.includes(pricingOption)) {
    return {
      kind: 'pass_purchase',
      label: 'achat de pass (le pass reste valable)',
      refundRequired: false,
      amount: 0,
    };
  }

  if (TRIAL_PRICING_OPTIONS.includes(pricingOption) || amount === 0) {
    return {
      kind: 'trial',
      label: 'cours d\'essai gratuit (réutilisable)',
      refundRequired: false,
      amount: 0,
    };
  }

  if (status === 'pending_cash') {
    return {
      kind: 'cash_unpaid',
      label: 'espèces à régler sur place (non encaissé)',
      refundRequired: false,
      amount: 0,
    };
  }

  if (status === 'confirmed' && amount > 0) {
    return {
      kind: 'paid',
      label: `payé ${(amount / 100).toFixed(2)} CHF — remboursement à traiter`,
      refundRequired: true,
      amount: amount,
    };
  }

  // Réservation en attente de paiement (jamais payée) : rien à rembourser.
  return {
    kind: 'pending_payment',
    label: 'paiement non abouti (rien d\'encaissé)',
    refundRequired: false,
    amount: 0,
  };
}

/**
 * Construit l'email destiné à un inscrit dont le cours est annulé.
 * @param {Object} params
 * @param {'fr'|'en'} params.locale
 * @param {string} params.firstName
 * @param {string} params.courseName
 * @param {string} params.courseDate
 * @param {string} params.courseTime
 * @param {string} params.rebookingUrl
 * @returns {{subject: string, html: string, text: string}}
 */
function buildParticipantCancellationEmail({
  locale,
  firstName,
  courseName,
  courseDate,
  courseTime,
  rebookingUrl,
}) {
  const isEnglish = locale === 'en';
  const templateName = isEnglish ?
    'cours-annule-min-participants-en' :
    'cours-annule-min-participants';

  const html = loadEmailTemplate(templateName, {
    firstName: firstName || '',
    courseName: courseName || '',
    courseDate: courseDate || '',
    courseTime: courseTime || '',
    rebookingUrl: rebookingUrl || getRebookingUrl(locale),
  });

  const subject = isEnglish ?
    `Class cancelled: ${courseName} (${courseDate})` :
    `Cours annulé : ${courseName} (${courseDate})`;

  const text = isEnglish ?
    `Hello${firstName ? ' ' + firstName : ''},\n\n` +
      `We are sorry: the class ${courseName} on ${courseDate} at ${courseTime} ` +
      'will unfortunately not take place, as there were not enough registrations.\n\n' +
      'You can book another session here:\n' +
      `${rebookingUrl}\n\n` +
      'If you used a pass or a free trial session, it has been restored in full.\n\n' +
      'I look forward to seeing you at an upcoming class!\n\n' +
      'Cédric - Fluance' :
    `Bonjour${firstName ? ' ' + firstName : ''},\n\n` +
      `Je suis désolé : le cours ${courseName} du ${courseDate} à ${courseTime} ` +
      'n\'aura malheureusement pas lieu, faute d\'un nombre suffisant d\'inscrits.\n\n' +
      'Vous pouvez réserver un autre créneau ici :\n' +
      `${rebookingUrl}\n\n` +
      'Si vous aviez utilisé un pass ou votre cours d\'essai gratuit, il a été ' +
      'entièrement recrédité.\n\n' +
      'Au plaisir de vous retrouver très bientôt dans un prochain cours !\n\n' +
      'Cédric - Fluance';

  return {subject, html, text};
}

/**
 * Construit l'email destiné à une personne en liste d'attente.
 * @param {Object} params
 * @param {'fr'|'en'} params.locale
 * @param {string} params.firstName
 * @param {string} params.courseName
 * @param {string} params.courseDate
 * @param {string} params.courseTime
 * @param {string} params.rebookingUrl
 * @returns {{subject: string, html: string, text: string}}
 */
function buildWaitlistCancellationEmail({
  locale,
  firstName,
  courseName,
  courseDate,
  courseTime,
  rebookingUrl,
}) {
  const isEnglish = locale === 'en';
  const templateName = isEnglish ?
    'liste-attente-cours-annule-en' :
    'liste-attente-cours-annule';

  const html = loadEmailTemplate(templateName, {
    firstName: firstName || '',
    courseName: courseName || '',
    courseDate: courseDate || '',
    courseTime: courseTime || '',
    rebookingUrl: rebookingUrl || getRebookingUrl(locale),
  });

  const subject = isEnglish ?
    `Class cancelled: ${courseName} (${courseDate})` :
    `Cours annulé : ${courseName} (${courseDate})`;

  const text = isEnglish ?
    `Hello${firstName ? ' ' + firstName : ''},\n\n` +
      `You were on the waiting list for ${courseName} on ${courseDate} at ${courseTime}. ` +
      'This class will unfortunately not take place, as there were not enough registrations.\n\n' +
      'You can book another session here:\n' +
      `${rebookingUrl}\n\n` +
      'I look forward to seeing you at an upcoming class!\n\n' +
      'Cédric - Fluance' :
    `Bonjour${firstName ? ' ' + firstName : ''},\n\n` +
      `Vous étiez sur la liste d'attente du cours ${courseName} du ${courseDate} à ${courseTime}. ` +
      'Ce cours n\'aura malheureusement pas lieu, faute d\'un nombre suffisant d\'inscrits.\n\n' +
      'Vous pouvez réserver un autre créneau ici :\n' +
      `${rebookingUrl}\n\n` +
      'Au plaisir de vous retrouver très bientôt dans un prochain cours !\n\n' +
      'Cédric - Fluance';

  return {subject, html, text};
}

/**
 * Construit l'email de synthèse destiné à l'organisateur / formateur.
 * @param {Object} params
 * @param {Object} params.course - Données du cours
 * @param {number} params.participantCount - Inscrits au moment de l'annulation
 * @param {number} params.minParticipants - Minimum requis
 * @param {Array<Object>} params.participants - Détail des inscrits
 * @param {number} params.waitlistCount - Nombre de personnes en liste d'attente
 * @param {string} params.rebookingUrl
 * @returns {{subject: string, html: string, text: string}}
 */
function buildAdminCancellationEmail({
  course,
  participantCount,
  minParticipants,
  participants = [],
  waitlistCount = 0,
  rebookingUrl,
}) {
  const courseName = course.title || 'Cours Fluance';
  const subject = `❌ Cours annulé (< ${minParticipants} inscrits) : ${courseName} du ${course.date}`;

  const rows = participants.map((p) => {
    const settlement = p.settlement || 'réservation';
    return `<li><strong>${escapeHtml(p.firstName || '')} ${escapeHtml(p.lastName || '')}</strong> — ` +
      `${escapeHtml(p.email)} — ${escapeHtml(settlement)}</li>`;
  }).join('');

  const refundCount = participants.filter((p) => p.refundRequired).length;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
        Cours annulé automatiquement
      </h2>
      <div style="background:#fdfaf6; padding:15px; border-radius:5px; margin-top:20px;">
        <p style="margin:5px 0;"><strong>Cours :</strong> ${escapeHtml(courseName)}</p>
        <p style="margin:5px 0;"><strong>Date :</strong> ${escapeHtml(course.date || '')}
          à ${escapeHtml(course.time || '')}</p>
        <p style="margin:5px 0;"><strong>Inscrits :</strong> ${participantCount}
          / minimum requis : ${minParticipants}</p>
        <p style="margin:5px 0;"><strong>Liste d'attente :</strong> ${waitlistCount}</p>
        <p style="margin:5px 0;"><strong>Remboursements à traiter :</strong> ${refundCount}</p>
      </div>
      <h3 style="color:#3E3A35;">Inscrits</h3>
      ${participants.length ? `<ul>${rows}</ul>` : '<p>Aucun inscrit.</p>'}
      <p style="margin-top:20px;">
        Les inscrits ont été prévenus par email avec un lien pour choisir un autre créneau.
        Les séances de pass ont été recréditées et l'essai gratuit redevient utilisable.
      </p>
      <p>
        Pour maintenir malgré tout ce cours : retirez <code>[min:X]</code> de la description
        Google Agenda (ou mettez <code>[min:0]</code>) puis lancez
        <code>syncPlanningManual</code> — le cours sera réactivé.
      </p>
      <p><a href="${rebookingUrl}">Voir la page de réservation</a></p>
    </div>
  `;

  const text = [
    'Cours annulé automatiquement',
    `Cours : ${courseName}`,
    `Date : ${course.date || ''} ${course.time || ''}`,
    `Inscrits : ${participantCount} / minimum requis : ${minParticipants}`,
    `Liste d'attente : ${waitlistCount}`,
    `Remboursements à traiter : ${refundCount}`,
    '',
    'Inscrits :',
    ...participants.map((p) =>
      `- ${p.firstName || ''} ${p.lastName || ''} <${p.email}> (${p.settlement || 'réservation'})`,
    ),
    '',
    'Les inscrits ont été prévenus par email avec un lien pour choisir un autre créneau.',
    'Pour maintenir le cours : retirer [min:X] de la description Google Agenda puis relancer syncPlanningManual.',
  ].join('\n');

  return {subject, html, text};
}

/**
 * Échappe le HTML des valeurs injectées dans les emails admin.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

// ============================================================
// Accès Firestore
// ============================================================

/**
 * Compte les inscriptions qui occupent réellement une place.
 * On lit la collection `bookings` (source de vérité) et non
 * `course.participantCount`, qui est réinitialisé à 0 à chaque
 * synchronisation Google Calendar.
 *
 * @param {Object} db - Instance Firestore
 * @param {string} courseId
 * @returns {Promise<number>}
 */
async function countActiveParticipants(db, courseId) {
  const snapshot = await db.collection('bookings')
      .where('courseId', '==', courseId)
      .where('status', 'in', ACTIVE_BOOKING_STATUSES)
      .get();
  return snapshot.size;
}

/**
 * Marque le cours comme annulé et prévient tout le monde.
 * @param {Object} ctx - Voir runMinParticipantsCheck
 * @param {string} courseId
 * @param {Object} course - Données du cours
 * @param {Object} options
 * @param {number} options.participantCount
 * @param {boolean} [options.alreadyMarked] - true si le cours est déjà annulé
 *   (reprise d'une notification interrompue)
 * @returns {Promise<Object>} Statistiques de l'annulation
 */
async function cancelCourse(ctx, courseId, course, {participantCount, alreadyMarked = false}) {
  const {
    db,
    now,
    sendEmail,
    adminEmail,
    passService,
    googleService,
    sheetId,
    logger = console,
  } = ctx;
  const minParticipants = normalizeMinParticipants(course.minParticipants);
  const stats = {
    emailsSent: 0,
    emailsFailed: 0,
    passesRefunded: 0,
    refundsRequired: 0,
    bookings: 0,
    sheetUpdated: 0,
  };

  if (!alreadyMarked) {
    // Écriture AVANT les emails : dès cet instant, plus aucune inscription
    // n'est possible (getAvailableCourses, processBooking, bookCourse, API).
    await db.collection('courses').doc(courseId).update({
      status: 'cancelled',
      cancelledReason: CANCELLATION_REASON,
      cancelledByOrganizer: true,
      cancelledAt: now,
      minParticipants: minParticipants,
      participantCountAtCancellation: participantCount,
      cancellationNotifiedAt: null,
      updatedAt: now,
    });
    logger.log(`❌ Cours annulé (${participantCount}/${minParticipants}) : ${course.title} (${courseId})`);
  }

  // ------------------------------------------------------------
  // 1. Inscrits → annulation + recrédit du pass + email
  // ------------------------------------------------------------
  const bookingsSnapshot = await db.collection('bookings')
      .where('courseId', '==', courseId)
      .get();

  const participantsSummary = [];
  const cancelledBookingIds = [];

  for (const bookingDoc of bookingsSnapshot.docs) {
    const booking = bookingDoc.data();

    // Déjà annulée par ce traitement (reprise après un crash) : on reprend
    // uniquement les emails qui n'ont pas pu partir.
    const alreadyCancelled = booking.status === 'cancelled' &&
      booking.cancelledReason === CANCELLATION_REASON;
    if (!CANCELLABLE_BOOKING_STATUSES.includes(booking.status) && !alreadyCancelled) continue;
    stats.bookings++;
    cancelledBookingIds.push(booking.bookingId || bookingDoc.id);

    const updates = alreadyCancelled ? {} : {
      status: 'cancelled',
      cancelledAt: now,
      cancelledReason: CANCELLATION_REASON,
      cancelledByOrganizer: true,
      updatedAt: now,
    };

    // Séance de pass : on la recrédite (Flow Pass) ou on retire l'entrée
    // d'historique (Pass Semestriel illimité). Idempotent.
    if (!alreadyCancelled && booking.passId && passService?.refundPassSession) {
      try {
        const refund = await passService.refundPassSession(db, booking.passId, courseId);
        if (refund?.success) {
          stats.passesRefunded++;
          updates.passSessionRefunded = true;
          updates.passSessionRefundedAt = now;
        } else {
          logger.warn(`⚠️ Recrédit de séance impossible (${booking.passId}) : ${refund?.error || 'inconnu'}`);
        }
      } catch (refundError) {
        logger.error(`❌ Erreur recrédit de séance pour ${bookingDoc.id}:`, refundError.message);
      }
    }

    const settlement = alreadyCancelled && booking.refundRequired ?
      {label: `payé ${((booking.refundAmount || 0) / 100).toFixed(2)} CHF — remboursement à traiter`} :
      classifySettlement(booking);

    if (!alreadyCancelled) {
      // Essai gratuit : l'éligibilité est recalculée à partir des réservations
      // (passService.checkUserPass ignore les annulations de l'organisateur),
      // le flag ci-dessous sert uniquement de trace lisible.
      if (TRIAL_PRICING_OPTIONS.includes(booking.pricingOption)) {
        updates.trialReusable = true;
      }

      // Nature de la contrepartie déjà fournie par l'inscrit : sert à décider
      // s'il y a un remboursement à traiter et à informer l'organisateur.
      if (settlement.refundRequired) {
        updates.refundRequired = true;
        updates.refundReason = 'course_cancelled_min_participants';
        updates.refundAmount = settlement.amount;
        stats.refundsRequired++;
      }
    }

    const locale = getBookingLocale(booking);

    const emailContent = buildParticipantCancellationEmail({
      locale,
      firstName: booking.firstName,
      courseName: booking.courseName || course.title,
      courseDate: booking.courseDate || course.date,
      courseTime: booking.courseTime || course.time,
      rebookingUrl: getRebookingUrl(locale),
    });

    // Statut mis à jour avant l'envoi : même si l'email échoue, la
    // réservation ne reste pas « active » sur un cours annulé.
    if (Object.keys(updates).length > 0) {
      try {
        await bookingDoc.ref.update(updates);
      } catch (updateError) {
        logger.error(`❌ Erreur mise à jour réservation ${bookingDoc.id}:`, updateError.message);
      }
    }

    if (booking.cancellationEmailSent) {
      participantsSummary.push({...booking, ...updates, settlement: settlement.label});
      continue;
    }

    try {
      await sendEmail({
        to: booking.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      stats.emailsSent++;
      await bookingDoc.ref.update({
        cancellationEmailSent: true,
        cancellationEmailSentAt: now,
      });
    } catch (emailError) {
      stats.emailsFailed++;
      logger.error(`❌ Email d'annulation non envoyé à ${booking.email}:`, emailError.message);
    }

    participantsSummary.push({...booking, ...updates, settlement: settlement.label});
  }

  // ------------------------------------------------------------
  // 1bis. Suivi / reporting Google Sheet (une lecture, un batch)
  // ------------------------------------------------------------
  if (googleService?.markBookingsCancelledInSheet && sheetId && cancelledBookingIds.length > 0) {
    try {
      const sheetResult = await googleService.markBookingsCancelledInSheet(
          sheetId,
          cancelledBookingIds,
          {
            reason: `Cours annulé (minimum de ${minParticipants} participants non atteint)`,
            statusLabel: 'Annulé',
            cancelledAt: now,
          },
      );
      stats.sheetUpdated = sheetResult?.updated || 0;
    } catch (sheetError) {
      // Le reporting ne doit jamais empêcher l'annulation ni les emails.
      logger.error('❌ Mise à jour du suivi Google Sheet impossible:', sheetError.message);
    }
  }

  // ------------------------------------------------------------
  // 2. Liste d'attente → email d'excuse + invitation à choisir un créneau
  // ------------------------------------------------------------
  let waitlistCount = 0;
  try {
    // Toutes les entrées du cours (volumes minuscules) : on traite les
    // personnes encore en attente ET celles déjà annulées par ce traitement
    // dont l'email n'a pas pu partir (reprise après un échec d'envoi).
    const waitlistSnapshot = await db.collection('waitlist')
        .where('courseId', '==', courseId)
        .get();

    const waitlistEntries = waitlistSnapshot.docs.filter((doc) => {
      const entry = doc.data();
      if (entry.status === 'waiting') return true;
      return entry.status === 'cancelled' &&
        entry.cancelledReason === CANCELLATION_REASON &&
        !entry.cancellationEmailSent;
    });

    waitlistCount = waitlistSnapshot.docs.filter((doc) => {
      const entry = doc.data();
      return entry.status === 'waiting' ||
        (entry.status === 'cancelled' && entry.cancelledReason === CANCELLATION_REASON);
    }).length;

    for (const waitlistDoc of waitlistEntries) {
      const entry = waitlistDoc.data();
      const locale = getBookingLocale(entry);
      const emailContent = buildWaitlistCancellationEmail({
        locale,
        firstName: entry.firstName,
        courseName: course.title,
        courseDate: course.date,
        courseTime: course.time,
        rebookingUrl: getRebookingUrl(locale),
      });

      if (entry.status === 'waiting') {
        await waitlistDoc.ref.update({
          status: 'cancelled',
          cancelledReason: CANCELLATION_REASON,
          cancelledByOrganizer: true,
          cancelledAt: now,
        });
      }

      try {
        await sendEmail({
          to: entry.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        stats.emailsSent++;
        await waitlistDoc.ref.update({cancellationEmailSent: true, cancellationEmailSentAt: now});
      } catch (emailError) {
        stats.emailsFailed++;
        logger.error(`❌ Email liste d'attente non envoyé à ${entry.email}:`, emailError.message);
      }
    }
  } catch (waitlistError) {
    logger.error('❌ Erreur traitement liste d\'attente:', waitlistError.message);
  }

  // ------------------------------------------------------------
  // 3. Organisateur / formateur
  // ------------------------------------------------------------
  if (adminEmail && !course.cancellationAdminNotifiedAt) {
    const rebookingUrl = getRebookingUrl('fr');
    const adminContent = buildAdminCancellationEmail({
      course,
      participantCount,
      minParticipants,
      participants: participantsSummary,
      waitlistCount,
      rebookingUrl,
    });

    try {
      await sendEmail({
        to: adminEmail,
        subject: adminContent.subject,
        html: adminContent.html,
        text: adminContent.text,
      });
      stats.emailsSent++;
      // Marqueur : évite un doublon de récapitulatif lors d'une reprise.
      await db.collection('courses').doc(courseId).update({
        cancellationAdminNotifiedAt: now,
      });
    } catch (adminError) {
      logger.error(`❌ Email admin non envoyé (${adminEmail}):`, adminError.message);
      stats.emailsFailed++;
    }
  } else if (!adminEmail) {
    logger.warn('⚠️ ADMIN_EMAIL non configuré : notification organisateur ignorée');
  }

  // Notification terminée : sert de point de reprise si un envoi a échoué.
  // Tant que des emails n'ont pas pu partir, `cancellationNotifiedAt` reste
  // null : le tick suivant retente (les envois réussis sont marqués sur la
  // réservation, donc aucun doublon).
  const allEmailsSent = stats.emailsFailed === 0;
  if (!allEmailsSent) {
    logger.warn(
        `⚠️ ${stats.emailsFailed} email(s) d'annulation non envoyés ` +
        `pour le cours ${courseId} : nouvelle tentative au prochain tick`,
    );
  }

  await db.collection('courses').doc(courseId).update({
    cancellationNotifiedAt: allEmailsSent ? now : null,
    cancellationStats: {
      bookings: stats.bookings,
      emailsSent: stats.emailsSent,
      emailsFailed: stats.emailsFailed,
      passesRefunded: stats.passesRefunded,
      refundsRequired: stats.refundsRequired,
      sheetUpdated: stats.sheetUpdated,
      waitlist: waitlistCount,
    },
    updatedAt: now,
  });

  return stats;
}

/**
 * Vérifie tous les cours qui entrent dans la fenêtre et annule ceux qui n'ont
 * pas atteint leur minimum de participants.
 *
 * @param {Object} params
 * @param {Object} params.db - Instance Firestore
 * @param {Function} params.sendEmail - async ({to, subject, html, text})
 * @param {string} params.adminEmail - Email de l'organisateur / formateur
 * @param {Object} [params.passService] - Service de pass (recrédit des séances)
 * @param {Date} [params.now] - Instant de référence (tests)
 * @param {Object} [params.logger] - Logger (tests)
 * @returns {Promise<Object>} Statistiques globales
 */
async function runMinParticipantsCheck(params) {
  const {
    db,
    sendEmail,
    adminEmail,
    passService,
    googleService,
    sheetId,
    now = new Date(),
    logger = console,
    dryRun = false,
  } = params || {};

  if (typeof sendEmail !== 'function') {
    throw new Error('sendEmail is required');
  }

  const ctx = {
    db,
    now,
    sendEmail,
    adminEmail,
    passService,
    googleService,
    sheetId,
    logger,
  };
  const stats = {
    checked: 0,
    cancelled: 0,
    resumed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    passesRefunded: 0,
    refundsRequired: 0,
    sheetUpdated: 0,
    errors: 0,
    dryRun: dryRun,
    wouldCancel: [],
  };

  const windowEnd = new Date(
      now.getTime() + MIN_PARTICIPANTS_LEAD_HOURS * 60 * 60 * 1000,
  );

  // ------------------------------------------------------------
  // A. Cours actifs entrant dans la fenêtre des 2 heures
  // ------------------------------------------------------------
  let coursesSnapshot;
  try {
    coursesSnapshot = await db.collection('courses')
        .where('status', '==', 'active')
        .where('startTime', '>=', Timestamp.fromDate(now))
        .where('startTime', '<=', Timestamp.fromDate(windowEnd))
        .get();
  } catch (error) {
    logger.error('❌ Erreur lecture des cours:', error.message);
    throw error;
  }

  for (const courseDoc of coursesSnapshot.docs) {
    const course = courseDoc.data();
    const minParticipants = normalizeMinParticipants(course.minParticipants);
    if (minParticipants <= 1) continue; // Aucun minimum : rien à faire

    stats.checked++;

    try {
      const participantCount = await countActiveParticipants(db, courseDoc.id);

      if (!shouldCancelCourse({course, participantCount, minParticipants, now})) {
        continue;
      }

      if (dryRun) {
        stats.wouldCancel.push({
          courseId: courseDoc.id,
          title: course.title,
          date: course.date,
          time: course.time,
          participantCount: participantCount,
          minParticipants: minParticipants,
        });
        continue;
      }

      const result = await cancelCourse(ctx, courseDoc.id, course, {participantCount});
      stats.cancelled++;
      stats.emailsSent += result.emailsSent;
      stats.emailsFailed += result.emailsFailed;
      stats.passesRefunded += result.passesRefunded;
      stats.refundsRequired += result.refundsRequired;
      stats.sheetUpdated += result.sheetUpdated || 0;
    } catch (error) {
      stats.errors++;
      logger.error(`❌ Erreur annulation du cours ${courseDoc.id}:`, error.message);
    }
  }

  // ------------------------------------------------------------
  // B. Reprise : cours annulés dont les notifications n'ont pas abouti
  //    (crash / timeout au milieu de la boucle d'envoi)
  // ------------------------------------------------------------
  if (dryRun) {
    return stats;
  }

  try {
    const pendingSnapshot = await db.collection('courses')
        .where('status', '==', 'cancelled')
        .where('startTime', '>=', Timestamp.fromDate(now))
        .get();

    for (const courseDoc of pendingSnapshot.docs) {
      const course = courseDoc.data();
      if (course.cancelledReason !== CANCELLATION_REASON) continue;
      if (course.cancellationNotifiedAt) continue; // Déjà terminé

      stats.resumed++;
      try {
        const result = await cancelCourse(ctx, courseDoc.id, course, {
          participantCount: course.participantCountAtCancellation ??
            await countActiveParticipants(db, courseDoc.id),
          alreadyMarked: true,
        });
        stats.emailsSent += result.emailsSent;
        stats.emailsFailed += result.emailsFailed;
        stats.passesRefunded += result.passesRefunded;
        stats.refundsRequired += result.refundsRequired;
        stats.sheetUpdated += result.sheetUpdated || 0;
      } catch (error) {
        stats.errors++;
        logger.error(`❌ Erreur reprise notifications ${courseDoc.id}:`, error.message);
      }
    }
  } catch (error) {
    logger.warn('⚠️ Reprise des annulations en attente impossible:', error.message);
  }

  logger.log(
      `✅ Min participants check: ${stats.checked} vérifiés, ${stats.cancelled} annulés, ` +
      `${stats.emailsSent} emails, ${stats.passesRefunded} séances recréditées, ` +
      `${stats.sheetUpdated} lignes de suivi mises à jour, ${stats.errors} erreurs`,
  );

  return stats;
}

module.exports = {
  MIN_PARTICIPANTS_LEAD_HOURS,
  CANCELLATION_REASON,
  ACTIVE_BOOKING_STATUSES,
  CANCELLABLE_BOOKING_STATUSES,
  countActiveParticipants,
  toDate,
  normalizeMinParticipants,
  classifySettlement,
  PASS_PURCHASE_PRICING_OPTIONS,
  getBookingLocale,
  getRebookingUrl,
  shouldCancelCourse,
  buildParticipantCancellationEmail,
  buildWaitlistCancellationEmail,
  buildAdminCancellationEmail,
  cancelCourse,
  runMinParticipantsCheck,
};
