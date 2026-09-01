import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBV4KZ_K4qsjFC-GMsdhJ0jpFbYZMMXlII",
  authDomain: "siconozco-ab496.firebaseapp.com",
  projectId: "siconozco-ab496",
  storageBucket: "siconozco-ab496.firebasestorage.app",
  messagingSenderId: "983709453039",
  appId: "1:983709453039:web:2b6d18c68b284bcdc7691a",
  measurementId: "G-0NREY720R5"
};

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);
const auth    = getAuth(app);

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

// ── AUTENTICACIÓN (ADMIN) ─────────────
async function loginAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
async function logoutAdmin() {
  return signOut(auth);
}
function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── CARGAR TODOS LOS PROVEEDORES (ADMIN) ──
// A diferencia de cargarProveedores(), esta trae TODOS los estados
async function cargarTodosLosProveedores() {
  try {
    const snapshot = await getDocs(collection(db, 'proveedores'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error cargando todos los proveedores:', error);
    return [];
  }
}

// ── ACTUALIZAR CAMPOS DE UN PROVEEDOR (ADMIN) ──
async function actualizarProveedor(proveedorId, datos) {
  const proveedorRef = doc(db, 'proveedores', proveedorId);
  await updateDoc(proveedorRef, datos);
}

// ── ELIMINAR PROVEEDOR (ADMIN) ────────
async function eliminarProveedor(proveedorId) {
  const proveedorRef = doc(db, 'proveedores', proveedorId);
  await deleteDoc(proveedorRef);
}

// ── SUBIR FOTO DESDE EL PANEL (ADMIN) ──
async function subirFotoAdmin(archivo) {
  const nombreUnico = `${Date.now()}-${archivo.name}`;
  const storageRef  = ref(storage, `proveedores/${nombreUnico}`);
  await uploadBytes(storageRef, archivo);
  return getDownloadURL(storageRef);
}

// ── ELIMINAR FOTO DE STORAGE (ADMIN) ──
async function eliminarFotoStorage(url) {
  try {
    const fotoRef = ref(storage, url);
    await deleteObject(fotoRef);
  } catch (error) {
    console.warn('No se pudo eliminar la foto de Storage (puede que ya no exista):', error);
  }
}

// ── RESERVACIONES ──────────────────────
async function guardarReservacion(datos) {
  await addDoc(collection(db, 'reservaciones'), {
    ...datos,
    fechaCreacion: new Date().toISOString(),
    estado: 'pendiente'
  });
}

async function cargarReservaciones() {
  try {
    const snapshot = await getDocs(collection(db, 'reservaciones'));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  } catch (error) {
    console.error('Error cargando reservaciones:', error);
    return [];
  }
}

async function marcarReservacion(reservacionId, estado) {
  await updateDoc(doc(db, 'reservaciones', reservacionId), { estado });
}

async function actualizarReservacion(reservacionId, datos) {
  await updateDoc(doc(db, 'reservaciones', reservacionId), datos);
}

// ── MENSAJES DE CONTACTO ───────────────
async function guardarMensaje(datos) {
  await addDoc(collection(db, 'mensajes'), {
    ...datos,
    fechaCreacion: new Date().toISOString(),
    respondido: false
  });
}

async function cargarMensajes() {
  try {
    const snapshot = await getDocs(collection(db, 'mensajes'));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  } catch (error) {
    console.error('Error cargando mensajes:', error);
    return [];
  }
}

async function marcarMensajeRespondido(mensajeId, respondido) {
  await updateDoc(doc(db, 'mensajes', mensajeId), { respondido });
}

export {
  db, auth,
  cargarHorarios, cargarProveedores, cargarResenas, enviarResena,
  loginAdmin, logoutAdmin, onAuthChange,
  cargarTodosLosProveedores, actualizarProveedor, eliminarProveedor,
  subirFotoAdmin, eliminarFotoStorage,
  guardarReservacion, cargarReservaciones, marcarReservacion, actualizarReservacion,
  guardarMensaje, cargarMensajes, marcarMensajeRespondido
};

