const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://velki-info-default-rtdb.firebaseio.com'
});

const dbRef = getDatabase();

async function check() {
    const snap = await dbRef.ref('/').once('value');
    const dbData = snap.val() || { siteData: {}, agents: [], chat: [] };
    console.log('quickAgents type:', typeof dbData.siteData.quickAgents);
    console.log('quickAgents isArray:', Array.isArray(dbData.siteData.quickAgents));
    console.log('quickAgents length:', dbData.siteData.quickAgents ? dbData.siteData.quickAgents.length : 0);
    process.exit(0);
}
check();
