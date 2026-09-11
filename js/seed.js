// ============================================================
// SEED — gera dados iniciais no Firestore
// ============================================================
// Cria 200 territórios (jrdTer01..jrdTer200) com polígonos
// placeholder dispostos em grade, e 4 grupos de exemplo.
//
// Os polígonos são RETÂNGULOS GENÉRICOS — servem só para o app
// funcionar de ponta a ponta. Depois, use "✎ Editar contorno no
// mapa" em cada território para desenhar o formato real, ou
// importe um GeoJSON existente (ver README).
// ============================================================

const TOTAL_TERRITORIOS = 200;
const COLUNAS = 20;

// Ponto base — TROQUE pelas coordenadas do centro da sua cidade/congregação
const BASE_LAT = -23.5505;
const BASE_LNG = -46.6333;

const CELL = 0.0035;   // tamanho de cada território (graus)
const GAP  = 0.0006;   // espaço entre territórios

function gerarPoligonoGrade(index) {
  const col = index % COLUNAS;
  const row = Math.floor(index / COLUNAS);

  const lat0 = BASE_LAT + row * (CELL + GAP);
  const lng0 = BASE_LNG + col * (CELL + GAP);
  const lat1 = lat0 + CELL;
  const lng1 = lng0 + CELL;

  // GeoJSON: array de [lng, lat], anel fechado
  return [
    [lng0, lat0],
    [lng1, lat0],
    [lng1, lat1],
    [lng0, lat1],
    [lng0, lat0]
  ];
}

function codigoTerritorio(n) {
  // jrdTer01 ... jrdTer99, jrdTer100 ... jrdTer200
  const numStr = n < 100 ? String(n).padStart(2, "0") : String(n);
  return `jrdTer${numStr}`;
}

const GRUPOS_EXEMPLO = [
  { nome: "Grupo 1", cor: "#3f8f5f" },
  { nome: "Grupo 2", cor: "#c47f17" },
  { nome: "Grupo 3", cor: "#2f6fb0" },
  { nome: "Grupo 4", cor: "#8955c4" }
];

async function jaExisteDados() {
  const snap = await db.collection("territorios").limit(1).get();
  return !snap.empty;
}

async function rodarSeed() {
  if (await jaExisteDados()) {
    alert("Já existem territórios no banco. Nada foi alterado.");
    return;
  }

  // 1. Cria os grupos
  const grupoIds = [];
  for (const g of GRUPOS_EXEMPLO) {
    const ref = await db.collection("grupos").add(g);
    grupoIds.push(ref.id);
  }

  // 2. Cria os 200 territórios em lotes (limite do Firestore: 500/lote)
  let batch = db.batch();
  let count = 0;

  for (let i = 1; i <= TOTAL_TERRITORIOS; i++) {
    const codigo = codigoTerritorio(i);
    const ref = db.collection("territorios").doc(codigo);

    batch.set(ref, {
      codigo,
      congregacaoId: null,
      grupoId: null,
      publicadorId: null,
      poligono: gerarPoligonoGrade(i - 1),
      status: "disponivel",
      responsavelInicio: null,
      dataInicio: null,
      responsavelConclusao: null,
      dataConclusao: null,
      ultimaConclusao: null,
      dataLiberacao: null,
      observacoes: "",
      atualizadoEm: new Date().toISOString()
    });

    count++;
    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  alert(`${TOTAL_TERRITORIOS} territórios e ${GRUPOS_EXEMPLO.length} grupos criados com sucesso.`);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnSeed");
  btn.addEventListener("click", () => {
    if (confirm(`Gerar ${TOTAL_TERRITORIOS} territórios placeholder agora? Isso só deve ser feito uma vez.`)) {
      rodarSeed();
    }
  });
});
