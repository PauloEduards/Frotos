# Projeto Frotos — Plano 3: Bloco 1 (motorista, busca de carros, visual)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motorista com cadastro por CPF, busca de carros por cidade, candidaturas, retirada e devolução guiadas com 5 fotos, fila offline e push. O dono ganha foto do carro, placa visual, visibilidade e anúncio do carro, e uma aba de pedidos de motoristas. No fim, a build de teste do Android.

**Architecture:**
- **Backend:** uma migração nova por task de backend, com pgTAP, seguindo os padrões do Plano 1:
  - RPCs `security definer` com `search_path = ''`;
  - erros via `public.erro(codigo, detalhe)`;
  - RLS e grants por coluna.
- **App:** segue os padrões do Plano 2:
  - rotas em `mobile/src/app/` e telas testadas em `mobile/src/__tests__/` com `renderComCliente`;
  - React Query, com `invalidarDadosDaFrota` depois de escritas e `useRefreshOnFocus` nas abas;
  - erros via `mensagemErro`.
- **Fotos:** passam por `src/lib/camera.ts` (só câmera, comprimidas) e são enviadas pela fila offline `src/fila/`.

**Tech Stack:**
- Supabase (Postgres, pgTAP, Storage)
- Expo SDK 57: `expo-image-picker` (`launchCameraAsync`), `expo-image-manipulator`, `expo-notifications`, `expo-dev-client`, EAS
- React Query 5
- Jest + RNTL 14

**Spec:** `docs/superpowers/specs/2026-10-07-bloco1-motorista-busca-design.md` (base: `docs/superpowers/specs/2026-10-06-frota-mvp-design.md`)

## Global Constraints

- **Placa na busca:** a placa **nunca** aparece na busca pública, nem na resposta da API (`buscar_carros` não retorna `placa`).
- **Fotos de retirada e devolução, em ordem:** `frente → traseira → lateral_esq → lateral_dir → painel`. São obrigatórias nos dois momentos, e o km vem depois da foto do painel.
- **Captura:** fotos de prova e do carro **só pela câmera** (`launchCameraAsync`). Compressão para o lado maior de 1600px, JPEG 0,7.
- **Antifraude:** uma foto de prova só é aceita se o objeto foi enviado por `auth.uid()` e o caminho ainda não foi usado.
- **CPF:** guardado só com dígitos, único, com dígitos verificadores válidos. Não tem foto de CNH. `tem_cnh` é uma declaração.
- **Sigilo:** `cpf` só é legível pelo próprio motorista e por donos com candidatura ou vínculo dele. `expo_push_token` nunca é legível.
- **Visibilidade:** `todos` (padrão), `alguns` ou `um`. Só o dono altera, e ela persiste depois da devolução.
- **Busca:** só mostra carros `anunciado AND ativo AND NOT em_uso AND visibilidade='todos'` da frota cuja cidade/UF casa (cidade normalizada: minúsculas, sem acento, sem espaços nas pontas).
- **Copy pt-BR exata da spec:**
  - "Nenhum carro disponível na sua região no momento."
  - "Você já se candidatou para este carro."
  - "Você já faz parte de uma frota."
  - "Você precisa ter CNH para se candidatar."
  - "CPF inválido."
  - "Este CPF já está cadastrado."
  - "Este carro não está disponível para você."
  - "Informe a cidade da frota em Configurações"
  - "Escolha um carro na aba Carros"
- **Verificação de cada task:**
  - backend: `npm run db:reset && npm run db:test` (raiz)
  - app: `cd mobile && npx tsc --noEmit && npx jest`, com saída limpa
- **Commits** terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Motorista perde a conexão no meio da retirada:** as fotos ficam na fila, a tela mostra "Enviando… N/5" e retoma quando a internet volta. Fechar e reabrir o app não perde a fila. Teste na Task 10.
2. **Dois candidatos aceitos ao mesmo carro ao mesmo tempo:** só um é aceito, e o outro fica recusado. Teste na Task 4.
3. **Carro reservado ("um") para quem foi removido:** volta a `todos` e o dono é avisado. Teste na Task 2.
4. **Motorista sem permissão de câmera:** a tela explica como liberar e não trava. Teste na Task 5.
5. **Erro de negócio na fila (ex.: `KM_MENOR`):** o item para, a mensagem aparece e o usuário pode corrigir o km ou descartar. A fila não fica tentando para sempre. Teste na Task 10.

---

## Backend

### Task 1: Perfil do motorista (CPF, CNH, cidade) e cidade da frota

**Files:** Create `supabase/migrations/20261008000100_perfil_motorista.sql`, `supabase/tests/database/130-perfil-motorista.test.sql`

