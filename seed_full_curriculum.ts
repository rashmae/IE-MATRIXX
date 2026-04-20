
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runSeeding() {
  console.log('Starting full subject seeding...');
  
  // Hand-curated list parsed from constants.ts view
  // I'll define a few to demonstrate and then I'll use a loop-friendly structure if possible.
  // Actually, since I have the full text, I can just include the whole array here.
  // I will use a simplified version because I don't want to hit string length limits in the tool call if I'm not careful,
  // but 71 subjects is manageable.

  const subjects = [
    { code: 'EMATH 111', name: 'Calculus 1', units: 5, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Differential calculus, limits, continuity, and derivatives.' },
    { code: 'ECHEM', name: 'Chemistry for Engineering (Lec)', units: 3, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Fundamental principles of chemistry for engineering students.' },
    { code: 'ECHEML', name: 'Chemistry for Engineering (Lab)', units: 1, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Laboratory experiments in chemistry.' },
    { code: 'BES-CFP', name: 'Computer Fundamentals and Programming', units: 2, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Introduction to computer systems and basic programming concepts.' },
    { code: 'IE-IPC 111', name: 'Introduction to Engineering', units: 2, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Overview of the engineering profession and IE field.' },
    { code: 'IE-AC 111', name: 'Principles of Economics', units: 3, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Basic economic theories and their applications.' },
    { code: 'IE-TECH 111', name: 'Pneumatics and Programmable Logic Controller', units: 3, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Control systems using pneumatics and PLCs.' },
    { code: 'PE 1', name: 'Physical Education 1', units: 2, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Physical fitness and self-testing activities.' },
    { code: 'NSTP 1', name: 'National Service Training Program', units: 3, yearLevel: '1st', semester: '1st', prerequisiteIds: [], description: 'Civic consciousness and defense preparedness.' },
    { code: 'EMATH 122', name: 'Calculus 2', units: 5, yearLevel: '1st', semester: '2nd', prerequisiteIds: ['EMATH 111'], description: 'Integral calculus and its applications.' },
    { code: 'EPHYS', name: 'Physics for Engineers (Lec)', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: ['EMATH 111'], description: 'Mechanics, heat, and sound for engineers.' },
    { code: 'EPHYSL', name: 'Physics for Engineers (Lab)', units: 1, yearLevel: '1st', semester: '2nd', prerequisiteIds: ['EMATH 111'], description: 'Laboratory experiments in physics.' },
    { code: 'BES-CAD', name: 'Computer-Aided Drafting', units: 1, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Technical drawing using CAD software.' },
    { code: 'IE - PC 121', name: 'Statistical Analysis for Industrial Engineering 1', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Probability and descriptive statistics.' },
    { code: 'IE - IAC 121', name: 'Basic Accounting', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Introduction to accounting principles.' },
    { code: 'GEC - PC', name: 'Purposive Communication', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Effective communication in various contexts.' },
    { code: 'GEC - US', name: 'Understanding the Self', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Psychological and philosophical perspectives of the self.' },
    { code: 'PE 2', name: 'Physical Education 2', units: 2, yearLevel: '1st', semester: '2nd', prerequisiteIds: [], description: 'Rhythmic activities and dance.' },
    { code: 'NSTP 2', name: 'National Service Training Program 2', units: 3, yearLevel: '1st', semester: '2nd', prerequisiteIds: ['NSTP 1'], description: 'Community immersion and service.' },
    { code: 'EMATH 213', name: 'Differential Equations', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['EMATH 122'], description: 'Solving first-order and higher-order differential equations.' },
    { code: 'BES-EMECH', name: 'Engineering Mechanics', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['EPHYS'], description: 'Statics and dynamics of rigid bodies.' },
    { code: 'IE - PC 212', name: 'Industrial Materials and Processes', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['ECHEM', 'EPHYS'], description: 'Study of materials used in industry and manufacturing processes.' },
    { code: 'IE - PC 212L', name: 'Industrial Materials and Processes (Lab)', units: 2, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['ECHEML', 'EPHYSL'], description: 'Hands-on experiments with industrial materials.' },
    { code: 'IE - PC 213', name: 'Statistical Analysis for Industrial Engineering 2', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['IE - PC 121'], description: 'Inferential statistics and hypothesis testing.' },
    { code: 'IE - PC 214', name: 'Industrial Organization and Management', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: [], description: 'Principles of management and organizational behavior.' },
    { code: 'IE - AC 212', name: 'Financial Accounting', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: ['IE - IAC 121'], description: 'Preparation and analysis of financial statements.' },
    { code: 'GEC-MMW', name: 'Mathematics in the Modern World', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: [], description: 'Applications of mathematics in contemporary life.' },
    { code: 'GEE - TEM', name: 'The Entrepreneurial Mind', units: 3, yearLevel: '2nd', semester: '1st', prerequisiteIds: [], description: 'Developing an entrepreneurial mindset and business basics.' },
    { code: 'PE 3', name: 'Physical Education 3', units: 2, yearLevel: '2nd', semester: '1st', prerequisiteIds: [], description: 'Individual and dual sports.' },
    { code: 'IE - PC 225', name: 'Advanced Mathematics for Industrial Engineering', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: ['EMATH 213'], description: 'Complex variables, Laplace transforms, and Fourier series.' },
    { code: 'IE - PC 226', name: 'Work Study and Measurement', units: 4, yearLevel: '2nd', semester: '2nd', prerequisiteIds: ['IE - PC 212', 'IE - PC 213', 'IE - PC 214'], description: 'Method study and work measurement techniques.' },
    { code: 'IE - PC 227', name: 'Information Systems', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: ['BES-CFP'], description: 'Design and management of industrial information systems.' },
    { code: 'IE - PC 228', name: 'System Dynamics', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Modeling complex systems and feedback loops.' },
    { code: 'IE - PE 221', name: 'Project Management', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Planning, scheduling, and controlling projects.' },
    { code: 'BES-EE', name: 'Engineering Economics', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Economic analysis of engineering projects.' },
    { code: 'GEC - TCW', name: 'The Contemporary World', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Globalization and its impact on the world.' },
    { code: 'GEC - LWR', name: 'Life and Works of Rizal', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Study of the life and writings of Jose Rizal.' },
    { code: 'GEE - LIE', name: 'Living in the IT Era', units: 3, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Impact of IT on society and daily life.' },
    { code: 'PE 4', name: 'Physical Education 4', units: 2, yearLevel: '2nd', semester: '2nd', prerequisiteIds: [], description: 'Team sports.' },
    { code: 'IE - PC 319', name: 'Operations Research 1', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['IE - PC 225'], description: 'Linear programming and optimization models.' },
    { code: 'IE - PC 3110', name: 'Quality Management Systems', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['IE - PC 213', 'IE - PC 226'], description: 'Principles of TQM and quality control.' },
    { code: 'IE - PC 3111', name: 'Ergonomics 1', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['IE - PC 226'], description: 'Human factors in engineering design.' },
    { code: 'IE - PC 3112', name: 'Operations Management 1', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['IE - PC 319', 'IE - PC 3110'], description: 'Production planning and inventory control.' },
    { code: 'IE - AC 313', name: 'Managerial Accounting', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['IE - AC 212'], description: 'Accounting for decision making and control.' },
    { code: 'IE - AC 314', name: 'Thermodynamics', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: ['EMATH 122'], description: 'Laws of thermodynamics and energy conversion.' },
    { code: 'BES - T', name: 'Technopreneurship 101', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: [], description: 'Entrepreneurship in the technology sector.' },
    { code: 'BES - OSH', name: 'Basic Occupational Safety and Health', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: [], description: 'Safety standards and health in the workplace.' },
    { code: 'IE - IPC 312', name: 'Methodology of Research', units: 3, yearLevel: '3rd', semester: '1st', prerequisiteIds: [], description: 'Research designs and data collection methods.' },
    { code: 'IE - PC 3213', name: 'Operations Research 2', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: ['IE - PC 319'], description: 'Stochastic models and advanced optimization.' },
    { code: 'IE - PC 3214', name: 'Operations Management 2', units: 4, yearLevel: '3rd', semester: '2nd', prerequisiteIds: ['IE - PC 3112'], description: 'Advanced production and service operations.' },
    { code: 'IE - PC 3215', name: 'Ergonomics 2', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: ['IE - PC 3111'], description: 'Advanced topics in human-machine systems.' },
    { code: 'IE - IPC 323', name: 'Research Writing', units: 2, yearLevel: '3rd', semester: '2nd', prerequisiteIds: ['IE - IPC 312'], description: 'Writing research proposals and reports.' },
    { code: 'IE - IPC 324/BA-M211', name: 'Marketing Management', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: [], description: 'Marketing strategies and consumer behavior.' },
    { code: 'IE - PE 322', name: 'Enterprise Resource Planning', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: ['IE - PC 227'], description: 'Integrated business management systems.' },
    { code: 'GEC - E', name: 'Ethics', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: [], description: 'Moral philosophy and ethical decision making.' },
    { code: 'GEE-ES', name: 'Environmental Science', units: 3, yearLevel: '3rd', semester: '2nd', prerequisiteIds: [], description: 'Environmental issues and sustainability.' },
    { code: 'IE-PC 400', name: 'IE Industry Immersion', units: 3, yearLevel: '4th', semester: 'Summer', prerequisiteIds: [], description: 'On-the-job training in an industrial setting.' },
    { code: 'IE - PC 4116', name: 'Project Feasibility', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: ['IE - AC 314', 'IE - PC 3214'], description: 'Preparation of project feasibility studies.' },
    { code: 'IE - PC 4117', name: 'Supply Chain Management', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: ['IE - PC 3214'], description: 'Logistics and supply chain optimization.' },
    { code: 'IE - PC 4118', name: 'Systems Engineering', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: [], description: 'Design and management of complex systems.' },
    { code: 'IE-PE-413', name: 'Packaging Technology', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: [], description: 'Principles and materials of packaging.' },
    { code: 'IE - AC 415', name: 'Elementary Electrical Engineering', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: ['EPHYS'], description: 'Basic electrical circuits and machines.' },
    { code: 'IE - AC 416', name: 'Environmental Engineering Sciences', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: ['GEE-ES'], description: 'Engineering solutions for environmental problems.' },
    { code: 'GEC-RPH', name: 'Readings in Philippine History', units: 3, yearLevel: '4th', semester: '1st', prerequisiteIds: [], description: 'Analysis of primary sources in Philippine history.' },
    { code: 'IE - PC 4219', name: 'IE Capstone Project', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Final design project for IE students.' },
    { code: 'IE - PC 4220', name: 'Engineering Values and Ethics', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Professional ethics for engineers.' },
    { code: 'IE - IPC 425', name: 'Human Resource Planning', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Management of human resources in industry.' },
    { code: 'IE - PE 424', name: 'Lean Six Sigma', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Methodologies for process improvement.' },
    { code: 'IE - PE 425', name: 'Intellectual Property Rights', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Laws and principles of intellectual property.' },
    { code: 'GEC - AA', name: 'Art Appreciation', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Understanding and appreciating various art forms.' },
    { code: 'GEC - STS', name: 'Science, Technology and Society', units: 3, yearLevel: '4th', semester: '2nd', prerequisiteIds: [], description: 'Interaction between science, technology, and society.' }
  ];

  let completed = 0;
  let added = 0;
  let updated = 0;
  let needPDF = 0;

  for (const s of subjects) {
    const q = query(collection(db, 'subjects'), where('code', '==', s.code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Create new
      const newId = s.code.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await setDoc(doc(db, 'subjects', newId), {
        ...s,
        id: newId,
        isAvailable: false,
        syllabusUrl: null,
        createdAt: serverTimestamp()
      });
      added++;
      needPDF++;
    } else {
      const existing = snapshot.docs[0].data();
      // Check if complete (has description and units)
      if (existing.description && existing.units && existing.syllabusUrl) {
        completed++;
      } else {
        // Update with missing details
        await updateDoc(doc(db, 'subjects', snapshot.docs[0].id), {
          ...s,
          updatedAt: serverTimestamp()
        });
        updated++;
      }
      if (!existing.syllabusUrl) needPDF++;
    }
  }

  console.log(`\n--- Seeding Summary ---`);
  console.log(`Total Subjects: ${subjects.length}`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Completed (with PDF): ${completed}`);
  console.log(`Need PDFs: ${needPDF}`);
}

runSeeding().catch(console.error);
