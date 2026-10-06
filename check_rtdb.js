const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://velki-info-default-rtdb.firebaseio.com'
});

const dbRef = getDatabase();

async function check() {
    const snap = await dbRef.ref('siteData').once('value');
    console.log('siteData in DB:', Object.keys(snap.val() || {}));
    process.exit(0);
}
check();
