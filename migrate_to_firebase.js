const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
    try {
        const localData = JSON.parse(fs.readFileSync('db.json', 'utf8'));
        await db.collection('data').doc('velki').set(localData);
        console.log('Migration successful!');
        process.exit(0);
    } catch(e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
