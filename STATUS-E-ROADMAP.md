# SPEC — App de Gestão de Territórios (jrdTer)

> Documento de referência do estado atual do projeto. Pode ser usado como prompt
> para retomar o desenvolvimento com outra IA, outro dev, ou você mesmo no futuro.

---

## CONTEXTO

App web para gerenciar territórios de pregação, inspirado no Hourglass.
Stack: HTML/CSS/JS puro (sem build step) + Leaflet.js (mapa) + Firebase Firestore
(banco de dados) + hospedagem em GitHub Pages.

Repositório contém: `index.html`, `css/style.css`, `js/app.js`, `js/seed.js`,
`js/import-geojson.js`, `js/firebase-config.js`, `firestore.rules`,
`data/territorios-import.geojson`, `README.md`.

---

## FUNCIONALIDADES JÁ IMPLEMENTADAS

### 1. Territórios e polígonos
- [x] Cada território é um polígono real (GeoJSON), renderizado no mapa via Leaflet
- [x] Código único por território (`jrdTer01`...`jrdTer200`)
- [x] Importação de GeoJSON real (`js/import-geojson.js`) — cria territórios novos
      ou atualiza só o polígono dos que já existem, preservando status/grupo/histórico
- [x] Geração de territórios placeholder em grade (`js/seed.js`), para os que ainda
      não têm desenho real
- [x] Edição manual do contorno direto no mapa (arrastar vértices, via Leaflet.draw)
- [x] Mapa ajusta zoom/centro automaticamente à área real dos territórios carregados

### 2. Grupos e publicadores
- [x] Território pode ser associado a um grupo (seletor no painel de detalhe)
- [x] Território pode ser associado a um **publicador individual** — seletor no painel
      de detalhe, com cadastro rápido de nome novo (campo + Enter ou botão "+")
- [x] Filtro da lista/mapa por grupo e por publicador
- [x] **Seleção em lote**: marcar vários territórios (checkbox ou "selecionar todos os
      filtrados") e aplicar grupo ou publicador a todos de uma vez
- [x] 4 grupos de exemplo criados pelo seed (nome + cor)

### 3. Fases do território
- [x] Fluxo: **Disponível → Iniciado → Concluído → Liberado (volta a Disponível)**
- [x] "Iniciar": captura responsável + data
- [x] "Concluir": captura responsável + data
- [x] "Liberar": zera responsável/data e volta o status para disponível
- [x] Histórico de eventos por território (subcoleção `historico`, timestamp de cada
      mudança de fase, mostrado no painel de detalhe)
- [x] Cores no mapa e na lista por status (verde/laranja/azul)

### 4. Mapa e navegação
- [x] "Abrir no Maps": calcula o centróide do polígono e abre o Google Maps com rota
      até lá (`google.com/maps/dir/?destination=lat,lng`)
- [x] Lista lateral com busca por código, clique sincroniza com o mapa
- [x] Painel de detalhe: grupo, ações de fase, observações, histórico, edição de contorno

### 5. Dados
- [x] Firebase Firestore como banco (tempo real — mudanças refletem em todas as
      telas abertas automaticamente via `onSnapshot`)
- [x] Estrutura: coleção `territorios` (docs = jrdTer01...) + subcoleção `historico`;
      coleção `grupos`
- [x] Campo de observações livres por território
- [x] Regras de Firestore incluídas, com exemplo comentado de regra segura (auth)

### 6. Infraestrutura
- [x] Roda sem build step (abre com qualquer servidor estático)
- [x] README com passo a passo: Firebase, rodar local, importar dados, publicar
      no GitHub Pages
- [x] Manifest básico de PWA (`manifest.json`) — ainda sem service worker

---

## LIMITAÇÕES CONHECIDAS (estado atual)

- ⚠️ **Sem autenticação** — banco aberto (`allow read, write: if true`). Qualquer
  pessoa com o link do app lê e edita os dados. Regra segura já está pronta,
  comentada em `firestore.rules`, só falta ativar.
- ⚠️ **Sem controle de permissões** — não existe diferença entre admin, dirigente
  de grupo e publicador; qualquer usuário faz qualquer ação.
- ⚠️ Só 58 dos 200 territórios têm polígono real importado (`jrdTer01`–`jrdTer58`);
  o restante precisa ser importado ou desenhado.
- ⚠️ Sem funcionamento offline (PWA incompleto, sem service worker/cache).
- ⚠️ Sem exportação de relatórios (PDF/Excel) para reunião de território.
- ⚠️ Sem anexos (fotos/notas por endereço dentro do território).
- ⚠️ Sem alerta automático de território "parado há muito tempo".
- ⚠️ Não distingue "designado" (reservado, mas não iniciado) de "disponível".
- ⚠️ Sem suporte a importar/exportar KML diretamente (só GeoJSON).
- ⚠️ Sem tela de gestão de grupos (criar/editar/excluir grupo é manual no Firestore).

---

## PRÓXIMAS ETAPAS SUGERIDAS (por prioridade)

**Prioridade alta — segurança e dados**
1. Ativar autenticação (Firebase Auth) antes de qualquer uso com dados reais da congregação
2. Importar os territórios `jrdTer59`–`jrdTer200` restantes
3. Adicionar papéis de usuário (admin / dirigente de grupo / publicador)

**Prioridade média — usabilidade**
4. Tela de gestão de grupos (criar/editar/excluir pela interface, não só Firestore)
5. Estado "Designado" antes de "Iniciado" (reservar sem ainda começar)
6. Alertas de territórios parados há X meses (dashboard ou lista destacada)
7. Exportar relatório (PDF/Excel) para reunião de território

**Prioridade baixa — conforto extra**
8. Modo offline completo (service worker)
9. Anexar fotos/notas por endereço
10. Importar/exportar também em KML
11. Ícones/PWA completo para instalar como app no celular

---

## COMO USAR ESTE DOCUMENTO

Se for retomar o projeto (com outra IA ou outro desenvolvedor), cole este arquivo
inteiro como contexto inicial e diga qual item da lista de "Próximas etapas" você
quer atacar primeiro.
