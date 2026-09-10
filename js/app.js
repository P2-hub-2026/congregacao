// ============================================================
// APP.JS — lógica principal
// ============================================================

// BASE_LAT e BASE_LNG já são declarados em js/seed.js (carregado antes
// deste arquivo no index.html) — não redeclarar aqui, senão o navegador
// lança "Identifier already declared" e o app.js inteiro para de rodar.

const STATUS_LABEL = {
  disponivel: "Disponível",
  iniciado: "Iniciado",
  concluido: "Concluído"
};

const STATUS_COLOR = {
  disponivel: "#3f8f5f",
  iniciado: "#c47f17",
  concluido: "#2f6fb0"
};

let map;
let layerGroup;
let drawnEditLayer = null;
let drawControl = null;

let territorios = {};   // codigo -> dado
let poligonosLayer = {}; // codigo -> layer leaflet
let grupos = {};        // id -> dado

let filtro = { busca: "", grupoId: "", status: "" };
let selecionado = null; // codigo do território aberto no painel
let historicoUnsub = null;
let primeiroCarregamento = true;

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  ligarEventos();
  escutarGrupos();
  escutarTerritorios();
});

function initMap() {
  map = L.map("map").setView([BASE_LAT, BASE_LNG], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 20
  }).addTo(map);
  layerGroup = L.layerGroup().addTo(map);
}

// ---------- FIRESTORE LISTENERS ----------

function escutarGrupos() {
  db.collection("grupos").onSnapshot((snap) => {
    grupos = {};
    snap.forEach((doc) => (grupos[doc.id] = { id: doc.id, ...doc.data() }));
    popularSelectGrupos();
  });
}

function escutarTerritorios() {
  db.collection("territorios").onSnapshot((snap) => {
    territorios = {};
    snap.forEach((doc) => (territorios[doc.id] = { codigo: doc.id, ...doc.data() }));
    renderTudo();
  });
}

function escutarHistorico(codigo) {
  if (historicoUnsub) historicoUnsub();
  historicoUnsub = db
    .collection("territorios")
    .doc(codigo)
    .collection("historico")
    .orderBy("data", "desc")
    .onSnapshot((snap) => {
      const ul = document.getElementById("detailHistorico");
      ul.innerHTML = "";
      if (snap.empty) {
        ul.innerHTML = "<li>Sem eventos ainda.</li>";
        return;
      }
      snap.forEach((doc) => {
        const h = doc.data();
        const li = document.createElement("li");
        li.textContent = `${h.evento} — ${h.responsavel || "—"} (${h.data})`;
        ul.appendChild(li);
      });
    });
}

// ---------- RENDER ----------

function renderTudo() {
  renderStats();
  renderMapa();
  renderLista();
  if (selecionado) renderPainelDetalhe(selecionado);
}

function renderStats() {
  const vals = Object.values(territorios);
  document.getElementById("statTotal").textContent = vals.length;
  document.getElementById("statDisponivel").textContent = vals.filter((t) => t.status === "disponivel").length;
  document.getElementById("statIniciado").textContent = vals.filter((t) => t.status === "iniciado").length;
  document.getElementById("statConcluido").textContent = vals.filter((t) => t.status === "concluido").length;
}

function territoriosFiltrados() {
  return Object.values(territorios).filter((t) => {
    if (filtro.busca && !t.codigo.toLowerCase().includes(filtro.busca.toLowerCase())) return false;
    if (filtro.grupoId && t.grupoId !== filtro.grupoId) return false;
    if (filtro.status && t.status !== filtro.status) return false;
    return true;
  });
}

function renderMapa() {
  layerGroup.clearLayers();
  poligonosLayer = {};

  Object.values(territorios).forEach((t) => {
    if (!t.poligono || !t.poligono.length) return;
    const latlngs = t.poligono.map((p) => [p.lat, p.lng]);
    const emFiltro = territoriosFiltrados().some((f) => f.codigo === t.codigo);

    const poly = L.polygon(latlngs, {
      color: STATUS_COLOR[t.status] || "#999",
      weight: t.codigo === selecionado ? 3 : 1.5,
      fillOpacity: emFiltro ? 0.45 : 0.08,
      opacity: emFiltro ? 1 : 0.3
    }).addTo(layerGroup);

    poly.bindTooltip(t.codigo, { permanent: false, direction: "center" });
    poly.on("click", () => abrirDetalhe(t.codigo));
    poligonosLayer[t.codigo] = poly;
  });

  // Na primeira carga, ajusta o zoom/centro pra enquadrar todos os territórios reais
  if (primeiroCarregamento && Object.keys(poligonosLayer).length) {
    primeiroCarregamento = false;
    map.fitBounds(layerGroup.getBounds(), { padding: [30, 30] });
  }
}