**Interfaces:**
- **Produces (funções e colunas):**
  - `public.cpf_valido(p text) returns boolean` (imutável)
  - `public.normalizar_cidade(p text) returns text`, com `lower(unaccent(trim(p)))` (habilitar a extensão `unaccent`)
  - Colunas: `profiles.uf char(2)`, `profiles.cidade text`, `profiles.cpf text unique` (só dígitos), `profiles.tem_cnh boolean not null default false`, `fleets.uf char(2)`, `fleets.cidade text`
- **Produces (`criar_perfil`):** passa a ler `uf`, `cidade`, `cpf` e `tem_cnh` do metadata.
  - Motorista **exige** CPF válido; senão, `CPF_INVALIDO` "CPF inválido.".
  - CPF repetido: `CPF_DUPLICADO` "Este CPF já está cadastrado.".
  - Proprietário: CPF opcional.
- **Produces (grants e RLS):**
  - `profiles`: select ganha `uf, cidade, cpf, tem_cnh`; update próprio ganha `uf, cidade, tem_cnh`.
  - `fleets`: update do dono ganha `uf, cidade`.
  - A política de leitura de perfis por donos (`e_dono_do_motorista`) passa a valer também para candidatos (a tabela `candidaturas` nasce na Task 4; aqui criar a função `e_dono_do_motorista` em versão que a Task 4 substituirá).

- [ ] **Step 1: Escrever o teste**
  - `cpf_valido('52998224725')` é true; `'11111111111'` e `'52998224724'` são false.
  - Motorista sem CPF ou com CPF inválido → `CPF_INVALIDO`; CPF repetido → `CPF_DUPLICADO`.
  - Metadata `{cpf:'529.982.247-25'}` grava `'52998224725'`.
  - `normalizar_cidade(' São Paulo ')` = `'sao paulo'`.
  - Motorista A não lê `cpf` do motorista B.
  - O dono atualiza `fleets.uf/cidade`.
  - Motorista atualiza o próprio `tem_cnh`, mas não o `cpf` (42501).
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Implementar. Ajustar o seed (`supabase/seed.sql`):
  - CPFs válidos para ana, bruno e caio, com `tem_cnh=true`;
  - frota com `uf='SP'` e `cidade='São Paulo'`.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS. Rodar `npm run db:types` (atualiza `mobile/src/lib/database.types.ts`).
- [ ] **Step 5:** Commit `feat(db): perfil do motorista com CPF e CNH, cidade da frota`.

### Task 2: Visibilidade do carro

**Files:** Create `supabase/migrations/20261008000200_visibilidade.sql`, `supabase/tests/database/140-visibilidade.test.sql`

**Interfaces:**
- **Produces (estrutura):**
  - enum `visibilidade_carro ('todos','alguns','um')`
  - `vehicles.visibilidade visibilidade_carro not null default 'todos'`
  - tabela `vehicle_visibility(vehicle_id, driver_id, primary key(vehicle_id, driver_id))`, com select para o dono e o próprio motorista
- **Produces (funções):**
  - `public.pode_ver_carro(p_vehicle_id uuid, p_driver_id uuid) returns boolean`: `todos` é true para membro ativo; `alguns` e `um` exigem a linha em `vehicle_visibility`.
  - `public.definir_visibilidade(p_vehicle_id uuid, p_modo visibilidade_carro, p_motoristas uuid[]) returns void`, só para o dono.
    - `um` exige exatamente 1 motorista; senão, `VISIBILIDADE_INVALIDA` "Escolha um motorista.".
    - `alguns` exige ≥1.
    - Todos precisam ser membros ativos; senão, `VISIBILIDADE_INVALIDA` "Escolha motoristas da sua frota.".
    - `todos` limpa a lista.
  - `public.carros_para_mim() returns table(vehicle_id uuid, placa text, marca text, modelo text, ano_modelo int, cor text, foto_path text, em_uso boolean)`: os carros ativos da frota ativa do chamador com `pode_ver_carro`.
    - `foto_path` só é criado na Task 4: aqui, retornar `null::text` e a Task 4 substitui a função.
- **Altera `iniciar_retirada`** (versão final atual em `20261006001200_endurecimento.sql`): sem `pode_ver_carro` → `CARRO_INDISPONIVEL` "Este carro não está disponível para você.".
- **Altera `remover_motorista`:**
  - apaga as linhas do motorista em `vehicle_visibility`;
  - carro `um` desse motorista → `todos`, e o dono recebe a notificação `visibilidade_alterada` com "O carro {placa} voltou a ficar disponível para todos da frota.";
  - carro `alguns` que fica com a lista vazia → `todos`.

