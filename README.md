# Territórios — Gestão de Mapas

App para gerenciar 200 territórios de pregação (jrdTer01…jrdTer200), inspirado no Hourglass.
Cada território é um polígono no mapa, pertence a um grupo, e passa pelas fases
**Disponível → Iniciado → Concluído → Liberado**.

> Este é um MVP (Produto Mínimo Viável) pronto para funcionar de ponta a ponta com dados
> **placeholder**. A ideia é você já rodar, testar o fluxo, e depois adaptar os polígonos
> reais e refinar os detalhes.

## Stack

- **Front-end**: HTML/CSS/JS puro (sem build step) + [Leaflet.js](https://leafletjs.com) para o mapa
- **Banco de dados**: Firebase Firestore (grátis até 1 GB / 50 mil leituras por dia)
- **Hospedagem**: GitHub Pages

## 1. Configurar o Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto novo.
2. No menu lateral, vá em **Build → Firestore Database → Criar banco de dados**. Escolha "modo produção" e a região mais próxima de você.
3. Em **Configurações do projeto (⚙️) → Geral**, role até "Seus apps", clique no ícone Web `</>` e registre um app (não precisa do Firebase Hosting).
4. Copie o objeto `firebaseConfig` que aparece e cole em `js/firebase-config.js`, substituindo os valores `"COLE_AQUI"`.
5. Em **Firestore Database → Regras**, cole o conteúdo de `firestore.rules` (já incluso no projeto) e publique.
   ⚠️ Essa regra libera leitura/escrita pra qualquer um com o link — ótima para testar, mas troque antes de usar com dados reais (veja a seção **Segurança** abaixo).

## 2. Rodar localmente

Não dá pra abrir `index.html` direto no navegador (módulos do Firebase bloqueiam `file://`). Use um servidor local simples:

```bash
cd territorios-app
python3 -m http.server 8000
# abra http://localhost:8000
```

## 3. Carregar os territórios

Você tem duas opções (pode usar as duas, em qualquer ordem):

**A) Importar territórios reais (recomendado, se você já tem o desenho deles)**

1. Coloque seu arquivo GeoJSON em `data/territorios-import.geojson` (o projeto já vem com 58 territórios reais que você enviou, `jrdTer01`…`jrdTer58`).
2. Abra o app e clique em **"Importar GeoJSON"** no topo.
3. Territórios que ainda não existem no banco são criados (status "disponível"); territórios que já existem têm só o **polígono** atualizado — status, grupo e histórico são preservados.
4. Se seu arquivo completo tiver mais territórios (até `jrdTer200`), é só substituir o conteúdo de `data/territorios-import.geojson` pelo GeoJSON completo e importar de novo.

**B) Gerar placeholders em grade (só se ainda não tiver nenhum desenho)**

1. Clique em **"Gerar placeholders"**.
2. Isso cria os territórios que faltarem (até completar 200) com um retângulo genérico no lugar do polígono real, pra você adaptar depois.
3. Os placeholders ficam centralizados nas coordenadas em `js/seed.js` (`BASE_LAT`/`BASE_LNG`).

## 4. Adaptar/ajustar um contorno

Para qualquer território (importado ou placeholder):

- Clique nele no mapa ou na lista lateral.
- Use **"✎ Editar contorno no mapa"** para arrastar os vértices e ajustar o formato.
- Atribua o **grupo** correto no painel de detalhe.

## 5. Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "App inicial de gestão de territórios"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/territorios-app.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: branch `main`, pasta `/root`** → salvar. O app fica disponível em `https://SEU-USUARIO.github.io/territorios-app/`.

## Estrutura de dados (Firestore)

```
territorios (coleção)
  jrdTer01 (documento)
    codigo: "jrdTer01"
    grupoId: "abc123" | null
    poligono: [[lng,lat], [lng,lat], ...]   // GeoJSON, anel fechado
    status: "disponivel" | "iniciado" | "concluido"
    responsavelInicio, dataInicio
    responsavelConclusao, dataConclusao
    dataLiberacao
    observacoes
    historico (subcoleção)
      { evento, responsavel, data }

grupos (coleção)
  { nome, cor }
```

## Segurança (fazer antes de usar com dados reais)

O arquivo `firestore.rules` inclui, comentado, um exemplo de regra que exige login
(`request.auth != null`). Para ativar autenticação:

1. No Firebase Console: **Build → Authentication → Sign-in method** → ative "E-mail/senha" (ou Google).
2. Adicione o SDK `firebase-auth-compat.js` no `index.html`.
3. Crie uma tela simples de login antes de mostrar o app.
4. Substitua as regras do Firestore pelo exemplo comentado em `firestore.rules`.

Isso garante que só publicadores autorizados da congregação vejam/editem os territórios.

## Itens do pedido original — cobertura

| Pedido | Status no MVP |
|---|---|
| 200 territórios jrdTer01…jrdTer200 | ✅ gerado pelo seed |
| Território = polígono | ✅ GeoJSON + Leaflet |
| Determinar grupo do território | ✅ seletor no painel de detalhe |
| Fase: Iniciar (resp. + data) | ✅ |
| Fase: Concluir (resp. + data) | ✅ |
| Fase: Liberar | ✅ |
| Abrir no Maps + traçar rota | ✅ link `google.com/maps/dir` a partir do centróide |
| Base de dados | ✅ Firebase Firestore, com justificativa no chat |

## Sugestões para as próximas iterações

- **Dashboard de progresso**: % de territórios trabalhados por grupo, territórios "atrasados" (sem trabalhar há X meses).
- **Autenticação e permissões por papel** (admin / dirigente de grupo / publicador).
- **Notificações/lembretes** automáticos para territórios parados há muito tempo.
- **Anexar fotos/notas** por endereço dentro do território.
- **Importar/exportar GeoJSON ou KML** para migrar territórios já mapeados em outra ferramenta.
- **Exportar relatório em PDF/Excel** para reuniões de território.
- **Modo offline (PWA completo com service worker)** para uso em campo sem internet.
- **Estado "Designado"** antes de "Iniciado", para reservar um território a alguém antes dele começar de fato.
