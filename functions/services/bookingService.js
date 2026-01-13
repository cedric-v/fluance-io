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
const crypto = require('crypto');

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

      // 2. Vérifier si l'utilisateur a déjà réservé ce cours (AVANT de compter les places)
      // Cette vérification doit être faite en premier pour éviter les doublons
      const existingBookingQuery = db.collection('bookings')
          .where('courseId', '==', courseId)
          .where('email', '==', userData.email.toLowerCase())
          .where('status', 'in', [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.PENDING_CASH,
            BOOKING_STATUS.PENDING,
          ])
          .limit(1);

      // Utiliser transaction.get() pour rendre la vérification atomique
      // Note: transaction.get() ne supporte pas les requêtes avec where(),
      // mais on peut lire les documents retournés dans la transaction
      const existingBookingSnapshot = await existingBookingQuery.get();

      if (!existingBookingSnapshot.empty) {
        throw new Error('ALREADY_BOOKED');
      }

      // 3. Compter les réservations existantes (après vérification doublon)
      const bookingsSnapshot = await db.collection('bookings')
          .where('courseId', '==', courseId)
          .where('status', 'in', [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_CASH])
          .get();

      const participantCount = bookingsSnapshot.size;
      const spotsRemaining = course.maxCapacity - participantCount;

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
      // Créer un token de désinscription
      const cancellationTokenResult = await createCancellationToken(db, bookingId, 30);
      const cancellationUrl = cancellationTokenResult.success ? cancellationTokenResult.cancellationUrl : null;

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
            cancellationUrl: cancellationUrl,
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

    // Note: Pas de remboursement automatique
    // L'utilisateur peut choisir un autre cours à la place
    // Si un remboursement est nécessaire, il doit être fait manuellement

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

    // Récupérer les infos du cours
    const courseDoc = await db.collection('courses').doc(courseId).get();
    const course = courseDoc.exists ? courseDoc.data() : null;

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
          courseName: course?.title || 'Cours Fluance',
          courseDate: course?.date || '',
          courseTime: course?.time || '',
          bookingLink: `https://fluance.io/presentiel/reserver/?course=${courseId}`,
        },
      },
    });

    console.log(`📧 Notified ${waitlistData.email} about available spot`);
  } catch (error) {
    console.error('Error notifying waitlist:', error);
  }
}

/**
 * Récupère la position d'un utilisateur dans la liste d'attente
 * @param {Object} db - Instance Firestore
 * @param {string} email - Email de l'utilisateur
 * @param {string} courseId - ID du cours
 * @returns {Promise<Object>}
 */
