/**
 * Pass Service - Gestion des Flow Pass et Pass Semestriels
 *
 * Ce service gère :
 * - Vérification des pass actifs par email
 * - Création de nouveaux pass après achat
 * - Utilisation des séances (Flow Pass)
 * - Renouvellement des abonnements (Pass Semestriel)
 * - Annulation des pass
 */

/**
 * Configuration des types de pass
 */
const PASS_CONFIG = {
  flow_pass: {
    name: 'Flow Pass',
    sessions: 10,
    validityDays: 365, // 12 mois
    price: 21000, // 210 CHF en centimes
    isRecurring: false,
  },
  semester_pass: {
    name: 'Pass Semestriel',
    sessions: -1, // Illimité
    validityDays: 183, // ~6 mois
    price: 34000, // 340 CHF en centimes
    isRecurring: true,
  },
};

/**
 * Vérifie si un utilisateur a un pass actif
 * @param {Object} db - Instance Firestore
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<Object>} - Statut du pass
 */
async function checkUserPass(db, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  try {
    // Chercher le firstName et lastName dans les bookings précédents ou les pass
    let existingFirstName = '';
    let existingLastName = '';

    // D'abord chercher dans les bookings (sans orderBy pour éviter besoin d'index)
    const bookingsSnapshot = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .limit(10) // Limiter pour performance
        .get();

    if (!bookingsSnapshot.empty) {
      // Parcourir pour trouver le premier avec firstName/lastName
      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data();
        if (booking.firstName && !existingFirstName) {
          existingFirstName = booking.firstName;
        }
        if (booking.lastName && !existingLastName) {
          existingLastName = booking.lastName;
        }
        if (existingFirstName && existingLastName) break;
      }
    }

    // Si pas trouvé, chercher dans les pass (tous, pas seulement actifs)
    if (!existingFirstName || !existingLastName) {
      const allPassesSnapshot = await db.collection('userPasses')
          .where('email', '==', normalizedEmail)
          .limit(10) // Limiter pour performance
          .get();

      if (!allPassesSnapshot.empty) {
        // Parcourir pour trouver le premier avec firstName/lastName
        for (const doc of allPassesSnapshot.docs) {
          const pass = doc.data();
          if (pass.firstName && !existingFirstName) {
            existingFirstName = pass.firstName;
          }
          if (pass.lastName && !existingLastName) {
            existingLastName = pass.lastName;
          }
          if (existingFirstName && existingLastName) break;
        }
      }
    }

    // Chercher tous les pass actifs pour cet email
    const passesSnapshot = await db.collection('userPasses')
        .where('email', '==', normalizedEmail)
        .where('status', '==', 'active')
        .get();

    if (passesSnapshot.empty) {
      const isFirstVisit = bookingsSnapshot.empty;

      return {
        hasActivePass: false,
        isFirstVisit: isFirstVisit,
        canUseTrial: isFirstVisit,
        message: isFirstVisit ?
          'Bienvenue ! Votre première séance est offerte.' :
          'Vous n\'avez pas de pass actif. Choisissez une formule pour réserver.',
        availablePasses: [],
        firstName: existingFirstName,
        lastName: existingLastName,
      };
    }

    // Filtrer les pass valides (non expirés)
    const validPasses = [];

    for (const doc of passesSnapshot.docs) {
      const pass = doc.data();
      const expiryDate = pass.expiryDate?.toDate ? pass.expiryDate.toDate() : new Date(pass.expiryDate);

      // Vérifier si le pass est expiré
      if (expiryDate < now) {
        // Marquer comme expiré
        await doc.ref.update({
          status: 'expired',
          expiredAt: now,
        });
        continue;
      }

      // Vérifier si le Flow Pass a encore des séances
      if (pass.passType === 'flow_pass' && pass.sessionsRemaining <= 0) {
        await doc.ref.update({
          status: 'exhausted',
          exhaustedAt: now,
        });
        continue;
      }

      validPasses.push({
        passId: doc.id,
        passType: pass.passType,
        passName: PASS_CONFIG[pass.passType]?.name || pass.passType,
        sessionsTotal: pass.sessionsTotal,
        sessionsUsed: pass.sessionsUsed,
        sessionsRemaining: pass.sessionsRemaining,
        purchaseDate: pass.purchaseDate,
        expiryDate: expiryDate,
        daysRemaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
        isRecurring: pass.isRecurring || false,
      });
    }

    if (validPasses.length === 0) {
      return {
        hasActivePass: false,
        isFirstVisit: false,
        canUseTrial: false,
        message: 'Votre pass a expiré ou est épuisé. Renouvelez pour continuer.',
        availablePasses: [],
        firstName: existingFirstName,
        lastName: existingLastName,
      };
    }

    // Trier : Pass Semestriel en premier, puis par séances restantes
    validPasses.sort((a, b) => {
      if (a.passType === 'semester_pass' && b.passType !== 'semester_pass') return -1;
      if (a.passType !== 'semester_pass' && b.passType === 'semester_pass') return 1;
      return b.sessionsRemaining - a.sessionsRemaining;
    });

    const primaryPass = validPasses[0];

    // Si pas de firstName/lastName trouvé précédemment, chercher dans le pass actif
    if ((!existingFirstName || !existingLastName) && primaryPass) {
      const primaryPassDoc = passesSnapshot.docs.find((doc) => doc.id === primaryPass.passId);
      if (primaryPassDoc) {
        const passData = primaryPassDoc.data();
        if (passData.firstName && !existingFirstName) {
          existingFirstName = passData.firstName;
        }
        if (passData.lastName && !existingLastName) {
          existingLastName = passData.lastName;
        }
      }
    }

    return {
      hasActivePass: true,
      isFirstVisit: false,
      canUseTrial: false,
      pass: primaryPass,
      availablePasses: validPasses,
      message: primaryPass.passType === 'semester_pass' ?
        `Pass Semestriel actif (${primaryPass.daysRemaining} jours restants)` :
        `Flow Pass : ${primaryPass.sessionsRemaining}/${primaryPass.sessionsTotal} séances restantes`,
      firstName: existingFirstName,
      lastName: existingLastName,
    };
  } catch (error) {
    console.error('Error checking user pass:', error);
    throw error;
  }
}

