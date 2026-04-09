import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function seed() {
  console.log("Authenticating...");
  await signInAnonymously(auth);
  console.log("Seeding database...");
  
  const padrinoId = 'user_padrino_1';
  const apadrinadoId = 'user_apadrinado_1';
  
  // Create Padrino
  await setDoc(doc(db, 'people_users', padrinoId), {
    uniqueCode: 'PADRINO123',
    name: 'Carlos Experto',
    role: 'padrino',
    area: 'Operaciones',
    createdAt: new Date().toISOString()
  });
  
  // Create Apadrinado
  await setDoc(doc(db, 'people_users', apadrinadoId), {
    uniqueCode: 'NUEVO123',
    name: 'Juan Novato',
    role: 'apadrinado',
    area: 'Operaciones',
    createdAt: new Date().toISOString()
  });
  
  // Create Plan
  const planRef = await addDoc(collection(db, 'mentorship_plans'), {
    padrinoId: padrinoId,
    apadrinadoId: apadrinadoId,
    startDate: '2026-04-01',
    endDate: '2026-05-01',
    status: 'Activo',
    progress: 0,
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  
  // Create Tasks
  await addDoc(collection(db, 'mentorship_tasks'), {
    planId: planRef.id,
    description: 'Completar inducción de seguridad',
    isCompleted: false,
    createdAt: new Date().toISOString()
  });
  
  await addDoc(collection(db, 'mentorship_tasks'), {
    planId: planRef.id,
    description: 'Revisión de manual operativo',
    isCompleted: false,
    createdAt: new Date().toISOString()
  });
  
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
