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

const firebaseIsConfigured = !Object.values(firebaseConfig).some((v) =>
  typeof v === "string" && (v.includes("COLE_AQUI") || v.includes("SEU-PROJETO"))
);

function createDemoSnapshot(items) {
  return {
    empty: items.length === 0,
    size: items.length,
    forEach: (callback) => items.forEach((item) => callback({ id: item.id, data: () => ({ ...item }) }))
  };
}

function createDemoDb() {
  const state = {
    congregacoes: [],
    grupos: [],
    publicadores: [],
    territorios: [],
    historico: {}
  };

  const BASE_LAT = -23.5505;
  const BASE_LNG = -46.6333;
  const TOTAL_TERRITORIOS = 200;
  const COLUNAS = 20;
  const CELL = 0.0035;
  const GAP = 0.0006;

  function gerarPoligonoGrade(index) {
    const col = index % COLUNAS;
    const row = Math.floor(index / COLUNAS);
    const lat0 = BASE_LAT + row * (CELL + GAP);
    const lng0 = BASE_LNG + col * (CELL + GAP);
    const lat1 = lat0 + CELL;
    const lng1 = lng0 + CELL;

    return [
      [lng0, lat0],
      [lng1, lat0],
      [lng1, lat1],
      [lng0, lat1],
      [lng0, lat0]
    ];
  }

  function codigoTerritorio(n) {
    const numStr = n < 100 ? String(n).padStart(2, "0") : String(n);
    return `jrdTer${numStr}`;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function ensureCollection(name) {
    if (!state[name]) state[name] = [];
    return state[name];
  }

  function getCollectionSnapshot(name) {
    return createDemoSnapshot(ensureCollection(name));
  }

  function makeDocumentRef(collectionName, docId) {
    const collection = ensureCollection(collectionName);
    let item = collection.find((entry) => entry.id === docId);
    if (!item) {
      item = { id: docId };
      collection.push(item);
    }

    return {
      set: async (payload) => {
        const index = collection.findIndex((entry) => entry.id === docId);
        const doc = { id: docId, ...payload };
        if (index >= 0) collection[index] = doc;
        else collection.push(doc);
        return { id: docId };
      },
      update: async (patch) => {
        const index = collection.findIndex((entry) => entry.id === docId);
        if (index >= 0) {
          collection[index] = { ...collection[index], ...patch };
        } else {
          collection.push({ id: docId, ...patch });
        }
        return { id: docId };
      },
      get: async () => {
        const doc = collection.find((entry) => entry.id === docId);
        return {
          exists: !!doc,
          data: () => (doc ? { ...doc } : null)
        };
      },
      collection: (subCollectionName) => {
        const subKey = `${collectionName}/${docId}/${subCollectionName}`;
        if (!state[subKey]) state[subKey] = [];

        return {
          add: async (payload) => {
            const id = makeId(subCollectionName);
            state[subKey].push({ id, ...payload });
            return { id };
          },
          orderBy: () => ({
            onSnapshot: (callback) => {
              const items = [...state[subKey]].sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
              callback(createDemoSnapshot(items));
              return () => {};
            }
          }),
          onSnapshot: (callback) => {
            callback(createDemoSnapshot(state[subKey]));
            return () => {};
          }
        };
      }
    };
  }

  function makeCollectionRef(collectionName) {
    const collection = ensureCollection(collectionName);

    return {
      onSnapshot: (callback) => {
        callback(getCollectionSnapshot(collectionName));
        return () => {};
      },
      add: async (payload) => {
        const id = makeId(collectionName);
        collection.push({ id, ...payload });
        return { id };
      },
      doc: (docId) => makeDocumentRef(collectionName, docId),
      limit: (count) => ({
        get: async () => createDemoSnapshot(collection.slice(0, count))
      }),
      orderBy: () => ({
        onSnapshot: (callback) => {
          callback(createDemoSnapshot([...collection]));
          return () => {};
        }
      })
    };
  }

  const demoGroups = [
    { id: "demo-group-1", nome: "Grupo 1", cor: "#3f8f5f" },
    { id: "demo-group-2", nome: "Grupo 2", cor: "#c47f17" },
    { id: "demo-group-3", nome: "Grupo 3", cor: "#2f6fb0" },
    { id: "demo-group-4", nome: "Grupo 4", cor: "#8955c4" }
  ];

  const demoPublicadores = [
    { id: "demo-pub-1", nome: "Publicador A" },
    { id: "demo-pub-2", nome: "Publicador B" },
    { id: "demo-pub-3", nome: "Publicador C" }
  ];

  state.congregacoes = [{ id: "demo-congregacao-1", nome: "Congregação principal" }];
  state.grupos = demoGroups;
  state.publicadores = demoPublicadores;

  state.territorios = Array.from({ length: TOTAL_TERRITORIOS }, (_, index) => {
    const codigo = codigoTerritorio(index + 1);
    return {
      id: codigo,
      codigo,
      congregacaoId: null,
      grupoId: null,
      publicadorId: null,
      poligono: gerarPoligonoGrade(index),
      pontoReferencia: null,
      status: "disponivel",
      responsavelInicio: null,
      dataInicio: null,
      responsavelConclusao: null,
      dataConclusao: null,
      dataLiberacao: null,
      observacoes: "",
      atualizadoEm: new Date().toISOString()
    };
  });

  return {
    collection: makeCollectionRef,
    batch: () => {
      const operations = [];
      return {
        set: (ref, payload) => operations.push({ type: "set", ref, payload }),
        update: (ref, payload) => operations.push({ type: "update", ref, payload }),
        commit: async () => {
          for (const operation of operations) {
            if (operation.type === "set") await operation.ref.set(operation.payload);
            if (operation.type === "update") await operation.ref.update(operation.payload);
          }
          operations.length = 0;
        }
      };
    }
  };
}

window.__FIREBASE_CONFIGURED__ = firebaseIsConfigured;

if (firebaseIsConfigured) {
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();
  window.db = db;
} else {
  var db = createDemoDb();
  window.db = db;
  console.warn("Firebase não configurado. O app está rodando em modo demonstração local.");
}