- [ ] **Step 1: Escrever o teste**
  - `pode_ver_carro` nos 3 modos.
  - `iniciar_retirada` de um não autorizado → `CARRO_INDISPONIVEL`.
  - A reserva persiste depois de `devolver_carro`.
  - `definir_visibilidade` com as validações e só para o dono.
  - `remover_motorista` reverte `um` → `todos` e notifica (Review Focus 3).
  - `carros_para_mim` filtra.
- [ ] **Step 2–4:** FAIL → implementar → PASS (+ `npm run db:types`).
- [ ] **Step 5:** Commit `feat(db): visibilidade do carro na frota`.

### Task 3: Retirada e devolução com 5 fotos e antifraude

**Files:** Create `supabase/migrations/20261008000300_fotos_retirada.sql`, `supabase/tests/database/150-fotos-retirada.test.sql`

**Interfaces:**
- **`posicao_foto`:** ganha `'painel'`.
- **`exigir_fotos_inspecao`:** passa a exigir `frente, traseira, lateral_esq, lateral_dir, painel`, com o rótulo "Painel" na lista do erro `FOTOS_FALTANDO`.
- **`concluir_retirada(p_assignment_id)` e `devolver_carro(...)`:** usam o `path` da foto `painel` do momento como `foto_painel_path` da leitura de km. Uma leitura com foto do painel não dá `FOTO_PAINEL_OBRIGATORIA`; o salto continua sendo marcado como `salto_suspeito` e notificado.
- **Fluxo da retirada:**
  - `iniciar_retirada(p_vehicle_id, p_km, …)` **não** grava mais a leitura.
  - A leitura de retirada é gravada em `concluir_retirada` com `km_inicio` e a foto do painel.
  - O km continua sendo validado (`KM_MENOR`) já no `iniciar_retirada`.
- **Nova RPC `registrar_fotos_inspecao(p_assignment_id uuid, p_momento momento_foto, p_fotos jsonb) returns int`:**
  - `p_fotos` é `[{posicao, path, capturado_em}]`;
  - insere em `inspection_photos`, passando pela validação do trigger;
  - **idempotente:** uma foto já registrada com o mesmo `path` no mesmo vínculo é ignorada. Isso deixa a nova tentativa da fila segura;
  - só o motorista do vínculo não encerrado pode chamar;
  - retorna quantas fotos o vínculo tem naquele momento.
- **`foto_valida(p_path, p_fleet_id, p_vehicle_id)`:** além do prefixo e da existência, exige `storage.objects.owner_id = auth.uid()::text` (ou `owner = auth.uid()`, conforme a coluna existente) e que o `path` não exista em `inspection_photos.path`, `incident_photos.path`, `odometer_readings.foto_painel_path` nem `maintenance_records.nota_foto_path`. Fora disso: `FOTO_INVALIDA`.
  - O path da própria foto do painel usada por `concluir_retirada` e `devolver_carro` é reaproveitado **intencionalmente** na leitura. Isso é permitido porque a leitura é gravada pela própria função, e a checagem de reuso acontece na inserção da foto.

- [ ] **Step 1: Escrever o teste**
  - Retirada sem o painel → `FOTOS_FALTANDO` "Faltam fotos: Painel.".
  - Retirada com as 5 fotos → leitura `retirada` com o `foto_painel_path` do painel.
  - Salto grande com o painel → aceito e `salto_suspeito`.
  - Devolução idem.
  - Foto enviada por outro usuário → `FOTO_INVALIDA`.
  - Path já usado em outra inspeção → `FOTO_INVALIDA`.
  - `registrar_fotos_inspecao` chamado duas vezes com as mesmas fotos → sem erro e sem duplicar (retorna 5).
- [ ] **Step 2–4:** FAIL → implementar (atualizar os testes 040/050/120 e o seed para incluir a foto `painel` e o `owner_id` correto nos `storage.objects`) → PASS.
- [ ] **Step 5:** Commit `feat(db): retirada e devolução com 5 fotos e foto antifraude`.

### Task 4: Foto do carro, anúncio, busca e candidaturas

**Files:** Create `supabase/migrations/20261008000400_vitrine.sql`, `supabase/tests/database/160-vitrine.test.sql`

**Interfaces:**
- **Colunas e bucket:**
  - `vehicles.foto_path text`, `vehicles.anunciado boolean not null default false`, com update do dono nos dois.
  - Bucket `carros`, caminho `{fleet_id}/{vehicle_id}/{uuid}.jpg`: select para qualquer `authenticated`; insert só para `e_dono_frota(seg1)`.
