import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// ── CARGAR RESEÑAS DE UN PROVEEDOR ────
async function cargarResenas(proveedorId) {
  try {
    const snapshot = await getDocs(collection(db, 'proveedores', proveedorId, 'resenas'));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } catch (error) {
    console.error('Error cargando reseñas:', error);
    return [];
  }
}

// ── ENVIAR NUEVA RESEÑA Y RECALCULAR PROMEDIO ──
async function enviarResena(proveedorId, calificacion, comentario, nombreCliente) {
  const proveedorRef = doc(db, 'proveedores', proveedorId);
  const resenaRef     = doc(collection(db, 'proveedores', proveedorId, 'resenas'));

  await runTransaction(db, async (transaction) => {
    const proveedorSnap = await transaction.get(proveedorRef);
    if (!proveedorSnap.exists()) throw new Error('Proveedor no encontrado');

    const data          = proveedorSnap.data();
    const ratingActual   = data.rating || 0;
    const totalActual    = data.totalResenas || 0;
    const nuevoTotal     = totalActual + 1;
    const nuevoRating    = ((ratingActual * totalActual) + calificacion) / nuevoTotal;

    transaction.set(resenaRef, {
      clienteNombre: nombreCliente || 'Cliente anónimo',
      calificacion,
      comentario,
      fecha: new Date().toISOString()
    });

    transaction.update(proveedorRef, {
      rating: nuevoRating,
      totalResenas: nuevoTotal
    });
  });
}

export { db, cargarHorarios, cargarProveedores, cargarResenas, enviarResena };

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
const storage = getStorage(app);
