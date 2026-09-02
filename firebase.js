import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, runTransaction, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

// ── COMPRIMIR IMAGEN ANTES DE SUBIR ───
// Redimensiona a un ancho máximo y reexporta como JPEG para reducir el tamaño del archivo.
function comprimirImagen(archivo, maxAncho = 1600, calidad = 0.8) {
  return new Promise((resolve) => {
    if (!archivo.type || !archivo.type.startsWith('image/')) {
      resolve(archivo);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxAncho) {
        height = Math.round(height * (maxAncho / width));
        width  = maxAncho;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(archivo); return; }
        const nombreJpg = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
        resolve(new File([blob], nombreJpg, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(archivo); };
    img.src = url;
  });
}

// ── REGISTRAR PROVEEDOR CON FOLIO SECUENCIAL ──
// Genera un folio corto (SC-0001, SC-0002...) usando un contador atómico,
// y crea el documento del proveedor con ese folio incluido.
async function registrarProveedor(datos) {
  const contadorRef       = doc(db, 'contadores', 'proveedores');
  const nuevoProveedorRef = doc(collection(db, 'proveedores'));

  const folio = await runTransaction(db, async (transaction) => {
    const contadorSnap = await transaction.get(contadorRef);
    const actual        = contadorSnap.exists() ? (contadorSnap.data().siguiente || 0) : 0;
    const siguiente      = actual + 1;
    const folioGenerado  = `SC-${String(siguiente).padStart(4, '0')}`;

    transaction.set(contadorRef, { siguiente });
    transaction.set(nuevoProveedorRef, {
      ...datos,
      folio: folioGenerado,
      estado: 'pendiente',
      fechaRegistro: new Date().toISOString()
    });

    return folioGenerado;
  });

  return { id: nuevoProveedorRef.id, folio };
}

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

// ── ELIMINAR RESEÑA Y RECALCULAR PROMEDIO (ADMIN) ──
async function eliminarResena(proveedorId, resenaId) {
  const proveedorRef = doc(db, 'proveedores', proveedorId);
  const resenaRef     = doc(db, 'proveedores', proveedorId, 'resenas', resenaId);

  await runTransaction(db, async (transaction) => {
    const resenaSnap = await transaction.get(resenaRef);
    if (!resenaSnap.exists()) throw new Error('Reseña no encontrada');
    const calificacion = resenaSnap.data().calificacion || 0;

    const proveedorSnap = await transaction.get(proveedorRef);
    if (!proveedorSnap.exists()) throw new Error('Proveedor no encontrado');

    const data        = proveedorSnap.data();
    const ratingActual = data.rating || 0;
    const totalActual  = data.totalResenas || 0;
    const nuevoTotal   = Math.max(totalActual - 1, 0);
    const nuevoRating  = nuevoTotal > 0
      ? ((ratingActual * totalActual) - calificacion) / nuevoTotal
      : 0;

    transaction.delete(resenaRef);
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
  const comprimido  = await comprimirImagen(archivo);
  const nombreUnico = `${Date.now()}-${comprimido.name}`;
  const storageRef  = ref(storage, `proveedores/${nombreUnico}`);
  await uploadBytes(storageRef, comprimido);
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

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

// ── ASEGURAR HORARIO VACÍO AL APROBAR (ADMIN) ──
// Crea el documento de horarios con el mismo ID del proveedor SOLO si no existe todavía,
// para no pisar horarios que el dueño ya haya cargado a mano.
async function asegurarHorarioProveedor(proveedorId) {
  const horarioRef = doc(db, 'horarios', proveedorId);
  const snap = await getDoc(horarioRef);
  if (snap.exists()) return;

  const vacio = {};
  DIAS_SEMANA.forEach(d => { vacio[d] = []; });
  await setDoc(horarioRef, vacio);
}

// ── ELIMINAR HORARIO AL ELIMINAR PROVEEDOR (ADMIN) ──
async function eliminarHorarioProveedor(proveedorId) {
  try {
    await deleteDoc(doc(db, 'horarios', proveedorId));
  } catch (error) {
    console.warn('No se pudo eliminar el horario (puede que no existiera):', error);
  }
}

// ── GUARDAR HORARIO DE UN PROVEEDOR (ADMIN) ──
async function guardarHorario(proveedorId, datosHorario) {
  const horarioRef = doc(db, 'horarios', proveedorId);
  await setDoc(horarioRef, datosHorario);
}

// ── ESCUCHAR CONTADORES EN TIEMPO REAL (ADMIN) ──
// Cada función devuelve un "unsubscribe" que hay que llamar al cerrar sesión.
function escucharPendientesProveedores(callback) {
  const q = query(collection(db, 'proveedores'), where('estado', '==', 'pendiente'));
  return onSnapshot(q,
    (snapshot) => callback(snapshot.size),
    (error) => console.error('Error escuchando proveedores pendientes:', error)
  );
}

function escucharPendientesReservaciones(callback) {
  const q = query(collection(db, 'reservaciones'), where('estado', '==', 'pendiente'));
  return onSnapshot(q,
    (snapshot) => callback(snapshot.size),
    (error) => console.error('Error escuchando reservaciones pendientes:', error)
  );
}

function escucharPendientesMensajes(callback) {
  const q = query(collection(db, 'mensajes'), where('respondido', '==', false));
  return onSnapshot(q,
    (snapshot) => callback(snapshot.size),
    (error) => console.error('Error escuchando mensajes pendientes:', error)
  );
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
  db, auth, storage,
  registrarProveedor,
  cargarHorarios, cargarProveedores, cargarResenas, enviarResena, eliminarResena,
  loginAdmin, logoutAdmin, onAuthChange,
  cargarTodosLosProveedores, actualizarProveedor, eliminarProveedor,
  subirFotoAdmin, eliminarFotoStorage, comprimirImagen,
  asegurarHorarioProveedor, eliminarHorarioProveedor, guardarHorario,
  guardarReservacion, cargarReservaciones, marcarReservacion, actualizarReservacion,
  guardarMensaje, cargarMensajes, marcarMensajeRespondido,
  escucharPendientesProveedores, escucharPendientesReservaciones, escucharPendientesMensajes
};