- **Tabela `candidaturas`:**
  - colunas: `id uuid pk, vehicle_id, fleet_id, driver_id, mensagem text check (char_length <= 300), status ('pendente','aceita','recusada','cancelada') default 'pendente', criada_em, respondida_em`;
  - índice único parcial `(driver_id, vehicle_id) where status='pendente'`;
  - select para o motorista dono da candidatura e o dono da frota.
- **`buscar_carros(p_uf text, p_cidade text)`** retorna `table(vehicle_id uuid, marca text, modelo text, ano_modelo int, cor text, foto_path text, frota_nome text, cidade text, uf text)`.
  - **Sem placa.**
  - Filtro: `anunciado AND ativo AND NOT em_uso AND visibilidade='todos'` e `uf = upper(p_uf) AND normalizar_cidade(fleets.cidade) = normalizar_cidade(p_cidade)`.
  - Ordem: `criado_em desc`.
- **`candidatar(p_vehicle_id uuid, p_mensagem text default null) returns candidaturas`.** Erros, nesta ordem:
  - não motorista → `APENAS_MOTORISTA`;
  - `tem_cnh=false` → `SEM_CNH` "Você precisa ter CNH para se candidatar.";
  - membro ativo de alguma frota → `JA_EM_FROTA` "Você já faz parte de uma frota.";
  - carro fora da busca → `CARRO_INDISPONIVEL` "Este carro não está disponível para você.";
  - pendente repetida → `JA_CANDIDATO` "Você já se candidatou para este carro.".
  - Notifica o dono com `candidatura_nova`: "Novo candidato para o carro {marca} {modelo}".
- **`cancelar_candidatura(p_id uuid)`:** só o motorista, e só quando está pendente.
- **`responder_candidatura(p_id uuid, p_aceitar boolean)`:** só o dono, atômico, com `for update` na candidatura e no carro.
  - **Aceitar:**
    - membro `ativo` (`com_aprovacao`): insere ou reativa;
    - `visibilidade='um'` com esse motorista;
    - `anunciado=false`;
    - as outras pendentes do mesmo carro passam a `recusada`, com `candidatura_recusada`;
    - o aceito recebe `candidatura_aceita` "Sua candidatura foi aceita".
  - **Recusar:** `recusada` + `candidatura_recusada` "Sua candidatura foi recusada".
  - Candidatura que não está pendente → `TRANSICAO_INVALIDA`.
- **`e_dono_do_motorista`:** substituída para incluir candidatos da frota.
- **`carros_para_mim`:** substituída para retornar `foto_path`.
- **Seed:** 2 carros anunciados e livres (Argo, Kwid), cada um com `foto_path` e o objeto correspondente no bucket `carros`.

- [ ] **Step 1: Escrever o teste**
  - A busca retorna os anunciados da cidade (com acento ou maiúsculas) e **não tem coluna placa** (`has_column`/`results_eq` sobre as colunas retornadas).
  - Carro reservado não aparece.
  - Cada erro de `candidatar`.
  - Aceite atômico com todos os efeitos.
  - Duas candidaturas ao mesmo carro: aceitar a 1ª recusa a 2ª, e aceitar a 2ª depois dá `TRANSICAO_INVALIDA` (Review Focus 2).
  - O dono lê o CPF do candidato.
  - Outro motorista não lê o CPF.
- [ ] **Step 2–4:** FAIL → implementar → PASS (+ `npm run db:types`).
- [ ] **Step 5:** Commit `feat(db): foto do carro, busca de carros e candidaturas`.

## App

### Task 5: Câmera, upload, Placa e CardCarro

**Files:**
- Create: `mobile/src/lib/camera.ts`, `mobile/src/lib/upload.ts`, `mobile/src/componentes/Placa.tsx`, `mobile/src/componentes/CardCarro.tsx`
- Test: tests em `mobile/src/__tests__/` e `mobile/src/lib/*.test.ts`

**Interfaces:**
- **`camera.ts`:** `capturarFoto(): Promise<{ uri: string; capturadoEm: string } | null>`
  - pede permissão (`ImagePicker.requestCameraPermissionsAsync`);
  - negada → lança `ErroApp` "Libere o acesso à câmera nas configurações do celular para continuar.";
  - usa `launchCameraAsync({ quality: 1 })` e, depois, `manipulateAsync` com `resize { width|height: 1600 }` no lado maior e `compress: 0.7, format: JPEG`;
  - cancelado → `null`.
- **`upload.ts`:** `enviarFoto(bucket: 'fotos' | 'carros', path: string, uri: string): Promise<void>`, via `fetch(uri)` → `arrayBuffer` → `storage.upload(path, buffer, { contentType: 'image/jpeg', upsert: false })`.
  - Também exporta `novoCaminho(fleetId, vehicleId, categoria?: 'inspecao'|'painel'|'nota'|'ocorrencia'): string`, que gera `uuid` (`expo-crypto` `randomUUID`).