function renderLista() {
  const ul = document.getElementById("territoryList");
  ul.innerHTML = "";
  const lista = territoriosFiltrados().sort((a, b) => a.codigo.localeCompare(b.codigo));

  lista.forEach((t) => {
    const li = document.createElement("li");
    li.className = t.codigo === selecionado ? "active" : "";
    const grupoNome = t.grupoId && grupos[t.grupoId] ? grupos[t.grupoId].nome : "sem grupo";
    li.innerHTML = `
      <span class="dot ${t.status}"></span>
      <span class="li-code">${t.codigo}</span>
      <span class="li-grupo">${grupoNome}</span>
    `;
    li.addEventListener("click", () => abrirDetalhe(t.codigo));
    ul.appendChild(li);
  });
}

function popularSelectGrupos() {
  const filterSel = document.getElementById("filterGrupo");
  const detailSel = document.getElementById("detailGrupoSelect");
  const valorAtualFiltro = filterSel.value;
  const valorAtualDetail = detailSel.value;

  filterSel.innerHTML = '<option value="">Todos os grupos</option>';
  detailSel.innerHTML = '<option value="">Sem grupo</option>';

  Object.values(grupos).forEach((g) => {
    filterSel.innerHTML += `<option value="${g.id}">${g.nome}</option>`;
    detailSel.innerHTML += `<option value="${g.id}">${g.nome}</option>`;
  });

  filterSel.value = valorAtualFiltro;
  detailSel.value = valorAtualDetail;
}

// ---------- PAINEL DE DETALHE ----------

function abrirDetalhe(codigo) {
  selecionado = codigo;
  document.getElementById("detailPanel").classList.remove("hidden");
  renderPainelDetalhe(codigo);
  renderMapa();
  escutarHistorico(codigo);

  const poly = poligonosLayer[codigo];
  if (poly) map.fitBounds(poly.getBounds(), { maxZoom: 18, padding: [40, 40] });
}

function renderPainelDetalhe(codigo) {
  const t = territorios[codigo];
  if (!t) return;

  document.getElementById("detailCode").textContent = t.codigo;

  const badge = document.getElementById("detailStatusBadge");
  badge.textContent = STATUS_LABEL[t.status];
  badge.className = "badge " + t.status;

  document.getElementById("detailGrupoSelect").value = t.grupoId || "";
  document.getElementById("inpObservacoes").value = t.observacoes || "";

  // mostra só a ação relevante pra fase atual
  document.getElementById("phaseIniciar").style.display = t.status === "disponivel" ? "block" : "none";
  document.getElementById("phaseConcluir").style.display = t.status === "iniciado" ? "block" : "none";
  document.getElementById("phaseLiberar").style.display = t.status === "concluido" ? "block" : "none";

  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById("inpDataIniciar").value = hoje;
  document.getElementById("inpDataConcluir").value = hoje;
}

function fecharDetalhe() {
  selecionado = null;
  document.getElementById("detailPanel").classList.add("hidden");
  if (historicoUnsub) historicoUnsub();
  renderMapa();
  sairModoEdicao();
}

// ---------- AÇÕES DE FASE ----------

async function registrarHistorico(codigo, evento, responsavel, data) {
  await db.collection("territorios").doc(codigo).collection("historico").add({
    evento,
    responsavel: responsavel || null,
    data: data || new Date().toISOString().slice(0, 10)
  });
}

