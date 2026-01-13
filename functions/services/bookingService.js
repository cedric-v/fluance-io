/**
 * Booking Service - Système de réservation de cours
 *
 * Ce service gère :
 * - Synchronisation Google Calendar -> Firestore
 * - Vérification des places disponibles
 * - Réservation transactionnelle
 * - Gestion des paiements (Stripe, espèces, SEPA)
 * - Liste d'attente
 * - Notifications email
 */

const {googleService} = require('./googleService');

/**
 * Configuration des prix (en centimes CHF)
 */
const PRICING = {
  SINGLE: {
    id: 'single',
    name: 'À la carte',
    amount: 2500, // 25 CHF
    description: 'Séance unique',
  },
  FLOW_PASS: {
    id: 'flow_pass',
    name: 'Flow Pass',
    amount: 21000, // 210 CHF
    sessions: 10, // 10 séances
    validityDays: 365,
    description: '10 séances (valable 12 mois)',
  },
  SEMESTER_PASS: {
    id: 'semester_pass',
    name: 'Pass Semestriel',
    amount: 34000, // 340 CHF
    recurring: true,
    intervalMonths: 6,
    description: 'Accès illimité pendant 6 mois (renouvellement automatique)',
  },
  TRIAL: {
    id: 'trial',
    name: 'Cours d\'essai',
    amount: 0,
    description: 'Première séance offerte',
  },
};

/**
 * Types de paiement supportés
 */
const PAYMENT_METHODS = {
  CARD: 'card', // Carte bancaire via Stripe
  TWINT: 'twint', // TWINT via Stripe
  SEPA: 'sepa_debit', // Prélèvement SEPA via Stripe
  CASH: 'cash', // Espèces (paiement sur place)
};

/**
 * Statuts de réservation
 */
const BOOKING_STATUS = {
  PENDING: 'pending', // En attente de paiement
  CONFIRMED: 'confirmed', // Confirmé et payé
  PENDING_CASH: 'pending_cash', // Confirmé, paiement espèces attendu
  CANCELLED: 'cancelled', // Annulé
  WAITING: 'waiting', // En liste d'attente
  COMPLETED: 'completed', // Cours terminé
};

/**
 * Vérifie la disponibilité d'un cours et retourne les infos
 * @param {Object} db - Instance Firestore
 * @param {string} courseId - ID du cours
 * @returns {Promise<Object>} - Status du cours
 */
async function getCourseAvailability(db, courseId) {
  const courseDoc = await db.collection('courses').doc(courseId).get();

  if (!courseDoc.exists) {
    return {
      available: false,
      error: 'COURSE_NOT_FOUND',
      message: 'Ce cours n\'existe pas',
    };
  }

  const course = courseDoc.data();

  // Compter les réservations confirmées
  const confirmedBookings = await db.collection('bookings')
      .where('courseId', '==', courseId)
      .where('status', 'in', [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_CASH])
      .get();

  const participantCount = confirmedBookings.size;
  const spotsRemaining = course.maxCapacity - participantCount;

  // Vérifier si le cours est passé
  const now = new Date();
  const courseDate = course.startTime?.toDate ? course.startTime.toDate() : new Date(course.startTime);
  const isPast = courseDate < now;

  return {
    available: !isPast && spotsRemaining > 0,
    courseId: courseId,
    title: course.title,
    date: course.date,
    time: course.time,
    location: course.location,
    maxCapacity: course.maxCapacity,
    participantCount: participantCount,
    spotsRemaining: spotsRemaining,
    isFull: spotsRemaining <= 0,
    isPast: isPast,
    price: course.price || PRICING.SINGLE.amount / 100,
  };
}

/**
 * Traite une réservation de manière transactionnelle
 * @param {Object} db - Instance Firestore
 * @param {Object} stripe - Instance Stripe
 * @param {string} courseId - ID du cours
 * @param {Object} userData - Données utilisateur
 * @param {string} paymentMethod - Méthode de paiement
 * @param {string} pricingOption - Option tarifaire choisie
 * @returns {Promise<Object>} - Résultat de la réservation
 */