- **`<Placa texto tamanho?: 'pequena'|'grande' />`:**
  - fundo `#FFFFFF`, borda `#212121` com raio 6, faixa superior `#1565C0` com "BRASIL" branco;
  - fonte monoespaçada;
  - formata `ABC1D23` como `ABC1D23` (sem hífen, espaçamento por `letterSpacing`).
- **`<CardCarro carro={{ placa?: string; marca; modelo; ano_modelo?; cor?; fotoUrl?: string | null }} selo?: ReactNode rodape?: ReactNode onPress? />`:**
  - `Placa` no topo, só se houver `placa`;
  - modelo/ano/cor no meio, e o `selo`;
  - **foto 96×72 no canto inferior direito**, com o ícone `car` (Ionicons) quando `fotoUrl` for null.

- [ ] **Step 1: Testes**
  - `capturarFoto`: permissão negada lança a mensagem (Review Focus 4), cancelado → null, ok → URI do manipulador (com mocks).
  - `Placa` renderiza o texto e "BRASIL".
  - `CardCarro` sem placa não renderiza `Placa`, e sem foto mostra o ícone (`testID="sem-foto"`).
- [ ] **Step 2–4:** FAIL → instalar com `npx expo install expo-image-picker expo-image-manipulator expo-crypto` e implementar → PASS. Em `app.json`, adicionar o plugin `expo-image-picker` com `cameraPermission` "O Frotos usa a câmera para registrar fotos do carro e do painel.".
- [ ] **Step 5:** Commit `feat(app): câmera, upload, Placa e CardCarro`.

### Task 6: Dono — foto do carro, visibilidade, anúncio, cidade da frota, visual

**Files:** Modify:
- `mobile/src/app/(dono)/carros/novo.tsx`
- `mobile/src/app/(dono)/carros/[id]/index.tsx`
- `mobile/src/app/(dono)/configuracoes.tsx`
- `mobile/src/app/(dono)/(abas)/index.tsx`
- `mobile/src/app/(dono)/(abas)/pendencias.tsx`
- `mobile/src/api/veiculos.ts`, `mobile/src/api/frota.ts`

**Interfaces:**
- **`api/veiculos.ts`:**
  - `definirFotoCarro(fleetId, vehicleId, uri): Promise<void>`: upload no bucket `carros` + `update vehicles.foto_path`;
  - **URLs da foto do carro:** o bucket `carros` não é público (só usuários logados leem). Por isso as URLs vêm de `createSignedUrls` em lote, pelo hook existente `useUrlsAssinadas`, que ganha o parâmetro `bucket: 'fotos' | 'carros'` (padrão `'fotos'`).
  - `definirVisibilidade(vehicleId, modo, motoristas: string[])`;
  - `definirAnuncio(vehicleId, anunciado: boolean)`.
- **`Frota`:** ganha `uf`, `cidade`; `atualizarFrota` aceita esses campos.

