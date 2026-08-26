import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// ── CARGAR HORARIOS ───────────────────
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

// ── CARGAR PROVEEDORES APROBADOS ──────
async function cargarProveedores() {
  try {
    const q        = query(collection(db, 'proveedores'), where('estado', '==', 'aprobado'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error cargando proveedores:', error);
    return [];
  }
}

export { db, cargarHorarios, cargarProveedores };

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
const storage = getStorage(app);
