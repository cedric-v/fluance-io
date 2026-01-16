/**
 * Script pour lister les utilisateurs inscrits aux cours d'essai gratuits en présentiel
 * Usage: node scripts/list-trial-bookings.js [options]
 * 
 * Options:
 *   --all : Afficher tous les cours d'essai (y compris passés)
 *   --future : Afficher uniquement les cours d'essai à venir (défaut)
 *   --past : Afficher uniquement les cours d'essai passés
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin avec credentials
try {
  if (!admin.apps.length) {
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, '../functions/serviceAccountKey.json'),
      path.join(__dirname, '../new-project-service-account.json'),
    ];
    
    let serviceAccountPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
      }
    }
    
    if (serviceAccountPath) {
      console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'fluance-protected-content',
      });
    } else {
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function listTrialBookings(options = {}) {
  const showAll = options.all || false;
  const showFuture = options.future !== false; // Par défaut true
  const showPast = options.past || false;

  console.log('🔍 Recherche des cours d\'essai gratuits en présentiel...\n');

  try {
    // Récupérer toutes les réservations
    let bookingsSnapshot;
    
    if (showAll) {
      bookingsSnapshot = await db.collection('bookings')
          .where('status', '==', 'confirmed')
          .get();
    } else {
      bookingsSnapshot = await db.collection('bookings')
          .where('status', '==', 'confirmed')
          .get();
    }

    const now = new Date();
    const trialBookings = [];

    bookingsSnapshot.docs.forEach((doc) => {
      const booking = doc.data();
      
      // Filtrer les cours d'essai gratuits
      const isTrial = booking.amount === 0 || 
                     booking.pricingOption === 'trial' || 
                     booking.paymentMethod === 'Cours d\'essai gratuit';

      if (isTrial) {
        // Parser la date du cours
        let courseDate = null;
        if (booking.courseDate) {
          // Format peut être "DD/MM/YYYY" ou autre
          const dateStr = booking.courseDate;
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            courseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            courseDate = new Date(dateStr);
          }
        }

        const isPast = courseDate && courseDate < now;
        const isFuture = !courseDate || courseDate >= now;

        // Filtrer selon les options
        if (showAll) {
          trialBookings.push({...booking, id: doc.id, courseDateObj: courseDate});
        } else if (showFuture && isFuture) {
          trialBookings.push({...booking, id: doc.id, courseDateObj: courseDate});
        } else if (showPast && isPast) {
          trialBookings.push({...booking, id: doc.id, courseDateObj: courseDate});
        }
      }
    });

    // Trier par date de cours (les plus récents en premier)
    trialBookings.sort((a, b) => {
      if (!a.courseDateObj && !b.courseDateObj) return 0;
      if (!a.courseDateObj) return 1;
      if (!b.courseDateObj) return -1;
      return b.courseDateObj - a.courseDateObj;
    });

    if (trialBookings.length === 0) {
      console.log('❌ Aucun cours d\'essai gratuit trouvé.\n');
      return;
    }

    console.log(`✅ ${trialBookings.length} cours d'essai gratuit(s) trouvé(s):\n`);
    console.log('═'.repeat(100));
    
    // Grouper par utilisateur
    const usersMap = new Map();
    
    trialBookings.forEach((booking) => {
      const email = booking.email.toLowerCase().trim();
      if (!usersMap.has(email)) {
        usersMap.set(email, {
          email: email,
          firstName: booking.firstName || '',
          lastName: booking.lastName || '',
          phone: booking.phone || '',
          bookings: [],
        });
      }
      usersMap.get(email).bookings.push(booking);
    });

    // Afficher par utilisateur
    let userIndex = 1;
    for (const [email, userData] of usersMap.entries()) {
      console.log(`\n👤 Utilisateur ${userIndex}: ${userData.firstName} ${userData.lastName}`);
      console.log(`   📧 Email: ${email}`);
      if (userData.phone) {
        console.log(`   📞 Téléphone: ${userData.phone}`);
      }
      console.log(`   📋 Nombre de cours d'essai: ${userData.bookings.length}`);
      
      userData.bookings.forEach((booking, idx) => {
        const isPast = booking.courseDateObj && booking.courseDateObj < now;
        const statusIcon = isPast ? '✅' : '📅';
        const statusText = isPast ? '(Passé)' : '(À venir)';
        
        console.log(`\n   ${statusIcon} Cours ${idx + 1} ${statusText}:`);
        console.log(`      - Cours: ${booking.courseName || 'N/A'}`);
        console.log(`      - Date: ${booking.courseDate || 'N/A'}`);
        console.log(`      - Heure: ${booking.courseTime || 'N/A'}`);
        console.log(`      - Lieu: ${booking.courseLocation || 'N/A'}`);
        console.log(`      - Booking ID: ${booking.id}`);
        console.log(`      - Créé le: ${booking.createdAt?.toDate ? booking.createdAt.toDate().toLocaleString('fr-FR') : booking.createdAt || 'N/A'}`);
      });
      
      userIndex++;
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n📊 Résumé:`);
    console.log(`   - Nombre d'utilisateurs uniques: ${usersMap.size}`);
    console.log(`   - Nombre total de cours d'essai: ${trialBookings.length}`);
    
    const futureCount = trialBookings.filter(b => !b.courseDateObj || b.courseDateObj >= now).length;
    const pastCount = trialBookings.filter(b => b.courseDateObj && b.courseDateObj < now).length;
    console.log(`   - Cours à venir: ${futureCount}`);
    console.log(`   - Cours passés: ${pastCount}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Parser les arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes('--all'),
  future: !args.includes('--past') && !args.includes('--all'),
  past: args.includes('--past'),
};

listTrialBookings(options)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