- [ ] **Step 1: Testes**
  - **Cadastro do carro:** sem foto, "Cadastrar carro" mostra "Tire uma foto do carro."; com foto (mock de `capturarFoto`), chama `cadastrarVeiculo` e depois `definirFotoCarro`.
  - **Detalhe:**
    - seção "Quem pode pegar este carro" com o Seletor `Todos da frota` / `Só alguns` / `Só um motorista`;
    - "Só alguns" e "Só um" listam os membros ativos com marcação → `definirVisibilidade`;
    - o interruptor "Anunciar na busca de motoristas" chama `definirAnuncio`, e fica desabilitado com "Informe a cidade da frota em Configurações" quando a frota não tem cidade;
    - aviso "O anúncio só vale quando o carro estiver disponível para todos da frota." quando a visibilidade ≠ todos;
    - "Trocar foto do carro".
  - **Configurações:** Seletor de UF (27 siglas) e campo Cidade → `atualizarFrota`.
  - **Painel e Pendências:** os cards usam `CardCarro` com placa e foto.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): foto do carro, visibilidade, anúncio e cards com placa`.

### Task 7: Dono — Pedidos de motoristas

**Files:** Create `mobile/src/api/candidaturas.ts`. Modify `mobile/src/app/(dono)/(abas)/motoristas.tsx`, `mobile/src/app/(dono)/(abas)/_layout.tsx`.

**Interfaces:**
- `export type CandidaturaDono = { id; driver_id; nome; telefone; cidade; uf; cpf; tem_cnh; mensagem: string | null; criada_em; carro: { vehicle_id; placa; marca; modelo; foto_path } }`
- `candidaturasPendentes(fleetId): Promise<CandidaturaDono[]>`
- `responderCandidatura(id, aceitar: boolean)`
- `contarCandidaturas(fleetId): Promise<number>`

- [ ] **Step 1: Testes**
  - A seção "Pedidos de motoristas" aparece **no topo**, com nome, telefone, "São Paulo/SP", CPF formatado `529.982.247-25`, "Tem CNH: sim", a mensagem e o `CardCarro` do carro desejado.
  - "Aceitar" → `responderCandidatura(id,true)` e invalida.
  - "Recusar" pede confirmação.
  - O badge da aba Motoristas é igual a candidaturas pendentes + pedidos de entrada pendentes, e some quando é 0.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Adicionar `formatarCpf` em `formatos.ts`, com teste.
- [ ] **Step 5:** Commit `feat(app): pedidos de motoristas para o dono`.

### Task 8: Cadastro do motorista e "Meu perfil"

**Files:** Modify `mobile/src/app/(auth)/cadastro.tsx`, `mobile/src/api/auth.ts`, `mobile/src/lib/formatos.ts`. Create `mobile/src/app/(motorista)/perfil.tsx`.

**Interfaces:**
- `cadastrar(...)` ganha `{ uf, cidade, cpf, tem_cnh }` para motorista (vão no metadata).
- `cpfValido(cpf: string): boolean` e `mascararCpf(digitado: string): string` em `formatos.ts`.
- `Perfil` ganha `uf, cidade, cpf, tem_cnh`, e `buscarPerfil` passa a selecionar essas colunas.
- `atualizarPerfil({ uf?, cidade?, tem_cnh? })`.
- `UFS: readonly string[]` (as 27 siglas) em `formatos.ts`.

- [ ] **Step 1: Testes**
  - Escolhendo "Sou motorista", aparecem UF (Seletor ou lista), Cidade, CPF (máscara durante a digitação) e o interruptor "Tenho CNH".
  - CPF inválido → "CPF inválido." e não chama `cadastrar`.
  - Erro `CPF_DUPLICADO` do backend → "Este CPF já está cadastrado." (DETAIL), com o formulário mantido.
  - Proprietário não vê os campos de CPF/CNH.
  - `cpfValido` e `mascararCpf` têm testes unitários.
  - **Meu perfil:** edita UF, cidade e "Tenho CNH" → `atualizarPerfil`, e tem o botão "Sair".
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): cadastro do motorista com CPF e CNH`.

### Task 9: Motorista sem frota — Buscar carros e Minhas candidaturas

**Files:**
- Create:
  - `mobile/src/api/motorista.ts`
  - `mobile/src/app/(motorista)/_layout.tsx` (decide o grupo)
  - `mobile/src/app/(motorista)/(busca)/_layout.tsx`, `buscar.tsx`, `candidaturas.tsx`
- Replace: `mobile/src/app/(motorista)/index.tsx` (vira um redirecionamento)

**Interfaces:**
- **`api/motorista.ts`:**
  - `minhaSituacao(): Promise<{ frotaAtiva: { fleet_id: string; nome: string } | null }>`, a partir de `fleet_members` com status `ativo`;
  - `buscarCarros(uf, cidade): Promise<CarroVitrine[]>`;
  - `candidatar(vehicleId, mensagem?)`;
  - `minhasCandidaturas(): Promise<{ id; status; criada_em; carro: CarroVitrine }[]>`;
  - `meusPedidosDeEntrada(): Promise<{ id; status; frota_nome }[]>`;
  - `cancelarCandidatura(id)`;
  - `entrarComCodigo(codigo)`, via RPC `entrar_na_frota`.
- **`CarroVitrine`:** `{ vehicle_id; marca; modelo; ano_modelo; cor; foto_path; frota_nome; cidade; uf }`, sem placa.
- **Rotas:** `(motorista)/_layout` leva para `/(motorista)/(busca)/buscar` quando `frotaAtiva` é null e para `/(motorista)/(frota)/meu-carro` (Task 11) caso contrário. A key de React Query `['situacao']` é refeita no foco e no push.

