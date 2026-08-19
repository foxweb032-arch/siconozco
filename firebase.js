import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBV4KZ_K4qsjFC-GMsdhJ0jpFbYZMMXlII",
  authDomain: "siconozco-ab496.firebaseapp.com",
  projectId: "siconozco-ab496",
  storageBucket: "siconozco-ab496.firebasestorage.app",
  messagingSenderId: "983709453039",
  appId: "1:983709453039:web:2b6d18c68b284bcdc7691a",
  measurementId: "G-0NREY720R5"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function cargarHorarios(proveedorId) {
  try {
    const docRef  = doc(db, 'horarios', proveedorId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.warn(`No se encontraron horarios para: ${proveedorId}`);
      return {};
    }
  } catch (error) {
    console.error('Error cargando horarios:', error);
    return {};
  }
}

export { db, cargarHorarios };