async function marcarIniciado() {
  const resp = document.getElementById("inpRespIniciar").value.trim();
  const data = document.getElementById("inpDataIniciar").value;
  if (!resp) return alert("Informe o responsável.");

  await db.collection("territorios").doc(selecionado).update({
    status: "iniciado",
    responsavelInicio: resp,
    dataInicio: data,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Iniciado", resp, data);
}

async function marcarConcluido() {
  const resp = document.getElementById("inpRespConcluir").value.trim();
  const data = document.getElementById("inpDataConcluir").value;
  if (!resp) return alert("Informe o responsável.");

  await db.collection("territorios").doc(selecionado).update({
    status: "concluido",
    responsavelConclusao: resp,
    dataConclusao: data,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Concluído", resp, data);
}

async function liberarTerritorio() {
  const hoje = new Date().toISOString().slice(0, 10);
  await db.collection("territorios").doc(selecionado).update({
    status: "disponivel",
    responsavelInicio: null,
    dataInicio: null,
    responsavelConclusao: null,
    dataConclusao: null,
    dataLiberacao: hoje,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Liberado", null, hoje);
}

async function salvarGrupo() {
  const grupoId = document.getElementById("detailGrupoSelect").value || null;
  await db.collection("territorios").doc(selecionado).update({ grupoId });
}

async function salvarObservacoes() {
  const obs = document.getElementById("inpObservacoes").value;
  await db.collection("territorios").doc(selecionado).update({ observacoes: obs });
}

// ---------- ABRIR NO MAPS ----------

function centroide(poligono) {
  let latSum = 0, lngSum = 0;
  const pontos = poligono.slice(0, -1); // ignora ponto de fechamento repetido
  pontos.forEach((p) => { latSum += p.lat; lngSum += p.lng; });
  return [latSum / pontos.length, lngSum / pontos.length];
}

function abrirNoMaps() {
  const t = territorios[selecionado];
  if (!t || !t.poligono) return;
  const [lat, lng] = centroide(t.poligono);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank");
}

// ---------- EDITAR CONTORNO ----------

function entrarModoEdicao() {
  const poly = poligonosLayer[selecionado];
  if (!poly) return;

  if (!drawControl) {
    const editableItems = new L.FeatureGroup();
    map.addLayer(editableItems);
    drawnEditLayer = editableItems;
  }

  drawnEditLayer.clearLayers();
  const editable = L.polygon(poly.getLatLngs(), { color: "#e63946" }).addTo(drawnEditLayer);

  drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnEditLayer, remove: false },
    draw: false
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.EDITED, async () => {
    const latlngs = editable.getLatLngs()[0];
    const anel = latlngs.map((p) => ({ lat: p.lat, lng: p.lng }));
    anel.push(anel[0]); // fecha o anel
    await db.collection("territorios").doc(selecionado).update({ poligono: anel });
    sairModoEdicao();
  });

  alert("Modo de edição ativado: arraste os vértices e clique em salvar (ícone de check) na barra de ferramentas do mapa.");
}

function sairModoEdicao() {
  if (drawControl) {
    map.removeControl(drawControl);
    drawControl = null;
  }
  if (drawnEditLayer) drawnEditLayer.clearLayers();
}

// ---------- EVENTOS DE UI ----------

function ligarEventos() {
  document.getElementById("searchBox").addEventListener("input", (e) => {
    filtro.busca = e.target.value;
    renderTudo();
  });
  document.getElementById("filterGrupo").addEventListener("change", (e) => {
    filtro.grupoId = e.target.value;
    renderTudo();
  });
  document.getElementById("filterStatus").addEventListener("change", (e) => {
    filtro.status = e.target.value;
    renderTudo();
  });

  document.getElementById("closeDetail").addEventListener("click", fecharDetalhe);
  document.getElementById("detailGrupoSelect").addEventListener("change", salvarGrupo);
  document.getElementById("btnSalvarObs").addEventListener("click", salvarObservacoes);
  document.getElementById("btnOpenMaps").addEventListener("click", abrirNoMaps);
  document.getElementById("btnIniciar").addEventListener("click", marcarIniciado);
  document.getElementById("btnConcluir").addEventListener("click", marcarConcluido);
  document.getElementById("btnLiberar").addEventListener("click", liberarTerritorio);
  document.getElementById("btnEditarPoligono").addEventListener("click", entrarModoEdicao);
}