- [ ] **Step 1: Testes**
  - **Buscar:** UF e cidade vêm preenchidas do perfil; "Buscar" chama `buscarCarros('SP','São Paulo')`.
  - **Resultados:** os cards (`CardCarro` **sem placa**) mostram o nome da frota; lista vazia mostra "Nenhum carro disponível na sua região no momento.".
  - **"Quero este carro":** abre uma mensagem opcional (máx. 300) → `candidatar`. Erro `SEM_CNH` mostra o DETAIL.
  - **Candidaturas:** status com os rótulos Aguardando, Aceita, Recusada, Cancelada; "Cancelar candidatura" só nas pendentes; o campo "Entrar com código da frota" chama `entrarComCodigo`; um pedido de entrada pendente aparece como "Pedido de entrada na frota X — Aguardando".
  - **Troca de grupo:** com `minhaSituacao` → `frotaAtiva` presente, o layout redireciona para o grupo da frota.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): busca de carros e candidaturas do motorista`.

### Task 10: Fila offline

**Files:** Create `mobile/src/fila/{fila.ts, processar.ts, useFila.ts}`, `mobile/src/componentes/IndicadorFila.tsx`

**Interfaces:**
- `export type ItemFila = { id: string; tipo: 'retirada'|'devolucao'|'km'|'ocorrencia'|'servico'|'foto_carro'; criadoEm: string; fotos: { uri: string; bucket: 'fotos'|'carros'; path: string; enviada: boolean; capturadoEm: string; posicao?: string }[]; acoes: { rpc: string; args: Record<string, unknown> }[]; tentativas: number; erro: { mensagem: string; negocio: boolean } | null }`
- **`fila.ts`** (persistido em AsyncStorage, chave `frotos:fila:v1`):
  - `adicionar(item: Omit<ItemFila,'id'|'tentativas'|'erro'>): Promise<string>`
  - `listar(): Promise<ItemFila[]>`
  - `descartar(id)`
  - `atualizar(id, parcial)`
- **`processar.ts`:** `processarFila(deps = { enviarFoto, chamarRpc, online: () => Promise<boolean> }): Promise<void>`.
  - Processa em ordem.
  - Para cada foto não enviada: `enviarFoto`, depois marca `enviada=true` e persiste.
  - Em seguida, as `acoes` em ordem. Cada uma é removida do item ao concluir e o item é persistido, para que uma nova tentativa não repita o que já foi feito.
  - Erro de negócio (P0001): grava `erro.negocio=true`, para **esse** item e segue para o próximo.
  - Erro de rede: `tentativas++` e para tudo (nova tentativa com espera de `min(2^tentativas, 60)`s, agendada pelo hook).
  - Sucesso: remove o item.
- **`useFila()`:** `{ pendentes: number; itens: ItemFila[]; reprocessar(); descartar(id) }`.
  - Dispara `processarFila` ao montar, quando o AppState fica `active` e a cada nova inserção.
- **`<IndicadorFila />`:** mostra "N envios pendentes"; quando há item com erro de negócio, mostra a mensagem e os botões "Tentar de novo" e "Descartar".

- [ ] **Step 1: Testes (unitários com deps mockadas e AsyncStorage mock)**
  - A fila persiste e é relida depois de "reiniciar" (nova instância).
  - Falha de rede na 3ª foto → as 2 primeiras ficam `enviada=true`, e um novo `processarFila` envia só a 3ª em diante (Review Focus 1).
  - Item com 2 ações, falha de rede na 2ª → uma nova tentativa executa só a 2ª.
  - Erro P0001 na ação → o item fica com `erro.negocio`, os itens seguintes são processados e não há nova tentativa automática do item com erro (Review Focus 5).
  - `IndicadorFila` mostra a contagem e os botões.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): fila offline de fotos e registros`.

### Task 11: Motorista na frota — Meu carro, retirada e devolução guiadas, ações

**Files:**
- Create:
  - `mobile/src/app/(motorista)/(frota)/_layout.tsx` (abas: Meu carro · Carros · Avisos)
  - `meu-carro.tsx`, `carros.tsx`, `avisos.tsx`
  - `mobile/src/app/(motorista)/fluxos/{fotos-carro.tsx, atualizar-km.tsx, ocorrencia.tsx, servico.tsx}`
  - `mobile/src/api/meuCarro.ts`
  - `mobile/src/componentes/SequenciaFotos.tsx`

**Interfaces:**
- **`api/meuCarro.ts`:**
  - `meuCarro(): Promise<{ vinculo: { id; status: 'aguardando_fotos'|'ativo'; vehicle_id } | null; carro: CarroFrota | null; reservado: CarroFrota | null }>`
    - `reservado` é o carro `visibilidade='um'` desse motorista, livre, quando não há vínculo.
  - `carrosParaMim(): Promise<CarroFrota[]>`, via RPC `carros_para_mim`.
  - `pedidosDoMotorista()`
- **`CarroFrota`:** `{ vehicle_id; placa; marca; modelo; ano_modelo; cor; foto_path; em_uso }`
- **`<SequenciaFotos momento: 'retirada'|'devolucao' onConcluir(fotos: {posicao, uri, capturadoEm}[], km: number) />`:**
  - passos em ordem: Frente, Traseira, Lateral esquerda, Lateral direita, Painel, cada um com ilustração (ícone e texto do ângulo), "Tirar foto" e "Refazer";
  - depois do painel, o campo "Km do painel" e "Concluir".
