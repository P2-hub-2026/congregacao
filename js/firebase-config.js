// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative o "Firestore Database" (modo produção)
// 3. Em "Configurações do projeto" > "Seus apps" > Web (</>),
//    copie o objeto firebaseConfig e cole abaixo.
// ============================================================

  const firebaseConfig = {
  apiKey: "AIzaSyCBzYBFy8BhmX4dIUUCCnVjuvMxdU1IMZE",
  authDomain: "mapas-jardins.firebaseapp.com",
  projectId: "mapas-jardins",
  storageBucket: "mapas-jardins.firebasestorage.app",
  messagingSenderId: "542540186243",
  appId: "1:542540186243:web:f5f7d2f80249012f4fd1b6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