/**
 * Crée un nouveau pass pour un utilisateur
 * @param {Object} db - Instance Firestore
 * @param {string} email - Email de l'utilisateur
 * @param {string} passType - Type de pass ('flow_pass' ou 'semester_pass')
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Object>} - Pass créé
 */
async function createUserPass(db, email, passType, options = {}) {
  const normalizedEmail = email.toLowerCase().trim();
  const config = PASS_CONFIG[passType];

  if (!config) {
    throw new Error(`Invalid pass type: ${passType}`);
  }

  const now = new Date();
  const expiryDate = new Date(now.getTime() + config.validityDays * 24 * 60 * 60 * 1000);

  const passData = {
    email: normalizedEmail,
    passType: passType,
    passName: config.name,
    sessionsTotal: config.sessions,
    sessionsUsed: 0,
    sessionsRemaining: config.sessions, // -1 pour illimité
    purchaseDate: now,
    expiryDate: expiryDate,
    status: 'active',
    isRecurring: config.isRecurring,
    price: config.price,
    currency: 'CHF',
    // Infos Stripe
    stripePaymentIntentId: options.stripePaymentIntentId || null,
    stripeSubscriptionId: options.stripeSubscriptionId || null,
    // Infos utilisateur
    firstName: options.firstName || '',
    lastName: options.lastName || '',
    phone: options.phone || '',
    // Historique
    sessionsHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  const passRef = await db.collection('userPasses').add(passData);

  console.log(`✅ Created ${passType} for ${normalizedEmail}: ${passRef.id}`);

  return {
    passId: passRef.id,
    ...passData,
  };
}

/**
 * Utilise une séance d'un pass
 * @param {Object} db - Instance Firestore
 * @param {string} passId - ID du pass
 * @param {string} courseId - ID du cours réservé
 * @returns {Promise<Object>} - Résultat avec séances restantes
 */
async function usePassSession(db, passId, courseId) {
  const passRef = db.collection('userPasses').doc(passId);

  return await db.runTransaction(async (transaction) => {
    const passDoc = await transaction.get(passRef);

    if (!passDoc.exists) {
      throw new Error('Pass not found');
    }

    const pass = passDoc.data();

    // Vérifier que le pass est actif
    if (pass.status !== 'active') {
      throw new Error(`Pass is ${pass.status}`);
    }

    // Pass semestriel : pas de décompte
    if (pass.sessionsRemaining === -1) {
      // Ajouter à l'historique quand même
      const historyEntry = {
        courseId: courseId,
        usedAt: new Date(),
        type: 'unlimited_session',
      };

      transaction.update(passRef, {
        sessionsHistory: [...(pass.sessionsHistory || []), historyEntry],
        updatedAt: new Date(),
      });

      return {
        success: true,
        sessionsRemaining: -1,
        isUnlimited: true,
      };
    }

    // Flow Pass : vérifier et décompter
    if (pass.sessionsRemaining <= 0) {
      throw new Error('No sessions remaining');
    }

    const newSessionsRemaining = pass.sessionsRemaining - 1;
    const newSessionsUsed = pass.sessionsUsed + 1;

    const historyEntry = {
      courseId: courseId,
      usedAt: new Date(),
      sessionNumber: newSessionsUsed,
    };

    const updateData = {
      sessionsUsed: newSessionsUsed,
      sessionsRemaining: newSessionsRemaining,
      sessionsHistory: [...(pass.sessionsHistory || []), historyEntry],
      updatedAt: new Date(),
    };

    // Marquer comme épuisé si c'était la dernière séance
    if (newSessionsRemaining === 0) {
      updateData.status = 'exhausted';
      updateData.exhaustedAt = new Date();
    }

    transaction.update(passRef, updateData);

    return {
      success: true,
      sessionsRemaining: newSessionsRemaining,
      sessionsUsed: newSessionsUsed,
      sessionsTotal: pass.sessionsTotal,
      isExhausted: newSessionsRemaining === 0,
    };
  });
}

/**
 * Renouvelle un Pass Semestriel (appelé par le webhook Stripe)
 * @param {Object} db - Instance Firestore
 * @param {string} subscriptionId - ID de l'abonnement Stripe
 * @returns {Promise<Object>}
 */
async function renewSemesterPass(db, subscriptionId) {
  const passesSnapshot = await db.collection('userPasses')
      .where('stripeSubscriptionId', '==', subscriptionId)
      .where('passType', '==', 'semester_pass')
      .limit(1)
      .get();

  if (passesSnapshot.empty) {
    throw new Error(`Semester pass not found for subscription: ${subscriptionId}`);
  }

  const passDoc = passesSnapshot.docs[0];
  const pass = passDoc.data();
  const now = new Date();

  // Prolonger de 6 mois à partir de maintenant
  const config = PASS_CONFIG.semester_pass;
  const newExpiryDate = new Date(now.getTime() + config.validityDays * 24 * 60 * 60 * 1000);

  await passDoc.ref.update({
    status: 'active',
    expiryDate: newExpiryDate,
    renewedAt: now,
    renewalCount: (pass.renewalCount || 0) + 1,
    updatedAt: now,
  });

  console.log(`✅ Semester Pass renewed for ${pass.email} until ${newExpiryDate.toISOString()}`);

  return {
    success: true,
    passId: passDoc.id,
    email: pass.email,
    newExpiryDate: newExpiryDate,
  };
}

/**
 * Annule un Pass Semestriel (appelé par le webhook Stripe)
 * @param {Object} db - Instance Firestore
 * @param {string} subscriptionId - ID de l'abonnement Stripe
 * @returns {Promise<Object>}
 */
async function cancelSemesterPass(db, subscriptionId) {
  const passesSnapshot = await db.collection('userPasses')
      .where('stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

  if (passesSnapshot.empty) {
    console.warn(`Semester pass not found for cancelled subscription: ${subscriptionId}`);
    return {success: false, error: 'Pass not found'};
  }

  const passDoc = passesSnapshot.docs[0];
  const pass = passDoc.data();
  const now = new Date();

  // Le pass reste actif jusqu'à sa date d'expiration, mais ne sera pas renouvelé
  await passDoc.ref.update({
    isRecurring: false,
    cancelledAt: now,
    cancellationReason: 'subscription_deleted',
    updatedAt: now,
  });

  console.log(`⚠️ Semester Pass cancelled for ${pass.email} (valid until ${pass.expiryDate})`);

  return {
    success: true,
    passId: passDoc.id,
    email: pass.email,
    expiryDate: pass.expiryDate,
  };
}

/**
 * Récupère l'historique des pass d'un utilisateur
 * @param {Object} db - Instance Firestore
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<Array>}
 */
async function getUserPassHistory(db, email) {
  const normalizedEmail = email.toLowerCase().trim();

  const passesSnapshot = await db.collection('userPasses')
      .where('email', '==', normalizedEmail)
      .orderBy('purchaseDate', 'desc')
      .get();

  return passesSnapshot.docs.map((doc) => ({
    passId: doc.id,
    ...doc.data(),
  }));
}

/**
 * Annule une séance (remboursement d'une utilisation)
 * Utile si un cours est annulé par l'organisateur
 * @param {Object} db - Instance Firestore
 * @param {string} passId - ID du pass
 * @param {string} courseId - ID du cours annulé
 * @returns {Promise<Object>}
 */
async function refundPassSession(db, passId, courseId) {
  const passRef = db.collection('userPasses').doc(passId);
  const passDoc = await passRef.get();

  if (!passDoc.exists) {
    throw new Error('Pass not found');
  }

  const pass = passDoc.data();

  // Pas de remboursement pour les pass illimités
  if (pass.sessionsRemaining === -1) {
    return {success: true, message: 'Unlimited pass - no refund needed'};
  }

  // Vérifier que la séance a bien été utilisée pour ce cours
  const sessionUsed = (pass.sessionsHistory || []).find((h) => h.courseId === courseId);
  if (!sessionUsed) {
    return {success: false, error: 'Session not found in history'};
  }

  const newSessionsRemaining = pass.sessionsRemaining + 1;
  const newSessionsUsed = Math.max(0, pass.sessionsUsed - 1);

  await passRef.update({
    sessionsUsed: newSessionsUsed,
    sessionsRemaining: newSessionsRemaining,
    status: 'active', // Réactiver si était épuisé
    sessionsHistory: (pass.sessionsHistory || []).map((h) =>
      h.courseId === courseId ? {...h, refunded: true, refundedAt: new Date()} : h,
    ),
    updatedAt: new Date(),
  });

  return {
    success: true,
    sessionsRemaining: newSessionsRemaining,
    message: 'Session refunded successfully',
  };
}

module.exports = {
  PASS_CONFIG,
  checkUserPass,
  createUserPass,
  usePassSession,
  renewSemesterPass,
  cancelSemesterPass,
  getUserPassHistory,
  refundPassSession,
};
