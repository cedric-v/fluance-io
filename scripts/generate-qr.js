const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const url = 'https://fluance.io/?utm_campaign=flyer_2025&utm_term=fribourg';
const outputDir = path.join(__dirname, '../src/assets/img/qr-codes');
const outputFilePNG = path.join(outputDir, 'flyer-fribourg-2025.png');
const outputFileSVG = path.join(outputDir, 'flyer-fribourg-2025.svg');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const options = {
  errorCorrectionLevel: 'H',
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

// Générer le QR code en PNG
QRCode.toFile(outputFilePNG, url, {
  ...options,
  type: 'png',
  width: 512
}, function (err) {
  if (err) {
    console.error('Erreur lors de la génération du QR code PNG:', err);
    process.exit(1);
  }
  console.log('✅ QR code PNG généré avec succès !');
  console.log(`📁 Fichier: ${outputFilePNG}`);
});

// Générer le QR code en SVG (meilleure qualité pour l'impression)
QRCode.toString(url, {
  ...options,
  type: 'svg'
}, function (err, svg) {
  if (err) {
    console.error('Erreur lors de la génération du QR code SVG:', err);
    process.exit(1);
  }
  fs.writeFileSync(outputFileSVG, svg);
  console.log('✅ QR code SVG généré avec succès !');
  console.log(`📁 Fichier: ${outputFileSVG}`);
  console.log(`🔗 URL: ${url}`);
});

