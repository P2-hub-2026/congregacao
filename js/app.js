// ============================================================
// APP.JS — lógica principal
// ============================================================

const BASE_LAT = -23.5505;
const BASE_LNG = -46.6333;

const STATUS_LABEL = {
  disponivel: "Livre",
  designado: "Designado",
  iniciado: "Em Campo",
  concluido: "Concluído"
};

const STATUS_COLOR = {
  disponivel: "#3f8f5f",
  designado: "#e67e22",
  iniciado: "#e8b710",
  concluido: "#2f6fb0"
};

const DIAS_LIMITE_ATRASO = 90; // dias parado em "disponível" pra contar como atrasado

let map;
let layerGroup;
let drawnEditLayer = null;
let drawControl = null;
let modoMarcarPonto = false;

let territorios = {};   // codigo -> dado
let poligonosLayer = {}; // codigo -> layer leaflet
let grupos = {};        // id -> dado
let publicadores = {};  // id -> dado
let congregacoes = {};  // id -> dado

let filtro = { busca: "", grupoId: "", status: "", publicadorId: "", congregacaoId: "" };
let selecionado = null; // codigo do território aberto no painel
let historicoUnsub = null;
let primeiroCarregamento = true;
let selecionados = new Set(); // códigos marcados para ação em lote

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  ligarEventos();
  escutarCongregacoes();
  escutarGrupos();
  escutarPublicadores();
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

function escutarCongregacoes() {
  db.collection("congregacoes").onSnapshot((snap) => {
    congregacoes = {};
    snap.forEach((doc) => (congregacoes[doc.id] = { id: doc.id, ...doc.data() }));
    popularSelectCongregacoes();
  });
}

function escutarGrupos() {
  db.collection("grupos").onSnapshot((snap) => {
    grupos = {};
    snap.forEach((doc) => (grupos[doc.id] = { id: doc.id, ...doc.data() }));
    popularSelectGrupos();
  });
}

