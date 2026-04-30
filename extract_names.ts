
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON not found in environment.");
  process.exit(1);
}

let serviceAccount: any;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  console.error("Value detected starts with:", serviceAccountJson.substring(0, 50));
  console.warn("If you are providing a service account email instead of the key JSON, please provide the full JSON from the Firebase console.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function extractNames() {
  console.log('Fetching names from Firestore (Admin)...');
  const snapshot = await db.collection('ratings').get();
  
  const names = new Set<string>();
  snapshot.forEach(doc => {
    const data = doc.data();
    // Exclude the placeholder Filipino names I added earlier if they were used in synthetic gen
    // Actually, I'll just get EVERYTHING and filter manually if I see familiar ones
    if (data.userName) {
      names.add(data.userName);
    }
  });

  const sortedNames = Array.from(names).sort();
  console.log('EXTRACTED_NAMES_START');
  console.log(JSON.stringify(sortedNames));
  console.log('EXTRACTED_NAMES_END');
  console.log(`Found ${sortedNames.length} unique names.`);
}

extractNames().catch(console.error);