async function processBooking(db, stripe, courseId, userData, paymentMethod, pricingOption = 'single') {
  const bookingId = db.collection('bookings').doc().id;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Vérifier la disponibilité
      const courseRef = db.collection('courses').doc(courseId);
      const courseDoc = await transaction.get(courseRef);

      if (!courseDoc.exists) {
        throw new Error('COURSE_NOT_FOUND');
      }

      const course = courseDoc.data();

      // 2. Compter les réservations existantes
      const bookingsSnapshot = await db.collection('bookings')
          .where('courseId', '==', courseId)
          .where('status', 'in', [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_CASH])
          .get();

      const participantCount = bookingsSnapshot.size;
      const spotsRemaining = course.maxCapacity - participantCount;

      // 3. Vérifier si l'utilisateur a déjà réservé ce cours
      const existingBooking = await db.collection('bookings')
          .where('courseId', '==', courseId)
          .where('email', '==', userData.email.toLowerCase())
          .where('status', 'in', [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.PENDING_CASH,
            BOOKING_STATUS.PENDING,
          ])
          .get();

      if (!existingBooking.empty) {
        throw new Error('ALREADY_BOOKED');
      }

      // 4. Déterminer le prix
      const pricing = PRICING[pricingOption.toUpperCase()] || PRICING.SINGLE;
      const amount = pricing.amount;

      // 5. Si plein, ajouter à la liste d'attente
      if (spotsRemaining <= 0) {
        const waitlistData = {
          bookingId: bookingId,
          courseId: courseId,
          email: userData.email.toLowerCase(),
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || '',
          status: BOOKING_STATUS.WAITING,
          position: participantCount - course.maxCapacity + 1,
          createdAt: new Date(),
          notifiedAt: null,
        };

        const waitlistRef = db.collection('waitlist').doc(bookingId);
        transaction.set(waitlistRef, waitlistData);

        return {
          success: true,
          status: 'waitlisted',
          bookingId: bookingId,
          position: waitlistData.position,
          message: 'Vous avez été ajouté à la liste d\'attente',
        };
      }

      // 6. Créer la réservation
      const bookingData = {
        bookingId: bookingId,
        courseId: courseId,
        courseName: course.title,
        courseDate: course.date,
        courseTime: course.time,
        courseLocation: course.location,
        email: userData.email.toLowerCase(),
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        paymentMethod: paymentMethod,
        pricingOption: pricingOption,
        amount: amount,
        currency: 'CHF',
        status: BOOKING_STATUS.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripePaymentIntentId: null,
        stripeClientSecret: null,
        paidAt: null,
        notes: '',
      };

      // 7. Gérer selon le mode de paiement
      if (paymentMethod === PAYMENT_METHODS.CASH) {
        // Paiement espèces : confirmer immédiatement avec flag
        bookingData.status = BOOKING_STATUS.PENDING_CASH;
        bookingData.notes = 'Paiement en espèces à régler sur place';

        const bookingRef = db.collection('bookings').doc(bookingId);
        transaction.set(bookingRef, bookingData);

        // Mettre à jour le compteur de participants
        transaction.update(courseRef, {
          participantCount: participantCount + 1,
        });

        return {
          success: true,
          status: 'confirmed_pending_cash',
          bookingId: bookingId,
          message: 'Réservation confirmée. Paiement à régler sur place.',
          requiresPayment: false,
        };
      }

      // 8. Pour les paiements en ligne, créer un PaymentIntent Stripe
      if (amount > 0 && stripe) {
        const paymentIntentData = {
          amount: amount,
          currency: 'chf',
          payment_method_types: ['card', 'twint'],
          metadata: {
            bookingId: bookingId,
            courseId: courseId,
            email: userData.email,
            type: 'course_booking',
          },
        };

        // Ajouter SEPA si c'est la méthode choisie
        if (paymentMethod === PAYMENT_METHODS.SEPA) {
          paymentIntentData.payment_method_types = ['sepa_debit'];
          paymentIntentData.mandate_data = {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: userData.ipAddress || '0.0.0.0',
                user_agent: userData.userAgent || 'Unknown',
              },
            },
          };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

        bookingData.stripePaymentIntentId = paymentIntent.id;
        bookingData.stripeClientSecret = paymentIntent.client_secret;
      } else if (amount === 0) {
        // Cours gratuit (essai)
        bookingData.status = BOOKING_STATUS.CONFIRMED;
        bookingData.paidAt = new Date();
      }

      const bookingRef = db.collection('bookings').doc(bookingId);
      transaction.set(bookingRef, bookingData);

      return {
        success: true,
        status: amount === 0 ? 'confirmed' : 'pending_payment',
        bookingId: bookingId,
        clientSecret: bookingData.stripeClientSecret,
        amount: amount,
        requiresPayment: amount > 0,
        message: amount === 0 ?
          'Réservation confirmée pour votre cours d\'essai gratuit !' :
          'Veuillez procéder au paiement pour confirmer votre réservation.',
      };
    });

    return result;
  } catch (error) {
    console.error('Error processing booking:', error);

    const errorMessages = {
      'COURSE_NOT_FOUND': 'Ce cours n\'existe pas ou n\'est plus disponible.',
      'ALREADY_BOOKED': 'Vous avez déjà une réservation pour ce cours.',
    };

    return {
      success: false,
      error: error.message,
      message: errorMessages[error.message] || 'Une erreur est survenue lors de la réservation.',
    };
  }
}

/**
 * Confirme une réservation après paiement réussi
 * @param {Object} db - Instance Firestore
 * @param {string} bookingId - ID de la réservation
 * @param {string} paymentIntentId - ID du PaymentIntent Stripe
 * @returns {Promise<Object>}
 */