function escutarPublicadores() {
  db.collection("publicadores").onSnapshot((snap) => {
    publicadores = {};
    snap.forEach((doc) => (publicadores[doc.id] = { id: doc.id, ...doc.data() }));
    popularSelectPublicadores();
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

let pontosUnsub = null;
let pontosAtuais = []; // cache dos pontos do território aberto, pra "Rota até Território" usar o mais recente

function escutarPontos(codigo) {
  if (pontosUnsub) pontosUnsub();
  pontosUnsub = db
    .collection("territorios")
    .doc(codigo)
    .collection("pontos")
    .orderBy("criadoEm", "desc")
    .onSnapshot((snap) => {
      pontosAtuais = [];
      snap.forEach((doc) => pontosAtuais.push({ id: doc.id, ...doc.data() }));
      renderPontosList();
    });
}

function renderPontosList() {
  const ul = document.getElementById("detailPontosList");
  const countEl = document.getElementById("detailPontosCount");
  countEl.textContent = pontosAtuais.length;

  if (!pontosAtuais.length) {
    ul.innerHTML = '<li class="pontos-empty">Nenhum ponto registrado.</li>';
    atualizarMarcadoresPontos();
    return;
  }

  ul.innerHTML = "";
  pontosAtuais.forEach((p) => {
    const li = document.createElement("li");
    li.className = "ponto-item";
    li.innerHTML = `
      <span class="ponto-nota">${p.nota ? p.nota : "(sem nota)"}</span>
      <span class="ponto-acoes">
        <button class="ponto-rota" title="Traçar rota até este ponto" data-lat="${p.lat}" data-lng="${p.lng}">🧭</button>
        <button class="ponto-excluir" title="Excluir ponto" data-id="${p.id}">🗑</button>
      </span>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll(".ponto-rota").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${btn.dataset.lat},${btn.dataset.lng}`;
      window.open(url, "_blank");
    });
  });
  ul.querySelectorAll(".ponto-excluir").forEach((btn) => {
    btn.addEventListener("click", () => excluirPonto(btn.dataset.id));
  });

  atualizarMarcadoresPontos();
}

async function excluirPonto(pontoId) {
  if (!selecionado) return;
  if (!confirm("Excluir este ponto?")) return;
  await db.collection("territorios").doc(selecionado).collection("pontos").doc(pontoId).delete();
}

// ---------- RENDER ----------

function renderTudo() {
  renderStats();
  renderMapa();
  renderLista();
  if (selecionado) {
    renderPainelDetalhe(selecionado);
  }
}

function diasParado(t) {
  if (t.status !== "disponivel") return null;
  const base = t.dataLiberacao || (t.atualizadoEm ? t.atualizadoEm.slice(0, 10) : null);
  if (!base) return null;
  const ms = Date.now() - new Date(base + "T00:00:00").getTime();
  return Math.floor(ms / 86400000);
}

function renderStats() {
  const vals = Object.values(territorios);
  document.getElementById("statTotal").textContent = vals.length;
  document.getElementById("statDisponivel").textContent = vals.filter((t) => t.status === "disponivel").length;
  document.getElementById("statIniciado").textContent = vals.filter((t) => t.status === "iniciado").length;
  document.getElementById("statConcluido").textContent = vals.filter((t) => t.status === "concluido").length;

  const atrasados = vals.filter((t) => {
    const d = diasParado(t);
    return d !== null && d > DIAS_LIMITE_ATRASO;
  }).length;
  const elAtrasado = document.getElementById("statAtrasado");
  if (elAtrasado) elAtrasado.textContent = atrasados;
}

function territoriosFiltrados() {
  return Object.values(territorios).filter((t) => {
    if (filtro.busca && !t.codigo.toLowerCase().includes(filtro.busca.toLowerCase())) return false;
    if (filtro.grupoId && t.grupoId !== filtro.grupoId) return false;
    if (filtro.status && t.status !== filtro.status) return false;
    if (filtro.publicadorId && t.publicadorId !== filtro.publicadorId) return false;
    if (filtro.congregacaoId && t.congregacaoId !== filtro.congregacaoId) return false;
    return true;
  });
}

function renderMapa() {
  layerGroup.clearLayers();
  poligonosLayer = {};

  Object.values(territorios).forEach((t) => {
    if (!t.poligono || !t.poligono.length) return;
    const latlngs = t.poligono.map(([lng, lat]) => [lat, lng]);
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
    const atrasado = (diasParado(t) || 0) > DIAS_LIMITE_ATRASO;
    li.className = [t.codigo === selecionado ? "active" : "", atrasado ? "atrasado" : ""].join(" ").trim();
    const grupoNome = t.grupoId && grupos[t.grupoId] ? grupos[t.grupoId].nome : "sem grupo";
    const pubNome = t.publicadorId && publicadores[t.publicadorId] ? publicadores[t.publicadorId].nome : "";
    li.innerHTML = `
      <input type="checkbox" data-codigo="${t.codigo}" ${selecionados.has(t.codigo) ? "checked" : ""} />
      <span class="dot ${t.status}"></span>
      <span class="li-code">${t.codigo}</span>
      ${atrasado ? '<span class="li-warn" title="Parado há mais de ' + DIAS_LIMITE_ATRASO + ' dias">⚠️</span>' : ""}
      <span class="li-grupo">${pubNome ? pubNome : grupoNome}</span>
    `;
    li.querySelector("input").addEventListener("click", (e) => e.stopPropagation());
    li.querySelector("input").addEventListener("change", (e) => toggleSelecao(t.codigo, e.target.checked));
    li.addEventListener("click", () => abrirDetalhe(t.codigo));
    ul.appendChild(li);
  });

  renderBulkBar();
}

function toggleSelecao(codigo, marcado) {
  if (marcado) selecionados.add(codigo);
  else selecionados.delete(codigo);
  renderBulkBar();
}

function renderBulkBar() {
  const bar = document.getElementById("bulkBar");
  const count = selecionados.size;
  bar.classList.toggle("hidden", count === 0);
  document.getElementById("bulkCount").textContent = `${count} selecionado${count === 1 ? "" : "s"}`;
}

function selecionarTodosFiltrados() {
  territoriosFiltrados().forEach((t) => selecionados.add(t.codigo));
  renderLista();
}

function limparSelecao() {
  selecionados.clear();
  renderLista();
}

async function aplicarGrupoEmLote() {
  const grupoId = document.getElementById("bulkGrupoSelect").value || null;
  if (!selecionados.size) return;
  if (!confirm(`Aplicar este grupo a ${selecionados.size} território(s)?`)) return;

  let batch = db.batch();
  let ops = 0;
  for (const codigo of selecionados) {
    batch.update(db.collection("territorios").doc(codigo), { grupoId });
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  await batch.commit();
  limparSelecao();
}

function popularSelectGrupos() {
  const filterSel = document.getElementById("filterGrupo");
  const detailSel = document.getElementById("detailGrupoSelect");
  const bulkSel = document.getElementById("bulkGrupoSelect");
  const valorAtualFiltro = filterSel.value;
  const valorAtualDetail = detailSel.value;

  filterSel.innerHTML = '<option value="">Todos os grupos</option>';
  detailSel.innerHTML = '<option value="">Sem grupo</option>';
  bulkSel.innerHTML = '<option value="">Sem grupo</option>';

  // Se uma congregação está selecionada no filtro, só mostra os grupos dela
  const gruposVisiveis = Object.values(grupos).filter(
    (g) => !filtro.congregacaoId || g.congregacaoId === filtro.congregacaoId
  );

  gruposVisiveis.forEach((g) => (filterSel.innerHTML += `<option value="${g.id}">${g.nome}</option>`));
  Object.values(grupos).forEach((g) => {
    detailSel.innerHTML += `<option value="${g.id}">${g.nome}</option>`;
    bulkSel.innerHTML += `<option value="${g.id}">${g.nome}</option>`;
  });

  filterSel.value = valorAtualFiltro;
  detailSel.value = valorAtualDetail;
}

function popularSelectCongregacoes() {
  const filterSel = document.getElementById("filterCongregacao");
  const detailSel = document.getElementById("detailCongregacaoSelect");
  const valorAtualFiltro = filterSel.value;
  const valorAtualDetail = detailSel.value;

  filterSel.innerHTML = '<option value="">Todas as congregações</option>';
  detailSel.innerHTML = '<option value="">Sem congregação</option>';

  Object.values(congregacoes)
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach((c) => {
      filterSel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
      detailSel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });

  filterSel.value = valorAtualFiltro;
  detailSel.value = valorAtualDetail;
}

async function cadastrarCongregacao() {
  const nome = prompt("Nome da nova congregação:");
  if (!nome || !nome.trim()) return;
  await db.collection("congregacoes").add({ nome: nome.trim() });
}

async function salvarCongregacao() {
  const congregacaoId = document.getElementById("detailCongregacaoSelect").value || null;
  await db.collection("territorios").doc(selecionado).update({ congregacaoId });
}

function popularSelectPublicadores() {
  const filterSel = document.getElementById("filterPublicador");
  const detailSel = document.getElementById("detailPublicadorSelect");
  const bulkSel = document.getElementById("bulkPublicadorSelect");
  const valorAtualFiltro = filterSel.value;
  const valorAtualDetail = detailSel.value;

  filterSel.innerHTML = '<option value="">Todos os publicadores</option>';
  detailSel.innerHTML = '<option value="">Sem publicador</option>';
  bulkSel.innerHTML = '<option value="">Sem publicador</option>';

  Object.values(publicadores)
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach((p) => {
      filterSel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
      detailSel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
      bulkSel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
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
  escutarPontos(codigo);

  centralizarNoMapa(codigo);
}

function centralizarNoMapa(codigo) {
  const poly = poligonosLayer[codigo];
  if (poly) map.fitBounds(poly.getBounds(), { maxZoom: 18, padding: [40, 40] });
}

function formatarData(str) {
  if (!str) return "--/--/----";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function renderPainelDetalhe(codigo) {
  const t = territorios[codigo];
  if (!t) return;

  document.getElementById("detailCode").textContent = t.codigo;

  const badge = document.getElementById("detailStatusBadge");
  badge.textContent = STATUS_LABEL[t.status].toUpperCase();
  badge.className = "badge " + t.status;

  document.getElementById("detailCongregacaoSelect").value = t.congregacaoId || "";
  document.getElementById("detailGrupoSelect").value = t.grupoId || "";
  document.getElementById("detailPublicadorSelect").value = t.publicadorId || "";
  document.getElementById("inpObservacoes").value = t.observacoes || "";

  document.getElementById("detailDataSaida").textContent = formatarData(t.dataInicio);
  document.getElementById("detailUltimaConclusao").textContent = formatarData(t.ultimaConclusao);

  // habilita/realça só os botões de fase que fazem sentido no status atual
  const botoesFase = {
    disponivel: "btnDesignar",
    designado: "btnEmCampo",
    iniciado: "btnConcluir",
    concluido: "btnLiberar"
  };
  ["btnDesignar", "btnEmCampo", "btnConcluir", "btnLiberar"].forEach((id) => {
    document.getElementById(id).classList.toggle("btn-fase-ativo", id === botoesFase[t.status]);
  });
}

function fecharDetalhe() {
  selecionado = null;
  document.getElementById("detailPanel").classList.add("hidden");
  if (historicoUnsub) historicoUnsub();
  if (pontosUnsub) pontosUnsub();
  renderMapa();
  sairModoEdicao();
  modoMarcarPonto = false;
  limparMarcadoresPontos();
}

// ---------- AÇÕES DE FASE ----------

async function registrarHistorico(codigo, evento, responsavel, data) {
  await db.collection("territorios").doc(codigo).collection("historico").add({
    evento,
    responsavel: responsavel || null,
    data: data || new Date().toISOString().slice(0, 10)
  });
}

async function obterOuCriarPublicador(nome) {
  const existente = Object.values(publicadores).find(
    (p) => p.nome.toLowerCase() === nome.toLowerCase()
  );
  if (existente) return existente.id;
  const ref = await db.collection("publicadores").add({ nome });
  return ref.id;
}

async function marcarDesignado() {
  const t = territorios[selecionado];
  if (!t) return;

  let publicadorId = document.getElementById("detailPublicadorSelect").value;
  let nomePublicador;
  if (publicadorId && publicadores[publicadorId]) {
    nomePublicador = publicadores[publicadorId].nome;
  } else {
    const nome = prompt("Designar a quem? (nome do publicador/dupla)");
    if (!nome || !nome.trim()) return;
    nomePublicador = nome.trim();
    publicadorId = await obterOuCriarPublicador(nomePublicador);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  await db.collection("territorios").doc(selecionado).update({
    status: "designado",
    publicadorId,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Designado", nomePublicador, hoje);
}

async function marcarEmCampo() {
  const t = territorios[selecionado];
  if (!t) return;

  let respNome = t.publicadorId && publicadores[t.publicadorId] ? publicadores[t.publicadorId].nome : null;
  if (!respNome) {
    const nome = prompt("Quem está levando este território a campo? (responsável)");
    if (!nome || !nome.trim()) return;
    respNome = nome.trim();
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const dataStr = prompt("Data de saída (AAAA-MM-DD):", hoje);
  if (!dataStr) return;

  await db.collection("territorios").doc(selecionado).update({
    status: "iniciado",
    responsavelInicio: respNome,
    dataInicio: dataStr,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Em Campo", respNome, dataStr);
}

async function marcarConcluido() {
  const t = territorios[selecionado];
  if (!t) return;

  let respNome = t.responsavelInicio;
  if (!respNome) {
    const nome = prompt("Responsável pela conclusão:");
    if (!nome || !nome.trim()) return;
    respNome = nome.trim();
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const dataStr = prompt("Data de conclusão (AAAA-MM-DD):", hoje);
  if (!dataStr) return;

  await db.collection("territorios").doc(selecionado).update({
    status: "concluido",
    responsavelConclusao: respNome,
    dataConclusao: dataStr,
    ultimaConclusao: dataStr,
    atualizadoEm: new Date().toISOString()
  });
  await registrarHistorico(selecionado, "Concluído", respNome, dataStr);
}

async function liberarTerritorio() {
  const hoje = new Date().toISOString().slice(0, 10);
  await db.collection("territorios").doc(selecionado).update({
    status: "disponivel",
    publicadorId: null,
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

async function salvarPublicador() {
  const publicadorId = document.getElementById("detailPublicadorSelect").value || null;
  await db.collection("territorios").doc(selecionado).update({ publicadorId });
}

async function cadastrarPublicador() {
  const input = document.getElementById("inpNovoPublicador");
  const nome = input.value.trim();
  if (!nome) return;

  const publicadorId = await obterOuCriarPublicador(nome);

  input.value = "";
  if (selecionado) {
    document.getElementById("detailPublicadorSelect").value = publicadorId;
    await db.collection("territorios").doc(selecionado).update({ publicadorId });
  }
}

async function aplicarPublicadorEmLote() {
  const publicadorId = document.getElementById("bulkPublicadorSelect").value || null;
  if (!selecionados.size) return;
  if (!confirm(`Aplicar este publicador a ${selecionados.size} território(s)?`)) return;

  let batch = db.batch();
  let ops = 0;
  for (const codigo of selecionados) {
    batch.update(db.collection("territorios").doc(codigo), { publicadorId });
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  await batch.commit();
  limparSelecao();
}

async function salvarObservacoes() {
  const obs = document.getElementById("inpObservacoes").value;
  await db.collection("territorios").doc(selecionado).update({ observacoes: obs });
}

// ---------- ABRIR NO MAPS ----------

function centroide(poligono) {
  let latSum = 0, lngSum = 0;
  const pontos = poligono.slice(0, -1); // ignora ponto de fechamento repetido
  pontos.forEach(([lng, lat]) => { latSum += lat; lngSum += lng; });
  return [latSum / pontos.length, lngSum / pontos.length];
}

// "Rota até Território": usa o ponto marcado mais recente, senão o centro do polígono
function abrirNoMaps() {
  const t = territorios[selecionado];
  if (!t) return;

  let lat, lng;
  if (pontosAtuais.length) {
    lat = pontosAtuais[0].lat; // mais recente (orderBy criadoEm desc)
    lng = pontosAtuais[0].lng;
  } else if (t.poligono) {
    [lat, lng] = centroide(t.poligono);
  } else {
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank");
}

// "Ver no Maps": centraliza/realça o território dentro do nosso próprio mapa
function verNoMapaInterno() {
  if (!selecionado) return;
  centralizarNoMapa(selecionado);
}

let marcadoresPontosLayer = [];

function limparMarcadoresPontos() {
  marcadoresPontosLayer.forEach((m) => map.removeLayer(m));
  marcadoresPontosLayer = [];
}

function atualizarMarcadoresPontos() {
  limparMarcadoresPontos();
  pontosAtuais.forEach((p) => {
    const m = L.marker([p.lat, p.lng], { title: p.nota || "Ponto marcado" }).addTo(map);
    if (p.nota) m.bindTooltip(p.nota, { direction: "top" });
    marcadoresPontosLayer.push(m);
  });
}

function iniciarMarcacaoPonto() {
  if (!selecionado) return;
  modoMarcarPonto = true;
  alert("Modo de marcação ativado: clique em qualquer ponto do mapa (um endereço, uma referência) para registrar. Você poderá adicionar uma nota em seguida.");

  const handler = async (e) => {
    if (!modoMarcarPonto) return;
    modoMarcarPonto = false;

    const nota = prompt("Nota para este ponto (endereço, observação — pode deixar em branco):", "");
    if (nota === null) return; // usuário cancelou

    await db.collection("territorios").doc(selecionado).collection("pontos").add({
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      nota: nota.trim(),
      criadoEm: new Date().toISOString()
    });
  };
  map.once("click", handler);
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
    const anel = latlngs.map((p) => [p.lng, p.lat]);
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
  document.getElementById("filterPublicador").addEventListener("change", (e) => {
    filtro.publicadorId = e.target.value;
    renderTudo();
  });
  document.getElementById("filterCongregacao").addEventListener("change", (e) => {
    filtro.congregacaoId = e.target.value;
    popularSelectGrupos(); // reescopa os grupos visíveis pra congregação escolhida
    renderTudo();
  });
  document.getElementById("btnAddCongregacao").addEventListener("click", cadastrarCongregacao);

  document.getElementById("closeDetail").addEventListener("click", fecharDetalhe);
  document.getElementById("detailCongregacaoSelect").addEventListener("change", salvarCongregacao);
  document.getElementById("detailGrupoSelect").addEventListener("change", salvarGrupo);
  document.getElementById("detailPublicadorSelect").addEventListener("change", salvarPublicador);
  document.getElementById("btnAddPublicador").addEventListener("click", cadastrarPublicador);
  document.getElementById("inpNovoPublicador").addEventListener("keydown", (e) => {
    if (e.key === "Enter") cadastrarPublicador();
  });
  document.getElementById("btnSalvarObs").addEventListener("click", salvarObservacoes);
  document.getElementById("btnVerNoMaps").addEventListener("click", verNoMapaInterno);
  document.getElementById("btnOpenMaps").addEventListener("click", abrirNoMaps);
  document.getElementById("btnMarcarPonto").addEventListener("click", iniciarMarcacaoPonto);
  document.getElementById("btnDesignar").addEventListener("click", marcarDesignado);
  document.getElementById("btnEmCampo").addEventListener("click", marcarEmCampo);
  document.getElementById("btnConcluir").addEventListener("click", marcarConcluido);
  document.getElementById("btnLiberar").addEventListener("click", liberarTerritorio);
  document.getElementById("btnEditarPoligono").addEventListener("click", entrarModoEdicao);

  document.getElementById("btnSelecionarTodos").addEventListener("click", selecionarTodosFiltrados);
  document.getElementById("btnLimparSelecao").addEventListener("click", limparSelecao);
  document.getElementById("btnAplicarGrupoLote").addEventListener("click", aplicarGrupoEmLote);
  document.getElementById("btnAplicarPublicadorLote").addEventListener("click", aplicarPublicadorEmLote);
}
