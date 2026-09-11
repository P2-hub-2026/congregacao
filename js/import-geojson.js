// ============================================================
// IMPORT-GEOJSON.JS
// ============================================================
// Lê data/territorios-import.geojson (exportado do Google My
// Maps / Earth) e cria/atualiza os territórios no Firestore
// com os polígonos REAIS, em vez dos placeholders em grade.
//
// Regra de importação:
// - Se o território (pelo "name", ex: jrdTer01) AINDA NÃO
//   existe no Firestore -> cria com status "disponivel".
// - Se já existe -> atualiza só o campo "poligono" (preserva
//   status, grupo, histórico, observações que já estavam lá).
// ============================================================

function limparAnel(coordenadas) {
  // O GeoJSON exportado traz [lng, lat, altitude] — o app só
  // usa [lng, lat], então descartamos o terceiro valor.
  return coordenadas.map(([lng, lat]) => [lng, lat]);
}

async function rodarImportGeoJSON() {
  let geo;
  try {
    const resp = await fetch("data/territorios-import.geojson");
    geo = await resp.json();
  } catch (e) {
    alert("Não consegui ler data/territorios-import.geojson. Confirme que o arquivo está na pasta /data.");
    console.error(e);
    return;
  }

  const features = geo.features || [];
  if (!features.length) {
    alert("O arquivo GeoJSON não tem territórios (features vazio).");
    return;
  }

  if (!confirm(`Importar ${features.length} territórios reais deste arquivo? Territórios já existentes terão só o polígono atualizado (status e grupo são preservados).`)) {
    return;
  }

  let criados = 0, atualizados = 0, ignorados = 0;
  let batch = db.batch();
  let opsNoLote = 0;

  for (const feature of features) {
    const codigo = feature.properties && feature.properties.name;
    const anel = feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0];

    if (!codigo || !anel) {
      ignorados++;
      continue;
    }

    const poligono = limparAnel(anel);
    const ref = db.collection("territorios").doc(codigo);
    const snap = await ref.get();

    if (snap.exists) {
      batch.update(ref, { poligono, atualizadoEm: new Date().toISOString() });
      atualizados++;
    } else {
      batch.set(ref, {
        codigo,
        congregacaoId: null,
        grupoId: null,
        publicadorId: null,
        poligono,
        pontoReferencia: null,
        status: "disponivel",
        responsavelInicio: null,
        dataInicio: null,
        responsavelConclusao: null,
        dataConclusao: null,
        dataLiberacao: null,
        observacoes: "",
        atualizadoEm: new Date().toISOString()
      });
      criados++;
    }

    opsNoLote++;
    if (opsNoLote >= 400) {
      await batch.commit();
      batch = db.batch();
      opsNoLote = 0;
    }
  }
  await batch.commit();

  alert(
    `Importação concluída.\n` +
    `Criados: ${criados}\n` +
    `Atualizados (polígono): ${atualizados}\n` +
    `Ignorados (sem nome/geometria): ${ignorados}`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnImportGeoJSON");
  if (btn) btn.addEventListener("click", rodarImportGeoJSON);
});
