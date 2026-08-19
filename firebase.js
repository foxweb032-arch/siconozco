<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBV4KZ_K4qsjFC-GMsdhJ0jpFbYZMMXlII",
    authDomain: "siconozco-ab496.firebaseapp.com",
    projectId: "siconozco-ab496",
    storageBucket: "siconozco-ab496.firebasestorage.app",
    messagingSenderId: "983709453039",
    appId: "1:983709453039:web:2b6d18c68b284bcdc7691a",
    measurementId: "G-0NREY720R5"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  
  // ── CARGAR HORARIOS DESDE FIRESTORE ───
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
</script>