async function getWaitlistPosition(db, email, courseId) {
  try {
    // Récupérer toutes les entrées en liste d'attente pour ce cours
    const allWaitlist = await db.collection('waitlist')
        .where('courseId', '==', courseId)
        .where('status', '==', BOOKING_STATUS.WAITING)
        .orderBy('createdAt', 'asc')
        .get();

    if (allWaitlist.empty) {
      return {success: false, error: 'NO_WAITLIST'};
    }

    // Trouver la position de l'utilisateur
    const normalizedEmail = email.toLowerCase();
    let position = 0;
    let userDoc = null;

    for (let i = 0; i < allWaitlist.docs.length; i++) {
      const doc = allWaitlist.docs[i];
      const data = doc.data();
      if (data.email.toLowerCase() === normalizedEmail) {
        position = i + 1;
        userDoc = doc;
        break;
      }
    }

    if (!userDoc) {
      return {success: false, error: 'NOT_IN_WAITLIST'};
    }

    return {
      success: true,
      position: position,
      totalWaiting: allWaitlist.size,
      waitlistId: userDoc.id,
    };
  } catch (error) {
    console.error('Error getting waitlist position:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Retire un utilisateur de la liste d'attente
 * @param {Object} db - Instance Firestore
 * @param {string} waitlistId - ID de l'entrée dans la liste d'attente
 * @param {string} email - Email de l'utilisateur (vérification)
 * @returns {Promise<Object>}
 */
async function removeFromWaitlist(db, waitlistId, email) {
  try {
    const waitlistDoc = await db.collection('waitlist').doc(waitlistId).get();

    if (!waitlistDoc.exists) {
      return {success: false, error: 'WAITLIST_NOT_FOUND'};
    }

    const waitlistData = waitlistDoc.data();

    if (waitlistData.email.toLowerCase() !== email.toLowerCase()) {
      return {success: false, error: 'EMAIL_MISMATCH'};
    }

    if (waitlistData.status !== BOOKING_STATUS.WAITING) {
      return {success: false, error: 'ALREADY_PROCESSED'};
    }

    await waitlistDoc.ref.update({
      status: 'removed',
      removedAt: new Date(),
    });

    return {
      success: true,
      message: 'Vous avez été retiré de la liste d\'attente',
    };
  } catch (error) {
    console.error('Error removing from waitlist:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Transfère une réservation vers un autre cours (sans remboursement)
 * @param {Object} db - Instance Firestore
 * @param {string} bookingId - ID de la réservation à transférer
 * @param {string} newCourseId - ID du nouveau cours
 * @param {string} email - Email de l'utilisateur (vérification)
 * @returns {Promise<Object>}
 */
async function transferBooking(db, bookingId, newCourseId, email) {
  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return {success: false, error: 'BOOKING_NOT_FOUND'};
    }

    const booking = bookingDoc.data();

    // Vérifier l'email
    if (booking.email.toLowerCase() !== email.toLowerCase()) {
      return {success: false, error: 'EMAIL_MISMATCH'};
    }

    // Vérifier que la réservation peut être transférée
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return {success: false, error: 'BOOKING_ALREADY_CANCELLED'};
    }

    // Vérifier le nouveau cours
    const newCourseDoc = await db.collection('courses').doc(newCourseId).get();
    if (!newCourseDoc.exists) {
      return {success: false, error: 'NEW_COURSE_NOT_FOUND'};
    }

    const newCourse = newCourseDoc.data();

    // Vérifier la disponibilité du nouveau cours
    const availability = await getCourseAvailability(db, newCourseId);
    if (!availability.available) {
      return {
        success: false,
        error: 'COURSE_FULL',
        message: 'Le nouveau cours est complet',
      };
    }

    // Vérifier si l'utilisateur n'est pas déjà inscrit au nouveau cours
    const existingBooking = await db.collection('bookings')
        .where('courseId', '==', newCourseId)
        .where('email', '==', email.toLowerCase())
        .where('status', 'in', [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_CASH, BOOKING_STATUS.PENDING])
        .limit(1)
        .get();

    if (!existingBooking.empty) {
      return {success: false, error: 'ALREADY_BOOKED', message: 'Vous êtes déjà inscrit à ce cours'};
    }

    // Utiliser une transaction pour garantir la cohérence
    await db.runTransaction(async (transaction) => {
      // Annuler l'ancienne réservation (sans remboursement)
      transaction.update(bookingRef, {
        status: BOOKING_STATUS.CANCELLED,
        transferredTo: newCourseId,
        cancelledAt: new Date(),
        cancellationReason: 'Transféré vers un autre cours',
        updatedAt: new Date(),
      });

      // Décrémenter le compteur de l'ancien cours
      const oldCourseRef = db.collection('courses').doc(booking.courseId);
      const oldCourseDoc = await transaction.get(oldCourseRef);
      if (oldCourseDoc.exists) {
        const oldCourse = oldCourseDoc.data();
        transaction.update(oldCourseRef, {
          participantCount: Math.max(0, (oldCourse.participantCount || 0) - 1),
        });
      }

      // Créer la nouvelle réservation
      const newBookingId = db.collection('bookings').doc().id;
      const newBookingData = {
        bookingId: newBookingId,
        courseId: newCourseId,
        courseName: newCourse.title,
        courseDate: newCourse.date,
        courseTime: newCourse.time,
        courseLocation: newCourse.location,
        email: booking.email,
        firstName: booking.firstName,
        lastName: booking.lastName,
        phone: booking.phone,
        paymentMethod: booking.paymentMethod,
        pricingOption: booking.pricingOption,
        amount: booking.amount,
        currency: booking.currency,
        status: booking.status, // Conserver le même statut (confirmé, pending_cash, etc.)
        stripePaymentIntentId: booking.stripePaymentIntentId,
        transferredFrom: bookingId,
        createdAt: new Date(),
        updatedAt: new Date(),
        paidAt: booking.paidAt,
        notes: `Transféré depuis ${booking.courseName} (${booking.courseDate})`,
      };

      transaction.set(db.collection('bookings').doc(newBookingId), newBookingData);

      // Incrémenter le compteur du nouveau cours
      transaction.update(db.collection('courses').doc(newCourseId), {
        participantCount: (newCourse.participantCount || 0) + 1,
      });
    });

    return {
      success: true,
      bookingId: bookingId,
      newBookingId: newBookingId,
      message: 'Réservation transférée avec succès',
    };
  } catch (error) {
    console.error('Error transferring booking:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Génère un token unique pour la désinscription
 * @returns {string}
 */
function generateCancellationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Crée un token de désinscription pour une réservation
 * @param {Object} db - Instance Firestore
 * @param {string} bookingId - ID de la réservation
 * @param {number} expirationDays - Nombre de jours avant expiration (défaut: 30)
 * @returns {Promise<Object>}
 */
async function createCancellationToken(db, bookingId, expirationDays = 30) {
  try {
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return {success: false, error: 'BOOKING_NOT_FOUND'};
    }

    const booking = bookingDoc.data();
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return {success: false, error: 'ALREADY_CANCELLED'};
    }

    const token = generateCancellationToken();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);

    // Stocker le token dans Firestore
    await db.collection('cancellationTokens').doc(token).set({
      bookingId: bookingId,
      email: booking.email,
      courseId: booking.courseId,
      createdAt: new Date(),
      expiresAt: expirationDate,
      used: false,
    });

    return {
      success: true,
      token: token,
      cancellationUrl: `https://fluance.io/presentiel/desinscription?token=${token}`,
      expiresAt: expirationDate,
    };
  } catch (error) {
    console.error('Error creating cancellation token:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Valide et utilise un token de désinscription
 * @param {Object} db - Instance Firestore
 * @param {string} token - Token de désinscription
 * @returns {Promise<Object>}
 */
async function validateCancellationToken(db, token) {
  try {
    const tokenDoc = await db.collection('cancellationTokens').doc(token).get();

    if (!tokenDoc.exists) {
      return {success: false, error: 'TOKEN_NOT_FOUND'};
    }

    const tokenData = tokenDoc.data();

    // Vérifier si déjà utilisé
    if (tokenData.used) {
      return {success: false, error: 'TOKEN_ALREADY_USED'};
    }

    // Vérifier l'expiration
    const now = new Date();
    const expiresAt = tokenData.expiresAt.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
    if (now > expiresAt) {
      return {success: false, error: 'TOKEN_EXPIRED'};
    }

    // Récupérer la réservation
    const bookingDoc = await db.collection('bookings').doc(tokenData.bookingId).get();
    if (!bookingDoc.exists) {
      return {success: false, error: 'BOOKING_NOT_FOUND'};
    }

    const booking = bookingDoc.data();

    // Vérifier que la réservation n'est pas déjà annulée
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      // Marquer le token comme utilisé quand même
      await tokenDoc.ref.update({used: true, usedAt: new Date()});
      return {success: false, error: 'ALREADY_CANCELLED'};
    }

    return {
      success: true,
      bookingId: tokenData.bookingId,
      booking: booking,
      courseId: tokenData.courseId,
      email: tokenData.email,
    };
  } catch (error) {
    console.error('Error validating cancellation token:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Marque un token de désinscription comme utilisé
 * @param {Object} db - Instance Firestore
 * @param {string} token - Token de désinscription
 * @returns {Promise<void>}
 */
async function markCancellationTokenAsUsed(db, token) {
  await db.collection('cancellationTokens').doc(token).update({
    used: true,
    usedAt: new Date(),
  });
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
  getWaitlistPosition,
  removeFromWaitlist,
  transferBooking,
  createCancellationToken,
  validateCancellationToken,
  markCancellationTokenAsUsed,
};