async function confirmBookingPayment(db, bookingId, paymentIntentId) {
  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return {success: false, error: 'BOOKING_NOT_FOUND'};
    }

    const booking = bookingDoc.data();

    // Vérifier que le PaymentIntent correspond
    if (booking.stripePaymentIntentId !== paymentIntentId) {
      return {success: false, error: 'PAYMENT_MISMATCH'};
    }

    // Mettre à jour la réservation
    await bookingRef.update({
      status: BOOKING_STATUS.CONFIRMED,
      paidAt: new Date(),
      updatedAt: new Date(),
    });

    // Mettre à jour le compteur du cours
    const courseRef = db.collection('courses').doc(booking.courseId);
    const courseDoc = await courseRef.get();
    if (courseDoc.exists) {
      const course = courseDoc.data();
      await courseRef.update({
        participantCount: (course.participantCount || 0) + 1,
      });
    }

    // Ajouter au Google Sheet
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      if (sheetId) {
        await googleService.appendUserToSheet(
            sheetId,
            booking.courseId,
            {
              firstName: booking.firstName,
              lastName: booking.lastName,
              email: booking.email,
              phone: booking.phone,
            },
            {
              courseName: booking.courseName,
              courseDate: booking.courseDate,
              courseTime: booking.courseTime,
              paymentMethod: booking.paymentMethod,
              paymentStatus: 'Payé',
              amount: booking.amount / 100 + ' CHF',
              status: 'Confirmé',
              bookingId: bookingId,
            },
        );
      }
    } catch (sheetError) {
      console.error('Error updating sheet:', sheetError);
      // Ne pas bloquer le processus
    }

    // Envoyer l'email de confirmation via l'extension Firebase
    try {
      await db.collection('mail').add({
        to: booking.email,
        template: {
          name: 'booking-confirmation',
          data: {
            firstName: booking.firstName,
            courseName: booking.courseName,
            courseDate: booking.courseDate,
            courseTime: booking.courseTime,
            location: booking.courseLocation,
            bookingId: bookingId,
          },
        },
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    return {
      success: true,
      bookingId: bookingId,
      status: BOOKING_STATUS.CONFIRMED,
    };
  } catch (error) {
    console.error('Error confirming booking:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Annule une réservation
 * @param {Object} db - Instance Firestore
 * @param {Object} stripe - Instance Stripe (optionnel)
 * @param {string} bookingId - ID de la réservation
 * @param {string} reason - Raison de l'annulation
 * @returns {Promise<Object>}
 */
async function cancelBooking(db, stripe, bookingId, reason = '') {
  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return {success: false, error: 'BOOKING_NOT_FOUND'};
    }

    const booking = bookingDoc.data();

    // Si déjà annulé
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return {success: false, error: 'ALREADY_CANCELLED'};
    }

    // Rembourser si payé via Stripe
    if (booking.status === BOOKING_STATUS.CONFIRMED &&
        booking.stripePaymentIntentId &&
        stripe) {
      try {
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });
      } catch (refundError) {
        console.error('Error refunding:', refundError);
        // Continuer malgré l'erreur de remboursement
      }
    }

    // Mettre à jour la réservation
    await bookingRef.update({
      status: BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date(),
    });

    // Décrémenter le compteur du cours si était confirmé
    if ([BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_CASH].includes(booking.status)) {
      const courseRef = db.collection('courses').doc(booking.courseId);
      const courseDoc = await courseRef.get();
      if (courseDoc.exists) {
        const course = courseDoc.data();
        await courseRef.update({
          participantCount: Math.max(0, (course.participantCount || 0) - 1),
        });

        // Notifier la première personne en liste d'attente
        await notifyFirstInWaitlist(db, booking.courseId);
      }
    }

    return {
      success: true,
      bookingId: bookingId,
      message: 'Réservation annulée avec succès',
    };
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Notifie la première personne en liste d'attente qu'une place s'est libérée
 * @param {Object} db - Instance Firestore
 * @param {string} courseId - ID du cours
 */
async function notifyFirstInWaitlist(db, courseId) {
  try {
    const waitlistSnapshot = await db.collection('waitlist')
        .where('courseId', '==', courseId)
        .where('status', '==', BOOKING_STATUS.WAITING)
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

    if (waitlistSnapshot.empty) {
      return;
    }

    const waitlistDoc = waitlistSnapshot.docs[0];
    const waitlistData = waitlistDoc.data();

    // Mettre à jour le statut
    await waitlistDoc.ref.update({
      status: 'notified',
      notifiedAt: new Date(),
    });

    // Envoyer un email de notification
    await db.collection('mail').add({
      to: waitlistData.email,
      template: {
        name: 'waitlist-spot-available',
        data: {
          firstName: waitlistData.firstName,
          courseId: courseId,
          bookingLink: `https://fluance.io/presentiel/reserver/?course=${courseId}`,
        },
      },
    });

    console.log(`📧 Notified ${waitlistData.email} about available spot`);
  } catch (error) {
    console.error('Error notifying waitlist:', error);
  }
}

module.exports = {
  PRICING,
  PAYMENT_METHODS,
  BOOKING_STATUS,
  getCourseAvailability,
  processBooking,
  confirmBookingPayment,
  cancelBooking,
  notifyFirstInWaitlist,
};
