
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function updateSpecificSubject() {
  console.log('Updating subject IE-IPC 111...');
  
  const q = query(collection(db, 'subjects'), where('code', '==', 'IE-IPC 111'));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docId = snapshot.docs[0].id;
    await updateDoc(doc(db, 'subjects', docId), {
      averageRating: 4.5,
      ratingCount: 112,
      professor: 'Engr. John Doe',
      units: 2,
      syllabusUrl: 'https://example.com/syllabus/ie-ipc-111.pdf',
      isAvailable: true,
      topics: ['Engineering Profession', 'IE Basics', 'History of IE'],
      updatedAt: serverTimestamp()
    });
    console.log(`Successfully updated IE-IPC 111 (Doc ID: ${docId})`);
  } else {
    // If not found by query, try by ID directly
    const directId = 'ie-ipc-111';
    try {
      await updateDoc(doc(db, 'subjects', directId), {
        averageRating: 4.5,
        ratingCount: 112,
        professor: 'Engr. John Doe',
        units: 2,
        syllabusUrl: 'https://example.com/syllabus/ie-ipc-111.pdf',
        isAvailable: true,
        topics: ['Engineering Profession', 'IE Basics', 'History of IE'],
        updatedAt: serverTimestamp()
      });
      console.log(`Successfully updated IE-IPC 111 (Direct ID: ${directId})`);
    } catch (e) {
      console.error('Subject not found in Firestore.');
    }
  }
}

updateSpecificSubject().catch(console.error);