- **Retirada pela fila:**
  1. `iniciar_retirada` online (precisa do id do vínculo; offline → "Conecte-se à internet para iniciar a retirada.");
  2. coloca na fila um item com as 5 fotos (bucket `fotos`, caminhos de `novoCaminho(..., 'inspecao')`) e as ações `[registrar_fotos_inspecao(vinculo, 'retirada', fotos), concluir_retirada(vinculo)]`;
  3. a tela mostra "Enviando… N/5".
- **Devolução:** idem, com as ações `[registrar_fotos_inspecao(vinculo, 'devolucao', fotos), devolver_carro(vinculo, km, …)]`.
- **Outros fluxos (todos pela fila):**
  - **Atualizar km:** foto do painel + km → `registrar_km(origem 'atualizacao', foto_painel_path)`;
  - **Relatar ocorrência:** tipo, descrição e até 5 fotos;
  - **Registrar serviço:** itens, km, data, valor, oficina e foto da nota; aparece só quando `permissao_registro` ≠ `negado` ou há pedido aberto, e sempre passa `p_request_id` quando vem de um pedido.

- [ ] **Step 1: Testes**
  - **Meu carro sem vínculo:**
    - com carro reservado → `CardCarro` + "Retirar este carro", que abre a sequência;
    - sem reservado → "Escolha um carro na aba Carros".
  - **Com vínculo ativo:** os campos de foto não aparecem; há as próximas manutenções (`previsaoItens`) e os botões Atualizar km, Relatar ocorrência e Devolver carro, com Registrar serviço condicional.
  - **`SequenciaFotos`:**
    - não avança sem foto;
    - "Refazer" troca a foto;
    - km vazio → "Informe o km.";
    - concluir enfileira 5 fotos com as posições na ordem certa.
  - **Carros:** lista `carrosParaMim` com placa; em uso aparece como "Em uso" e fica desabilitado.
  - **Retirada iniciada offline:** mostra a mensagem de conexão.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(app): meu carro, retirada e devolução guiadas e ações do motorista`.

### Task 12: Push, build de teste e fechamento

**Files:** Create `mobile/src/lib/push.ts`, `mobile/eas.json`. Modify `mobile/src/app/_layout.tsx`, `mobile/app.json`, `mobile/README.md`.

**Interfaces:**
- `registrarPush(): Promise<void>`:
  - pede permissão;
  - pega `getExpoPushTokenAsync({ projectId })`;
  - grava em `profiles.expo_push_token` (update só da coluna);
  - silencioso se negado ou no simulador.
- `rotaDaNotificacao(data: { ref_tabela?: string; ref_id?: string }, papel): string | null`:
  - dono: `vehicles`/`vehicle_items` → carro; `maintenance_records`/`incidents` → pendências; `fleet_members`/`candidaturas` → motoristas;
  - motorista: `candidaturas`/`fleet_members` → recarrega a situação e vai ao grupo certo; `vehicles`/`maintenance_requests` → meu carro.
- **Quando registrar:** `registrarPush` é chamado depois do login (no `SessaoProvider`, quando o perfil carrega). O listener de resposta navega com `rotaDaNotificacao`.
- **`eas.json`:** perfis `development` (`developmentClient: true`, `distribution: internal`, Android `buildType: apk`) e `preview` (`distribution: internal`, Android `apk`).
- **`app.json`:** plugin `expo-notifications`.
- **Instalação:** `npx expo install expo-notifications expo-dev-client expo-device`.

- [ ] **Step 1: Testes**
  - `rotaDaNotificacao` cobre cada `ref_tabela` × papel.
  - `registrarPush` com permissão negada não chama o update; com permissão concedida, faz o update do token (mocks).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: README.**
  - Passo a passo:
    1. `npm i -g eas-cli`
    2. `eas login` (conta Expo gratuita)
    3. `eas init`, que grava o `projectId`
    4. `eas build -p android --profile development`
  - Depois, instalar o APK pelo link e rodar `npx expo start --dev-client`.
  - Para o piloto: `--profile preview`.
  - Push no Android exige credenciais FCM: seguir o assistente do `eas credentials` (documentar).
- [ ] **Step 6: Verificação final**
  - `cd mobile && npx tsc --noEmit && npx jest` (sem saída de console)
  - `npx expo export --platform android --output-dir ../.superpowers/export-check`, depois apagar a pasta
  - `cd .. && npm run db:reset && npm run db:test && npm test`
- [ ] **Step 7:** Commit `feat(app): push e build de teste`.
