const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount), databaseURL: 'https://velki-info-default-rtdb.firebaseio.com' });

async function test() {
    const snapshot = await getDatabase().ref('/').once('value');
    const db = snapshot.val();
    
    let quickAgentsHtml = '';
    if (db.siteData && db.siteData.quickAgents) {
        db.siteData.quickAgents.forEach(qa => {
            const agent = (db.agents || []).find(a => a.id === qa.id);
            const agentNameDisplay = (agent && agent.name) ? \Name : \\ : \?????? ????: \\;
            const phone = (qa.whatsapp || '').replace(/\D/g, '');
            quickAgentsHtml += \<div class="quick-agent">QA</div>\;
        });
    }
    console.log('quickAgentsHtml:', quickAgentsHtml);
    process.exit(0);
}
test();
