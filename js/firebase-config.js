// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative o "Firestore Database" (modo produção)
// 3. Em "Configurações do projeto" > "Seus apps" > Web (</>),
//    copie o objeto firebaseConfig e cole abaixo.
// ============================================================

const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "SEU-PROJETO.firebaseapp.com",
  projectId: "SEU-PROJETO",
  storageBucket: "SEU-PROJETO.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
