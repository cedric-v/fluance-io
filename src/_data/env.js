require('dotenv').config();

module.exports = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    ELEVENTY_ENV: process.env.ELEVENTY_ENV || 'dev'
};
