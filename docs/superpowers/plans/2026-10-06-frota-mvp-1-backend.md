# Projeto Frotos — Plano 1 de 3: Backend (Supabase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o backend completo do MVP no Supabase: banco, regras de acesso, regras de negócio, previsão de manutenção e de gastos, notificações, consulta FIPE e dados de exemplo, tudo coberto por testes automáticos.

**Architecture:** Toda regra de negócio vive no PostgreSQL, em funções RPC `security definer` protegidas por Row Level Security. O app (planos 2 e 3) só lê tabelas permitidas pelo RLS e chama essas funções. Duas Edge Functions (Deno) fazem o que o banco não faz: enviar push pela Expo e consultar a API FIPE com cache. A lógica delas fica em módulos TypeScript puros, testados com Vitest no Node.

**Tech Stack:** Supabase CLI (local, via Docker Desktop), PostgreSQL 15+, pgTAP (`supabase test db`), pg_cron, pg_net, Supabase Storage, Edge Functions (Deno), Vitest + TypeScript para os módulos compartilhados.

**Spec:** `docs/superpowers/specs/2026-10-06-frota-mvp-design.md`

**Roteiro dos planos:**
- **Plano 1 (este):** backend.
- **Plano 2:** app Expo com base, login e as telas do proprietário.
- **Plano 3:** telas do motorista, fotos e fila offline, push no app e build de teste do Android.

## Global Constraints

- Nomes de tabelas, colunas e enums exatamente como neste plano. Eles vêm da spec §5.1, com os acréscimos listados em "Decisões deste plano".
- Toda tabela em `public` tem RLS habilitado.
- Escritas com regra de negócio só acontecem via funções RPC `security definer` com `set search_path = ''` e nomes qualificados (`public.x`, `auth.uid()`).
- **Erros de negócio:** usar `public.erro(codigo, detalhe)`, que gera SQLSTATE `P0001` com MESSAGE = código em MAIÚSCULAS (ex.: `KM_MENOR`) e DETAIL = texto em português para mostrar ao usuário.
- **"Hoje"** é `public.hoje_brt()` (fuso `America/Sao_Paulo`). Toda função de cálculo aceita `p_hoje date default public.hoje_brt()` para os testes.
- **Valores padrão (spec):**
  - `limite_salto_km_dia` = 350
  - `km_dia_estimado` = 300
  - `limiar_amarelo_km` = 1000
  - `limiar_amarelo_dias` = 7
  - `limiar_laranja_km` = 300
  - `modo_manutencao` = `proprietario_leva`
  - `nivel_manutencao` = `com_aprovacao`
- **Tipos:** km é sempre `int`; dinheiro é `numeric(10,2)` em reais.
- **Funções internas** (`notificar`, `erro`, `rotina_diaria`, `recalcular_ultima_troca`, `*_interna`) têm `execute` revogado de `public`, `anon` e `authenticated`.
- **Testes pgTAP:** cada arquivo roda em `begin; … rollback;` e nunca depende de contagens globais, porque o seed também está no banco. Sempre filtrar pelos ids criados no próprio teste.
- **Dependências permitidas:** `supabase` (CLI), `vitest`, `typescript` e, nas Edge Functions, `npm:@supabase/supabase-js@2`.
- **Idioma:** identificadores e comentários em português, como na spec.

## Decisões deste plano (complementam a spec; avisar o autor)

1. `vehicle_items` ganha `km_inicial` e `data_inicial`, o histórico informado no cadastro. `ultimo_km` e `ultima_data` passam a ser **derivados**: último serviço aprovado ou, na falta dele, o histórico inicial. É isso que permite a contestação "desfazer" corretamente.
2. A leitura de km de um serviço é gravada **no registro do serviço** quando `km > km_atual`, passando pela validação de km. Serviços registrados com atraso (`km ≤ km_atual`) são aceitos e não geram leitura.
3. **Uma frota por proprietário** no MVP (`fleets.owner_id` único).
4. `vehicles.em_uso` indica se o carro está livre ou ocupado. Assim o motorista vê esse estado sem enxergar os vínculos dos outros.
5. `notifications` ganha `prioridade` e `push_enviado_em`.
6. `cancelar_retirada` libera um carro cuja retirada ficou presa aguardando fotos.

## Review Focus

1. **Carro parado (média de 0 km/dia):** a previsão não pode dividir por zero; vale só o critério de tempo. Teste na Task 8.
2. **Serviço registrado com atraso, com km menor que o atual:** deve ser aceito sem criar leitura de km nem dar `KM_MENOR`. Teste na Task 6.
3. **Motorista removido ou carro devolvido com pedido aberto:** o vínculo é encerrado, o carro fica livre, o pedido é cancelado e o dono é avisado. Testes nas Tasks 5 e 6.
4. **Dois motoristas tentando retirar o mesmo carro ao mesmo tempo:** só um consegue; o outro recebe `CARRO_OCUPADO`, e não um erro cru de índice único. Teste na Task 5.
5. **Contestar o único serviço de um item:** volta para o histórico inicial ou, se ele não existir, para "sem histórico". Teste na Task 6.

---

## Estrutura de arquivos

```
package.json, .gitignore, README.md, vitest.config.ts
supabase/config.toml                         (gerado por supabase init)
supabase/migrations/
  20261006000100_base.sql                    utilitários, perfis, notificações
  20261006000200_frotas.sql                  frotas, membros, convites
  20261006000300_veiculos.sql                catálogo, veículos, itens
  20261006000400_vinculos_km.sql             vínculos, leituras, fotos, storage
  20261006000500_manutencao.sql              pedidos, serviços, permissões
  20261006000600_ocorrencias.sql             ocorrências
  20261006000700_previsao.sql                média, previsão, status, resumo
  20261006000800_gastos.sql                  projeção e realizado
  20261006000900_rotina_diaria.sql           rotina diária + pg_cron
  20261006001000_push.sql                    agendamento do envio de push (pg_net)
  20261006001100_fipe_cache.sql              cache da FIPE
supabase/tests/database/                     pgTAP, um arquivo por migração (000…100)
supabase/functions/_shared/expo-push.ts      lógica pura do push
supabase/functions/_shared/fipe.ts           lógica pura da FIPE
supabase/functions/enviar-push/index.ts
supabase/functions/fipe/index.ts
tests/functions/expo-push.test.ts, tests/functions/fipe.test.ts
supabase/seed.sql
```

---

### Task 1: Projeto, Supabase local e utilitários de teste

**Files:**
- Create: `package.json`, `.gitignore`, `vitest.config.ts`, `README.md`, `supabase/config.toml` (via CLI), `supabase/tests/database/000-helpers.test.sql`

**Interfaces:**
- Produces: scripts `npm run db:start | db:stop | db:reset | db:test | test`; funções de teste `tests.criar_usuario(p_email text, p_papel text, p_nome text default 'Teste') returns uuid`, `tests.entrar_como(p_uid uuid) returns void`, `tests.sair() returns void`.

- [ ] **Step 0 (manual, autor):** instalar o Docker Desktop (backend WSL2), abri-lo e confirmar com `docker info` que não há erro. Sem isso nada abaixo roda.

- [ ] **Step 1: Criar `package.json`**

`private: true`, `name: "frotos"`. Scripts:
- `db:start` = `supabase start`
- `db:stop` = `supabase stop`
- `db:reset` = `supabase db reset`
- `db:test` = `supabase test db`
- `test` = `vitest run`

devDependencies: `supabase`, `vitest`, `typescript`. Rodar `npm install`.

- [ ] **Step 2: Inicializar o Supabase**

Run: `npx supabase init` (responder "não" para as configurações de VS Code/IntelliJ e de Deno). Em `supabase/config.toml`, definir `project_id = "frotos"`.

`.gitignore`: `node_modules/`, `.env*`, `supabase/.temp/`, `supabase/.branches/`.

`vitest.config.ts`: `include: ['tests/functions/**/*.test.ts']`.

- [ ] **Step 3: Subir o Supabase local**

Run: `npm run db:start`
Expected: imprime `API URL: http://127.0.0.1:54321` e as chaves. A primeira vez demora porque baixa as imagens.

- [ ] **Step 4: Escrever `000-helpers.test.sql`**

Este arquivo **não** faz rollback: ele deixa os utilitários instalados para os arquivos seguintes. Conteúdo:
1. `create extension if not exists pgtap with schema extensions;`
2. `create schema if not exists tests;`
3. As três funções (`create or replace`):
   - `tests.criar_usuario`: insere em `auth.users` (`id = gen_random_uuid()`, `email`, `aud` e `role` = `'authenticated'`, `raw_user_meta_data = {"nome": p_nome, "papel": p_papel}`) e retorna o id. Se `p_papel` for null, a chave `papel` fica de fora do JSON.
   - `tests.entrar_como`: `set_config('role','authenticated',true)` e `set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true)`.
   - `tests.sair`: `set_config('role','none',true)` e limpa `request.jwt.claims`.
4. `grant usage on schema tests to authenticated; grant execute on all functions in schema tests to authenticated;`
5. `select plan(1); select has_function('tests','criar_usuario',array['text','text','text']); select * from finish();`

- [ ] **Step 5: Rodar os testes do banco**

Run: `npm run db:test`
Expected: `000-helpers.test.sql .. ok` e `Result: PASS`.

- [ ] **Step 6: README**

Seções:
- **Pré-requisitos:** Node 20+ e Docker Desktop.
- **Primeira vez:** `npm install` e `npm run db:start`.
- **Testes:** `npm run db:test` (banco) e `npm test` (funções).
- **Resetar o banco:** `npm run db:reset`.
- **Notificações push:** placeholder, preenchido na Task 11.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore vitest.config.ts README.md supabase/
git commit -m "chore: projeto Supabase local e utilitários de teste"
```

---

### Task 2: Base — utilitários, perfis e notificações

**Files:**
- Create: `supabase/migrations/20261006000100_base.sql`
- Test: `supabase/tests/database/010-base.test.sql`

**Interfaces:**
- Produces:
  - **Utilitários:**
    - `public.erro(p_codigo text, p_detalhe text) returns void`
    - `public.fmt_km(p_km int) returns text`, ex.: `45200` → `'45.200'`
    - `public.hoje_brt() returns date`
  - **Perfis:**
    - enum `public.papel_usuario ('proprietario','motorista')`
    - tabela `public.profiles(id uuid pk → auth.users on delete cascade, nome text not null, telefone text, papel papel_usuario not null, expo_push_token text, criado_em timestamptz default now())`
  - **Notificações:**
    - tabela `public.notifications(id uuid pk, user_id uuid → profiles, tipo text not null, titulo text not null, corpo text not null, prioridade text not null default 'normal' check in ('normal','alta'), ref_tabela text, ref_id uuid, lida bool not null default false, push_enviado_em timestamptz, criada_em timestamptz default now())`
    - `public.notificar(p_user_id uuid, p_tipo text, p_titulo text, p_corpo text, p_ref_tabela text default null, p_ref_id uuid default null, p_prioridade text default 'normal') returns void` (interna)

- [ ] **Step 1: Escrever o teste `010-base.test.sql`**

Cada linha é um teste; o `plan(8)` conta-os.

```sql
-- 1  usuário com papel 'motorista' gera profile com papel motorista e nome do metadata
-- 2  throws_ok( tests.criar_usuario('x@t.dev', null), 'P0001', 'PAPEL_OBRIGATORIO' )
-- 3  is( public.fmt_km(45200), '45.200' );  is( public.fmt_km(1234567), '1.234.567' )  (conta como 1 com ok(a and b))
-- 4  como usuário A: select count(*) from profiles where id = B  → 0
-- 5  como A: throws_ok( update profiles set papel='proprietario' where id = A, '42501' )
-- 6  como A: lives_ok( update profiles set nome='Novo', expo_push_token='ExponentPushToken[x]' where id = A )
-- 7  como A: throws_ok( select public.notificar(A,'t','t','c'), '42501' )
-- 8  notificar(A,…) e notificar(B,…) como postgres; como A: count(*) from notifications = 1, e A consegue marcar lida=true
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run db:test`
Expected: FAIL em `010-base` (relação `profiles` não existe).

- [ ] **Step 3: Implementar a migração `20261006000100_base.sql`**

- `erro`: `raise exception using errcode = 'P0001', message = p_codigo, detail = p_detalhe`.
- `fmt_km`: `replace(to_char(p_km, 'FM999,999,999'), ',', '.')`.
- `hoje_brt`: `(now() at time zone 'America/Sao_Paulo')::date`.
- Trigger `public.criar_perfil()` `after insert on auth.users`:
  - `nome` = `coalesce(meta->>'nome', split_part(email,'@',1))`
  - `telefone` = `meta->>'telefone'`
  - `papel` = obrigatório; se faltar, `erro('PAPEL_OBRIGATORIO', 'Escolha se você é proprietário ou motorista.')`
- **RLS de `profiles`:** select e update apenas `id = auth.uid()`. Grants: `revoke update on profiles from authenticated; grant update (nome, telefone, expo_push_token) on profiles to authenticated`.
- **RLS de `notifications`:** select `user_id = auth.uid()`. Update: mesma condição, com `grant update (lida)` apenas.
- `revoke execute` de `erro` e `notificar` para `public, anon, authenticated`.

- [ ] **Step 4: Aplicar e testar**

Run: `npm run db:reset && npm run db:test`
Expected: `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261006000100_base.sql supabase/tests/database/010-base.test.sql
git commit -m "feat(db): perfis, notificações e utilitários"
```

---

### Task 3: Frotas, membros e convites

**Files:**
- Create: `supabase/migrations/20261006000200_frotas.sql`
- Test: `supabase/tests/database/020-frotas.test.sql`

**Interfaces:**
- Consumes: `erro`, `notificar`, `profiles` (Task 2).
- Produces:
  - **Enums:**
    - `modo_manutencao ('proprietario_leva','motoristas_levam')`
    - `status_membro ('pendente','ativo','removido')`
    - `nivel_manutencao ('sem_permissao','com_aprovacao','confiavel')`
  - **Tabelas:**
    - `fleets(id uuid pk, owner_id uuid unique → profiles, nome text not null, codigo_convite text unique not null, modo_manutencao default 'proprietario_leva', limite_salto_km_dia int default 350, limiar_amarelo_km int default 1000, limiar_amarelo_dias int default 7, limiar_laranja_km int default 300, criada_em timestamptz default now())`
    - `fleet_members(id uuid pk, fleet_id → fleets, driver_id → profiles, status status_membro default 'pendente', nivel_manutencao nivel_manutencao default 'com_aprovacao', criado_em, unique(fleet_id, driver_id))`
  - **Auxiliares de RLS** (`security definer stable`):
    - `public.e_dono_frota(p_fleet_id uuid) returns bool`
    - `public.e_membro_ativo(p_fleet_id uuid) returns bool`
  - **RPCs:**
    - `public.criar_frota(p_nome text) returns public.fleets`
    - `public.gerar_novo_codigo(p_fleet_id uuid) returns text`
    - `public.entrar_na_frota(p_codigo text) returns public.fleet_members`
    - `public.responder_entrada(p_member_id uuid, p_aprovar boolean) returns public.fleet_members`
  - **Tipos de notificação:** `entrada_pedida` (para o dono) e `entrada_aprovada` (para o motorista).

- [ ] **Step 1: Escrever o teste `020-frotas.test.sql`**

```sql
-- 1  dono cria frota: codigo_convite ~ '^FRT-[A-HJ-NP-Z2-9]{4}$' e valores padrão (350, 1000, 7, 300, 'proprietario_leva')
-- 2  motorista: throws_ok(criar_frota('X'), 'P0001', 'APENAS_PROPRIETARIO')
-- 3  mesmo dono 2ª frota: throws_ok(..., 'P0001', 'FROTA_JA_EXISTE')
-- 4  motorista entra com lower(codigo) com espaços nas pontas → membro status 'pendente', nivel 'com_aprovacao'
-- 5  dono recebeu 1 notificação tipo 'entrada_pedida'
-- 6  entrar de novo: 'JA_MEMBRO';  código inexistente: 'CODIGO_INVALIDO';  proprietário entrando: 'APENAS_MOTORISTA'
-- 7  motorista pendente: count(*) from fleets where id = F → 0
-- 8  dono responder_entrada(m, true) → 'ativo'; motorista agora vê a frota (1) e recebeu 'entrada_aprovada'
-- 9  responder_entrada(m2, false) → 'removido'; motorista removido pode entrar de novo → volta a 'pendente'
-- 10 gerar_novo_codigo: o código antigo agora dá 'CODIGO_INVALIDO'
-- 11 motorista: update fleet_members set nivel_manutencao='confiavel' → 0 linhas afetadas (dono continua vendo 'com_aprovacao')
-- 12 dono: update fleet_members set nivel_manutencao='confiavel' funciona; update fleets set modo_manutencao funciona
-- 13 outro proprietário: count(*) from fleets where id = F → 0; responder_entrada de membro alheio → 'SEM_ACESSO'
-- 14 dono vê o profile do motorista membro; motorista vê o profile do dono
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run db:test`
Expected: FAIL em `020-frotas`.

- [ ] **Step 3: Implementar a migração**

- **Código de convite:** `'FRT-'` + 4 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sorteados até não colidir (função interna `gerar_codigo_convite()`).
- `entrar_na_frota` normaliza com `upper(trim(p_codigo))`.
- `responder_entrada` só funciona para membros `pendente` (senão, `TRANSICAO_INVALIDA`).
- **RLS de `fleets`:**
  - select: `e_dono_frota(id) or e_membro_ativo(id)`
  - update: dono, com `grant update (nome, modo_manutencao, limite_salto_km_dia, limiar_amarelo_km, limiar_amarelo_dias, limiar_laranja_km)`
  - sem insert ou delete direto
- **RLS de `fleet_members`:**
  - select: dono da frota ou `driver_id = auth.uid()`
  - update: dono, com `grant update (nivel_manutencao)`
- **Políticas extras em `profiles`:**
  - o dono vê os perfis dos membros da sua frota
  - o membro (qualquer status) vê o perfil do dono da frota
- **Mensagens (DETAIL):**
  - `APENAS_PROPRIETARIO`: "Somente proprietários podem criar frotas."
  - `FROTA_JA_EXISTE`: "Você já tem uma frota cadastrada."
  - `APENAS_MOTORISTA`: "Somente motoristas podem entrar em uma frota."
  - `CODIGO_INVALIDO`: "Código de frota não encontrado. Confira com o proprietário."
  - `JA_MEMBRO`: "Você já pediu para entrar nesta frota."
  - `SEM_ACESSO`: "Você não tem acesso a esta informação."

- [ ] **Step 4: Aplicar e testar**

Run: `npm run db:reset && npm run db:test`
Expected: PASS.

- [ ] **Step 5: Commit** (`feat(db): frotas, membros e código de convite`)

---

### Task 4: Catálogo, veículos e itens de manutenção

**Files:**
- Create: `supabase/migrations/20261006000300_veiculos.sql`
- Test: `supabase/tests/database/030-veiculos.test.sql`

**Interfaces:**
- Consumes: `e_dono_frota`, `e_membro_ativo` (Task 3).
- Produces:
  - **Enum:** `status_item ('sem_historico','vencido','urgente','proximo','em_dia')`
  - **Tabelas:**
    - `maintenance_catalog(id uuid pk, nome text unique, intervalo_km int, intervalo_meses int, custo_sugerido numeric(10,2), ordem int)`
    - `vehicles(id uuid pk, fleet_id → fleets, placa text, marca text not null, modelo text not null, ano_modelo int not null, cor text not null, fipe_codigo text, km_atual int not null check (km_atual >= 0), km_dia_estimado int not null default 300 check (> 0), exige_aprovacao_sempre bool default false, em_uso bool default false, ativo bool default true, criado_em, unique(fleet_id, placa))`
    - `vehicle_items(id uuid pk, vehicle_id → vehicles on delete cascade, catalog_id → maintenance_catalog null, nome text not null, intervalo_km int, intervalo_meses int, check (intervalo_km is not null or intervalo_meses is not null), km_inicial int, data_inicial date, ultimo_km int, ultima_data date, custo_estimado numeric(10,2) not null default 0, status_atual status_item not null default 'sem_historico', ativo bool default true)`
  - **RPCs:**
    - `public.atualizar_item(p_item_id uuid, p_intervalo_km int, p_intervalo_meses int, p_custo_estimado numeric, p_aplicar_em_todos boolean) returns int` (retorna quantos itens foram alterados)
    - `public.definir_historico_inicial(p_item_id uuid, p_km_inicial int, p_data_inicial date) returns public.vehicle_items`
  - **Interna:** `public.recalcular_ultima_troca(p_item_id uuid) returns void`. Nesta task usa só o histórico inicial; a Task 6 a substitui.

- [ ] **Step 1: Escrever o teste `030-veiculos.test.sql`**

```sql
-- 1  catálogo tem 11 itens (nomes da spec §5.1)
-- 2  dono insere veículo → 11 vehicle_items, todos 'sem_historico', custo_estimado = custo_sugerido do catálogo
-- 3  placa 'abc-1d23' é gravada como 'ABC1D23'; placa 'AB12' → throws_ok '23514'
-- 4  mesma placa duas vezes na frota → throws_ok '23505'
-- 5  frota com 3 carros: atualizar_item(item_oleo_carro1, 8000, 6, 200, false) → 1; só o carro1 mudou
-- 6  atualizar_item(..., true) → 3; o óleo dos 3 carros ficou 8000/6/200; o óleo de um carro de OUTRA frota não mudou
-- 7  item personalizado (catalog_id null, nome 'Bateria') + aplicar_em_todos → casa por nome na mesma frota
-- 8  definir_historico_inicial(item, 40000, '2026-08-01') → km_inicial/ultimo_km = 40000, data_inicial/ultima_data = 2026-08-01
-- 9  motorista ativo: vê os 3 veículos da frota; insert em vehicles → throws_ok '42501'
-- 10 motorista pendente: vê 0 veículos;  motorista ativo sem vínculo: vê 0 vehicle_items
-- 11 motorista chamando atualizar_item → 'SEM_ACESSO'
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run db:test` → FAIL em `030-veiculos`.

- [ ] **Step 3: Implementar a migração**

- **Seed do catálogo** (valores provisórios, editáveis):

  | nome | km | meses | custo | ordem |
  |---|---|---|---|---|
  | Óleo do motor | 10000 | 6 | 180 | 1 |
  | Filtro de óleo | 10000 | 6 | 40 | 2 |
  | Filtro de ar | 15000 | 12 | 60 | 3 |
  | Filtro de combustível | 20000 | 12 | 80 | 4 |
  | Filtro de cabine (ar-condicionado) | 15000 | 12 | 60 | 5 |
  | Pastilhas de freio | 30000 | 24 | 250 | 6 |
  | Fluido de freio | 30000 | 24 | 120 | 7 |
  | Pneus (rodízio e alinhamento) | 10000 | 6 | 120 | 8 |
  | Correia dentada | 50000 | 48 | 600 | 9 |
  | Velas de ignição | 30000 | 24 | 150 | 10 |
  | Líquido de arrefecimento | 40000 | 24 | 150 | 11 |

- **Placa:** trigger `before insert or update` normaliza com `upper(regexp_replace(placa,'[^A-Za-z0-9]','','g'))`, e uma check exige `placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'` (formato antigo e Mercosul).
- **Itens do carro:** trigger `after insert on vehicles` copia o catálogo para `vehicle_items`.
- `atualizar_item` com `p_aplicar_em_todos`: altera os itens ativos dos carros ativos da mesma frota com o mesmo `catalog_id` (ou o mesmo `nome`, quando `catalog_id` for null). Muda **só** intervalos e custo, nunca o histórico.
- **RLS de `vehicles`:**
  - select: `e_dono_frota(fleet_id) or e_membro_ativo(fleet_id)`
  - insert e update: só o dono (`with check e_dono_frota(fleet_id)`)
- **RLS de `vehicle_items`:** dono com acesso total (insert de itens personalizados incluso). A política do motorista entra na Task 5.
- `revoke execute` de `recalcular_ultima_troca`.

- [ ] **Step 4: Aplicar e testar** — `npm run db:reset && npm run db:test` → PASS.

- [ ] **Step 5: Commit** (`feat(db): catálogo, veículos e itens de manutenção`)

---

### Task 5: Vínculos, leituras de km, fotos e storage

**Files:**
- Create: `supabase/migrations/20261006000400_vinculos_km.sql`
- Test: `supabase/tests/database/040-vinculos-km.test.sql`, `supabase/tests/database/001-cenario.test.sql`

**Interfaces:**
- Consumes: Tasks 2 a 4.
- Produces:
  - **Enums:**
    - `status_vinculo ('aguardando_fotos','ativo','encerrado')`
    - `origem_km ('retirada','devolucao','atualizacao','manutencao','correcao_dono')`
    - `momento_foto ('retirada','devolucao')`
    - `posicao_foto ('frente','traseira','lateral_esq','lateral_dir','extra')`
  - **Tabelas:**
    - `assignments(id uuid pk, vehicle_id, driver_id, status status_vinculo default 'aguardando_fotos', inicio_em timestamptz default now(), fim_em timestamptz, km_inicio int not null, km_fim int)`, com índices únicos parciais em `vehicle_id` e em `driver_id` `where status <> 'encerrado'`
    - `odometer_readings(id uuid pk, vehicle_id, autor_id, km int not null, origem origem_km not null, foto_painel_path text, salto_suspeito bool default false, capturado_em timestamptz not null, recebido_em timestamptz default now())`
    - `inspection_photos(id uuid pk, assignment_id, momento momento_foto, posicao posicao_foto, path text not null, capturado_em timestamptz not null, recebido_em timestamptz default now())`
  - **Bucket:** `fotos`, privado. Caminho: `{fleet_id}/{vehicle_id}/{inspecao|painel|nota|ocorrencia}/{uuid}.jpg`.
  - **Auxiliar de RLS:** `public.tem_vinculo_ativo(p_vehicle_id uuid) returns bool` (o usuário atual tem vínculo `aguardando_fotos` ou `ativo` no carro).
  - **RPCs:**
    - `public.registrar_km(p_vehicle_id uuid, p_km int, p_origem public.origem_km default 'atualizacao', p_foto_painel_path text default null, p_capturado_em timestamptz default now()) returns public.odometer_readings`
    - `public.iniciar_retirada(p_vehicle_id uuid, p_km int, p_foto_painel_path text default null, p_capturado_em timestamptz default now()) returns public.assignments`
    - `public.concluir_retirada(p_assignment_id uuid) returns public.assignments`
    - `public.cancelar_retirada(p_assignment_id uuid) returns public.assignments`
    - `public.devolver_carro(p_assignment_id uuid, p_km int, p_foto_painel_path text default null, p_capturado_em timestamptz default now()) returns public.assignments`
    - `public.remover_motorista(p_member_id uuid) returns public.fleet_members`
  - **Notificação:** `km_foto_painel` (para o dono).
  - **Teste:** `tests.cenario_basico() returns jsonb`, com as chaves `dono, frota, carro1, carro2, mot_ativo, mot_ativo2, mot_pendente, membro_ativo, membro_ativo2`. Os carros têm `km_atual` 10000, e o carro1 já tem uma leitura de 10000 capturada há 1 dia.

- [ ] **Step 1: Escrever `001-cenario.test.sql`**

Mesmo padrão do `000-helpers` (sem rollback). Cria `tests.cenario_basico()` usando `tests.criar_usuario`, `criar_frota`, `entrar_na_frota`, `responder_entrada` e insert em `vehicles`. Conclui com `plan(1)` + `has_function`.

- [ ] **Step 2: Escrever o teste `040-vinculos-km.test.sql`**

```sql
-- 1  mot_ativo iniciar_retirada(carro1, 10000) → status 'aguardando_fotos'; carro1.em_uso = true; leitura origem 'retirada'
-- 2  mot_ativo2 iniciar_retirada(carro1, …) → 'CARRO_OCUPADO'            (Review Focus 4)
-- 3  simular corrida: inserir direto assignment aberto para carro2 com em_uso ainda false, então
--    mot_ativo2 iniciar_retirada(carro2) → 'CARRO_OCUPADO' (unique_violation traduzido)   (Review Focus 4)
-- 4  mot_ativo iniciar_retirada(carro2) com vínculo aberto → 'JA_TEM_CARRO';  mot_pendente → 'SEM_ACESSO'
-- 5  concluir_retirada sem fotos → 'FOTOS_FALTANDO'; com as 4 posições de 'retirada' → status 'ativo'
-- 6  registrar_km(carro1, 9999) → 'KM_MENOR'
-- 7  leitura anterior 10000 há 1 dia: registrar_km(10351) → 'FOTO_PAINEL_OBRIGATORIA'; registrar_km(10350) → ok
-- 8  leitura anterior há 5 dias: +1750 sem foto → ok
-- 9  +5000 com foto_painel_path → ok, salto_suspeito = true, dono recebeu 'km_foto_painel'
-- 10 registrar_km atualiza vehicles.km_atual
-- 11 dono registrar_km(carro1, 9000, 'correcao_dono') → ok e km_atual = 9000; motorista com 'correcao_dono' → 'SEM_ACESSO'
-- 12 motorista sem vínculo no carro2: registrar_km(carro2, …) → 'SEM_ACESSO'
-- 13 com vínculo: motorista vê 11 vehicle_items do carro1 e 0 do carro2
-- 14 devolver_carro sem fotos de 'devolucao' → 'FOTOS_FALTANDO'; com as 4 → 'encerrado', fim_em e km_fim preenchidos, em_uso = false
-- 15 cancelar_retirada de vínculo 'aguardando_fotos' → 'encerrado', em_uso = false; de vínculo 'ativo' → 'TRANSICAO_INVALIDA'
-- 16 remover_motorista com vínculo ativo → membro 'removido', vínculo 'encerrado', carro livre   (Review Focus 3)
-- 17 storage: motorista ativo insere em storage.objects (bucket 'fotos', name '{frota}/{carro1}/inspecao/x.jpg') → ok;
--    name com outra frota → throws_ok '42501'
```

- [ ] **Step 3: Rodar e ver falhar** — `npm run db:test` → FAIL em `040`.

- [ ] **Step 4: Implementar a migração**

- **`registrar_km`:**
  - **Acesso:** dono da frota ou `tem_vinculo_ativo`; senão, `SEM_ACESSO`. A origem `correcao_dono` é exclusiva do dono.
  - **Km menor:** fora de correção, `p_km < km_atual` → `erro('KM_MENOR', format('O km informado (%s) é menor que o último registro (%s).', fmt_km(p_km), fmt_km(km_atual)))`.
  - **Salto:** usa a última leitura do carro (maior `capturado_em`). Se não houver leitura anterior, não há checagem.
    - `dias = greatest(1, extract(epoch from p_capturado_em - ultima.capturado_em) / 86400.0)`
    - Se `p_km - km_atual > limite_salto_km_dia * dias`: sem foto → `erro('FOTO_PAINEL_OBRIGATORIA', format('O km subiu %s desde o último registro. Tire uma foto do painel para confirmar.', fmt_km(p_km - km_atual)))`; com foto → `salto_suspeito = true` e `notificar(dono, 'km_foto_painel', …)`.
  - Atualiza `vehicles.km_atual = p_km`.
- **`iniciar_retirada`:**
  - Exige membro `ativo` (`SEM_ACESSO`), carro ativo e livre (`CARRO_OCUPADO`) e motorista sem vínculo aberto (`JA_TEM_CARRO`).
  - Insere o vínculo e marca `em_uso = true`.
  - Chama `registrar_km(..., 'retirada', ...)`.
  - Captura `unique_violation` e converte em `CARRO_OCUPADO`.
- **`concluir_retirada` e `devolver_carro`:** conferem as posições `frente, traseira, lateral_esq, lateral_dir` do momento correspondente. Se faltar alguma, o DETAIL lista as que faltam, ex.: `'Faltam fotos: traseira, lateral direita.'` (rótulos: Frente, Traseira, Lateral esquerda, Lateral direita).
- **`devolver_carro`:** só para o motorista dono do vínculo `ativo` (`VINCULO_INVALIDO`). Registra o km com origem `devolucao` **antes** de encerrar.
- **`cancelar_retirada`:** pode ser chamado pelo motorista do vínculo ou pelo dono.
- **`remover_motorista`:** só o dono. Encerra o vínculo aberto com `km_fim = km_atual` do carro.
- **RLS:**
  - `vehicle_items`: o motorista pode dar select quando `tem_vinculo_ativo(vehicle_id)`.
  - `assignments`: select para o dono ou o próprio motorista.
  - `odometer_readings`: select para o dono, o próprio autor ou quem tem `tem_vinculo_ativo(vehicle_id)`.
  - `inspection_photos`: select para o dono ou o motorista do vínculo; insert pelo motorista do vínculo não encerrado.
- **Storage:** `insert into storage.buckets (id, name, public) values ('fotos','fotos',false)`. Políticas em `storage.objects` para `bucket_id = 'fotos'`, com `f = ((storage.foldername(name))[1])::uuid`:
  - select: `e_dono_frota(f) or e_membro_ativo(f)`
  - insert: mesma condição

- [ ] **Step 5: Aplicar e testar** — `npm run db:reset && npm run db:test` → PASS.

- [ ] **Step 6: Commit** (`feat(db): retirada, devolução, leituras de km e fotos`)

---

### Task 6: Pedidos e registro de serviços (manutenção)

**Files:**
- Create: `supabase/migrations/20261006000500_manutencao.sql`
- Test: `supabase/tests/database/050-manutencao.test.sql`

**Interfaces:**
- Consumes: Tasks 2 a 5 (`registrar_km`, `tem_vinculo_ativo`, `recalcular_ultima_troca`).
- Produces:
  - **Enums:**
    - `status_servico ('pendente','aprovado','recusado','contestado')`
    - `status_pedido ('aberto','concluido','cancelado')`
  - **Tabelas:**
    - `maintenance_requests(id uuid pk, vehicle_id, driver_id, itens uuid[] not null, prazo date not null, observacao text, status status_pedido default 'aberto', prazo_notificado bool default false, criado_em)`
    - `maintenance_records(id uuid pk, vehicle_id, autor_id, request_id → maintenance_requests null, oficina text, km int not null, data date not null, valor_total numeric(10,2) not null check (>= 0), nota_foto_path text, status status_servico not null, revisado_por uuid, revisado_em timestamptz, motivo text, criado_em)`
    - `maintenance_record_items(id uuid pk, record_id → maintenance_records on delete cascade, vehicle_item_id → vehicle_items null, nome_outro text, valor numeric(10,2), check (vehicle_item_id is not null or nome_outro is not null))`
  - **RPCs:**
    - `public.permissao_registro(p_vehicle_id uuid, p_request_id uuid default null) returns text`, que retorna `'aprovado' | 'pendente' | 'negado'`
    - `public.registrar_servico(p_vehicle_id uuid, p_itens jsonb, p_km int, p_data date, p_valor_total numeric, p_request_id uuid default null, p_oficina text default null, p_nota_foto_path text default null, p_foto_painel_path text default null) returns public.maintenance_records`
      - `p_itens` = `[{"vehicle_item_id": "<uuid>", "valor": 150.00}, {"nome_outro": "Lâmpada", "valor": 20}]` (`valor` é opcional)
    - `public.revisar_servico(p_record_id uuid, p_decisao text, p_motivo text default null) returns public.maintenance_records`, com `p_decisao` ∈ `'aprovar' | 'recusar' | 'contestar'`
    - `public.criar_pedido(p_vehicle_id uuid, p_itens uuid[], p_prazo date, p_observacao text default null) returns public.maintenance_requests`
    - `public.cancelar_pedido(p_request_id uuid) returns public.maintenance_requests`
    - `public.custo_medio_item(p_item_id uuid) returns numeric` (null se não houver serviço aprovado)
  - **Interna:** `recalcular_ultima_troca` é substituída pela versão que considera os serviços.
  - **Tipos de notificação:**
    - `servico_pendente`, `servico_registrado` e `pedido_cancelado` (para o dono)
    - `servico_revisado` e `pedido_novo` (para o motorista)

- [ ] **Step 1: Escrever o teste `050-manutencao.test.sql`**

```sql
-- 0  setup: mot_ativo com vínculo 'ativo' no carro1 (sem vínculo a permissão é sempre 'negado')
-- 1  Matriz de permissão (spec §5.4): um bloco DO percorre modo × com_pedido × nivel × trava (24 combinações),
--    ajusta frota/membro/carro (e cria/cancela um pedido aberto para mot_ativo no carro1), chama
--    permissao_registro como mot_ativo e grava numa tabela temporária; results_eq contra VALUES com as 24 linhas
--    derivadas da regra:
--      com pedido            → trava ? 'pendente' : (nivel='confiavel' ? 'aprovado' : 'pendente')
--      sem pedido, proprietario_leva → 'negado'
--      sem pedido, motoristas_levam  → nivel='sem_permissao' ? 'negado' : (trava ? 'pendente' : nivel='confiavel' ? 'aprovado' : 'pendente')
-- 2  dono: permissao_registro → 'aprovado'
-- 3  confiável (motoristas_levam) registra óleo em 10500 com nota → status 'aprovado'; item óleo ultimo_km = 10500; dono recebeu 'servico_registrado'
-- 4  com_aprovacao registra → 'pendente'; item não muda; dono recebeu 'servico_pendente'
-- 5  dono revisar_servico(r,'aprovar') → item atualizado; motorista recebeu 'servico_revisado'
-- 6  revisar_servico(r,'recusar') num aprovado → 'TRANSICAO_INVALIDA'
-- 7  contestar o único serviço de item com histórico inicial 8000 → ultimo_km volta a 8000   (Review Focus 5)
--    contestar o único serviço de item sem histórico → ultimo_km e ultima_data null            (Review Focus 5)
-- 8  motorista sem nota → 'FOTO_NOTA_OBRIGATORIA'; dono sem nota → ok
-- 9  km_atual 12000, serviço com km 11500 → aceito, nenhuma leitura nova                      (Review Focus 2)
-- 10 serviço com km 12100 > km_atual → leitura origem 'manutencao' criada e km_atual = 12100
-- 11 item de outro carro → 'ITEM_INVALIDO'; p_itens '[]' → 'ITENS_OBRIGATORIOS'; data futura → 'DATA_FUTURA'
-- 12 sem_permissao + proprietario_leva sem pedido → 'SEM_PERMISSAO'
-- 13 criar_pedido em carro sem motorista → 'CARRO_SEM_MOTORISTA'; com motorista → motorista recebe 'pedido_novo'
-- 14 motorista sem_permissao registra via pedido → 'pendente'; dono aprova → pedido 'concluido'
-- 15 pedido de outro motorista ou já concluído → 'PEDIDO_INVALIDO'
-- 16 devolver_carro com pedido aberto → pedido 'cancelado' e dono recebe 'pedido_cancelado'        (Review Focus 3)
-- 17 cancelar_pedido pelo dono → 'cancelado'; motorista chamando → 'SEM_ACESSO'
-- 18 custo_medio_item após serviços aprovados com valores 150 e 210 → 180; item sem serviço → null
-- 19 RLS: motorista vê os serviços do carro com vínculo; outro motorista não vê nenhum
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run db:test` → FAIL em `050`.

- [ ] **Step 3: Implementar a migração**

- **`permissao_registro`:** implementa exatamente a regra comentada no teste 1.
  - Pedido "com pedido" = pedido `aberto`, deste carro, com `driver_id = auth.uid()`.
  - Motorista sem `tem_vinculo_ativo` → `'negado'`.
- **`registrar_servico`, validações na ordem:**
  1. `negado` → `SEM_PERMISSAO`
  2. `p_request_id` informado e inválido → `PEDIDO_INVALIDO`
  3. itens vazios → `ITENS_OBRIGATORIOS`
  4. item de outro carro → `ITEM_INVALIDO`
  5. `p_data > hoje_brt()` → `DATA_FUTURA`
  6. motorista sem `p_nota_foto_path` → `FOTO_NOTA_OBRIGATORIA` ("Tire uma foto da nota ou do serviço feito.")
- **`registrar_servico`, efeitos depois das validações:**
  - Se `p_km > km_atual`, chama `registrar_km(p_vehicle_id, p_km, 'manutencao', p_foto_painel_path)`.
  - Insere o registro com o status de `permissao_registro`.
  - Se o status for `aprovado`, aplica (`recalcular_ultima_troca` em cada item e conclui o pedido, se houver).
  - Notifica o dono quando o autor não é ele.
- **`recalcular_ultima_troca` (nova versão):** pega o serviço `aprovado` mais recente com o item (`order by data desc, km desc`). Se existir, `ultimo_km/ultima_data` = `km/data` dele; senão, `km_inicial/data_inicial`.
- **`revisar_servico`:**
  - Só o dono.
  - Transições permitidas: `pendente→aprovado`, `pendente→recusado`, `aprovado→contestado`. Qualquer outra → `TRANSICAO_INVALIDA`.
  - Preenche `revisado_por`, `revisado_em` e `motivo`.
  - Ao aprovar ou contestar, recalcula os itens do serviço. Ao aprovar com pedido, conclui o pedido.
- **Pedido x vínculo:** trigger `after update of status on assignments` → quando muda para `encerrado`, cancela os pedidos `aberto` daquele motorista e carro e envia `pedido_cancelado` ao dono ("O pedido de manutenção do carro {placa} foi cancelado porque o motorista devolveu o carro.").
- **`criar_pedido`:** o motorista é o do vínculo `ativo` do carro; os itens precisam pertencer ao carro.
- **RLS:**
  - `maintenance_records` e `maintenance_record_items`: select para o dono, o autor ou quem tem `tem_vinculo_ativo`.
  - `maintenance_requests`: select para o dono ou `driver_id = auth.uid()`.
  - Nenhum insert direto.

- [ ] **Step 4: Aplicar e testar** — `npm run db:reset && npm run db:test` → PASS.

- [ ] **Step 5: Commit** (`feat(db): pedidos, registro de serviços e permissões`)

---

### Task 7: Ocorrências

**Files:**
- Create: `supabase/migrations/20261006000600_ocorrencias.sql`
- Test: `supabase/tests/database/060-ocorrencias.test.sql`

**Interfaces:**
- Produces:
  - **Enums:**
    - `tipo_ocorrencia ('mecanico','acidente_leve','acidente_grave','outro')`
    - `status_ocorrencia ('aberta','resolvida')`
  - **Tabelas:**
    - `incidents(id uuid pk, vehicle_id, driver_id, tipo, descricao text not null, status default 'aberta', criada_em, resolvida_em)`
    - `incident_photos(id uuid pk, incident_id → incidents on delete cascade, path text not null, capturado_em timestamptz not null)`
  - **RPCs:**
    - `public.relatar_ocorrencia(p_vehicle_id uuid, p_tipo public.tipo_ocorrencia, p_descricao text) returns public.incidents`
    - `public.resolver_ocorrencia(p_incident_id uuid) returns public.incidents`
  - **Notificação:** `ocorrencia` (para o dono).

- [ ] **Step 1: Escrever o teste `060-ocorrencias.test.sql`**

```sql
-- 1  motorista com vínculo relata 'mecanico' → 'aberta'; dono recebe 'ocorrencia' com prioridade 'normal'
-- 2  'acidente_grave' → notificação com prioridade 'alta'
-- 3  motorista sem vínculo no carro → 'SEM_ACESSO'; descrição vazia → 'DESCRICAO_OBRIGATORIA'
-- 4  motorista insere incident_photos na própria ocorrência → ok; na ocorrência de outro → '42501'
-- 5  dono resolver_ocorrencia → 'resolvida' e resolvida_em preenchido; motorista chamando → 'SEM_ACESSO'
-- 6  RLS: dono vê todas da frota; motorista vê só as que ele relatou
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**
  - Título da notificação: "Ocorrência: {placa}". Corpo: "{rótulo do tipo} — {primeiros 80 caracteres da descrição}".
  - Rótulos: Barulho/mecânico, Acidente leve, Acidente grave, Outro.

- [ ] **Step 4: Aplicar e testar** → PASS.

- [ ] **Step 5: Commit** (`feat(db): ocorrências`)

---

### Task 8: Previsão de manutenção e status

**Files:**
- Create: `supabase/migrations/20261006000700_previsao.sql`
- Test: `supabase/tests/database/070-previsao.test.sql`

**Interfaces:**
- Consumes: `vehicle_items`, `odometer_readings`, os limiares de `fleets`.
- Produces:
  - **Internas** (sem checagem de acesso; revogadas do `authenticated`):
    - `public.media_km_dia_interna(p_vehicle_id uuid, p_hoje date) returns table(media numeric, estimada boolean)`
    - `public.previsao_itens_interna(p_vehicle_id uuid, p_hoje date) returns table(vehicle_item_id uuid, nome text, proximo_km int, km_restante int, data_prevista date, status public.status_item, custo_estimado numeric)`
    - `public.status_carro_interna(p_vehicle_id uuid, p_hoje date) returns table(status public.status_item, proxima_data date, proximo_item text, media numeric, estimada boolean)`
  - **Públicas** (checam dono ou `tem_vinculo_ativo` → `SEM_ACESSO`, e delegam às internas):
    - `public.previsao_itens(p_vehicle_id uuid, p_hoje date default public.hoje_brt())`
    - `public.status_carro(p_vehicle_id uuid, p_hoje date default public.hoje_brt())`
    - `public.resumo_frota(p_fleet_id uuid, p_hoje date default public.hoje_brt()) returns table(vehicle_id uuid, placa text, marca text, modelo text, status public.status_item, proxima_data date, proximo_item text, estimada boolean, motorista_nome text)`, somente para o dono

- [ ] **Step 1: Escrever o teste `070-previsao.test.sql`**

Todos os casos usam `p_hoje = '2026-10-06'`. Os itens são do carro1 (`km_dia_estimado` 300), e as leituras são inseridas como postgres.

```sql
-- 1  leituras 10000 em 2026-09-26 e 13000 em 2026-10-06 → media 300, estimada false
-- 2  duas leituras com 2 dias de distância → media = km_dia_estimado (300), estimada true
-- 3  leitura de 2026-08-01 é ignorada (fora dos 30 dias)
-- 4  óleo 10000 km/6 m, ultimo_km 10000, ultima_data 2026-09-01, km_atual 13000, media 300:
--      proximo_km 20000, km_restante 7000, data_prevista 2026-10-29 (= 06/10 + floor(7000/300)=23), status 'em_dia'
-- 5  km_restante 800 → 'proximo';  250 → 'urgente';  0 → 'vencido'
-- 6  km folgado mas ultima_data 2026-03-01 (6 meses → 2026-09-01) → 'vencido'
-- 7  km_restante 5000 e data_prevista em 2026-10-10 (≤ 7 dias) → 'proximo'
-- 8  só ultima_data conhecida → proximo_km/km_restante null; status pela data
-- 9  sem histórico → 'sem_historico', data_prevista null
-- 10 média 0 (duas leituras 13000 com 10 dias de distância) → sem erro; data_prevista = data por tempo   (Review Focus 1)
-- 11 status_carro com itens {em_dia, sem_historico, proximo} → 'sem_historico'; {urgente, sem_historico} → 'urgente'
-- 12 fleets.limiar_laranja_km = 500 → km_restante 450 → 'urgente'
-- 13 item ativo=false não aparece em previsao_itens
-- 14 motorista sem vínculo: previsao_itens(carro1) → 'SEM_ACESSO'; dono: resumo_frota traz carro1 com o nome do motorista atual
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

- **Média:** usa as leituras do carro com `capturado_em::date` entre `p_hoje - 30` e `p_hoje`. Considera a primeira e a última por `capturado_em`, com `dias` = diferença fracionária.
  - Se houver menos de 2 leituras, `dias < 3` ou média negativa → usa `km_dia_estimado` com `estimada = true`.
- **Previsão por item:**
  - `data_por_km = p_hoje + floor(km_restante / media)::int`, somente quando `intervalo_km` e `ultimo_km` existem e `media > 0`.
  - `data_por_tempo = (ultima_data + make_interval(months => intervalo_meses))::date`.
  - `data_prevista = least(...)`, que ignora nulos.
- **Status:** segue a ordem da spec §6.3; uma condição sobre um valor nulo é ignorada.
- **Status do carro:** severidade `vencido 5 > urgente 4 > sem_historico 3 > proximo 2 > em_dia 1`. `proxima_data` e `proximo_item` vêm do item com a menor `data_prevista` não nula.

- [ ] **Step 4: Aplicar e testar** → PASS.

- [ ] **Step 5: Commit** (`feat(db): previsão de manutenção e status`)

---

### Task 9: Projeção de gastos e gastos realizados

**Files:**
- Create: `supabase/migrations/20261006000800_gastos.sql`
- Test: `supabase/tests/database/080-gastos.test.sql`

**Interfaces:**
- Consumes: `previsao_itens_interna`, `media_km_dia_interna` (Task 8).
- Produces (somente para o dono; outros → `SEM_ACESSO`; `p_dias` fora de {30, 60, 90} → `PERIODO_INVALIDO`):
  - `public.projecao_gastos(p_fleet_id uuid, p_dias int, p_hoje date default public.hoje_brt()) returns table(vehicle_id uuid, placa text, vehicle_item_id uuid, item_nome text, data date, valor numeric)`. Itens sem histórico vêm **uma vez** com `data` null (linha "revisão recomendada").
  - `public.gastos_realizados(p_fleet_id uuid, p_dias int, p_hoje date default public.hoje_brt()) returns table(record_id uuid, vehicle_id uuid, placa text, data date, valor_total numeric, itens text[])`. Inclui os serviços `aprovado` com `data` em `(p_hoje - p_dias, p_hoje]`.
- A agregação por semana, mês, carro e item fica no app (Plano 2).

- [ ] **Step 1: Escrever o teste `080-gastos.test.sql`**

Usa `p_hoje = '2026-10-06'`, carro com média 200 e óleo 10000 km/6 m com `data_prevista` em 2026-10-16 e custo 180.

```sql
-- 1  30 dias → 1 linha do óleo em 2026-10-16, valor 180
-- 2  90 dias → 2 linhas do óleo: 2026-10-16 e 2026-12-05 (10000/200 = 50 dias depois)
-- 3  item vencido (data_prevista 2026-09-20) → primeira ocorrência em 2026-10-06
-- 4  item sem histórico → exatamente 1 linha com data null
-- 5  carro com ativo=false não entra
-- 6  p_dias 45 → 'PERIODO_INVALIDO';  motorista chamando → 'SEM_ACESSO'
-- 7  gastos_realizados(30): inclui aprovado de 2026-09-20; exclui pendente, recusado, contestado e aprovado de 2026-08-01
-- 8  itens de gastos_realizados = nomes dos itens + nome_outro
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `projecao_gastos`.** O algoritmo, por item ativo com histórico de carro ativo da frota:

```
d := greatest(data_prevista, p_hoje)            -- data_prevista null (sem critério) → pular
ciclo_km := case when intervalo_km is not null and media > 0
                 then greatest(1, floor(intervalo_km / media))::int end
loop
  exit when d is null or d > p_hoje + p_dias
  emitir (d, custo_estimado)
  d := least( d + ciclo_km,                                         -- null se ciclo_km null
              (d + make_interval(months => intervalo_meses))::date ) -- null se intervalo_meses null
end loop
```

- [ ] **Step 4: Aplicar e testar** → PASS.

- [ ] **Step 5: Commit** (`feat(db): projeção de gastos e realizado`)

---

### Task 10: Rotina diária (status, avisos, lembretes) e agendamento

**Files:**
- Create: `supabase/migrations/20261006000900_rotina_diaria.sql`
- Test: `supabase/tests/database/090-rotina-diaria.test.sql`

**Interfaces:**
- Consumes: `previsao_itens_interna` (Task 8), `notificar`, `maintenance_requests`.
- Produces:
  - `public.rotina_diaria(p_hoje date default public.hoje_brt()) returns void` (interna)
  - Job pg_cron `rotina-diaria`, `'0 11 * * *'` (08:00 em Brasília)
  - **Tipos de notificação:** `status_item`, `lembrete_km` e `pedido_prazo`

- [ ] **Step 1: Escrever o teste `090-rotina-diaria.test.sql`**

```sql
-- 1  item muda de em_dia para proximo → status_atual atualizado; dono e motorista do vínculo recebem 1 'status_item' cada
-- 2  rodar rotina_diaria de novo no mesmo dia → nenhuma notificação nova
-- 3  modo proprietario_leva: corpo do dono = 'Óleo do motor está próximo do vencimento. Agende a manutenção.'
--    corpo do motorista = 'Óleo do motor do carro ABC1D23 está próximo do vencimento. O proprietário vai combinar com você.'
-- 4  modo motoristas_levam: dono = 'Óleo do motor do carro ABC1D23 está próximo do vencimento. O motorista foi avisado.'
--    motorista = 'Óleo do motor está próximo do vencimento. Leve o carro ABC1D23 à oficina até 29/10.'
-- 5  mudança para 'vencido' → prioridade 'alta'; mudança para 'em_dia' ou 'sem_historico' → nenhum aviso, só atualiza status_atual
-- 6  vínculo ativo com última leitura há 8 dias → motorista recebe 'lembrete_km' ('Atualize o km do carro ABC1D23.');
--    rodar no dia seguinte → não repete (já houve lembrete nos últimos 7 dias)
-- 7  pedido aberto com prazo 2026-10-05 e p_hoje 2026-10-06 → dono e motorista recebem 'pedido_prazo', prazo_notificado = true; não repete
-- 8  authenticated: throws_ok(select rotina_diaria(), '42501')
-- 9  existe job em cron.job com jobname 'rotina-diaria' e schedule '0 11 * * *'
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

- **Títulos:**
  - `status_item`: "Manutenção: {placa}"
  - `lembrete_km`: "Atualize o km"
  - `pedido_prazo`: "Pedido de manutenção atrasado"
- **Rótulos de status:**
  - `proximo` → "próximo do vencimento"
  - `urgente` → "urgente"
  - `vencido` → "vencido"
- **Datas:** "até {dd/mm}" usa a `data_prevista` do item. Se ela for null, a frase vira "o quanto antes".
- **Lembrete de km:** usa `p_hoje` como referência (`max(capturado_em)::date <= p_hoje - 7`), e não `now()`.
- **Agendamento:** `create extension if not exists pg_cron;` + `select cron.schedule('rotina-diaria', '0 11 * * *', $$select public.rotina_diaria()$$);`

- [ ] **Step 4: Aplicar e testar** → PASS.

- [ ] **Step 5: Commit** (`feat(db): rotina diária de status e lembretes`)

---

### Task 11: Envio de push (Edge Function `enviar-push`)

**Files:**
- Create: `supabase/functions/_shared/expo-push.ts`, `supabase/functions/enviar-push/index.ts`, `supabase/migrations/20261006001000_push.sql`
- Test: `tests/functions/expo-push.test.ts`
- Modify: `README.md` (seção de push)

**Interfaces:**
- Produces (em `expo-push.ts`, sem imports de Deno):
  - `export type NotificacaoPendente = { id: string; titulo: string; corpo: string; prioridade: 'normal' | 'alta'; expo_push_token: string | null; ref_tabela: string | null; ref_id: string | null }`
  - `export type MensagemExpo = { to: string; title: string; body: string; priority: 'default' | 'high'; sound: 'default'; data: { notificacaoId: string; ref_tabela: string | null; ref_id: string | null } }`
  - `export function montarMensagensExpo(n: NotificacaoPendente[]): { mensagens: MensagemExpo[]; semToken: string[] }`
  - `export function dividirEmLotes<T>(itens: T[], tamanho?: number): T[][]` (padrão 100)

- [ ] **Step 1: Escrever o teste `expo-push.test.ts`**

```ts
// 'alta' → priority 'high'; 'normal' → 'default'; title/body/data copiados
// token null ou que não começa com 'ExponentPushToken[' → id vai para semToken e não gera mensagem
// dividirEmLotes(250 itens) → tamanhos [100, 100, 50]; dividirEmLotes([]) → []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `expo-push.ts`.**

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Implementar `enviar-push/index.ts`**

- `Deno.serve` + `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
- Busca até 500 notificações com `push_enviado_em is null` e `criada_em > now() - 1 dia`, junto com `profiles.expo_push_token`.
- Envia cada lote via `POST https://exp.host/--/api/v2/push/send` (JSON array).
- Marca `push_enviado_em = now()` em todas as processadas, inclusive as `semToken`.
- Responde `{ enviadas, semToken }`. Se a Expo falhar, não marca o lote e responde 502.

- [ ] **Step 6: Migração `20261006001000_push.sql`**

`create extension if not exists pg_net;` + `cron.schedule('enviar-push', '* * * * *', ...)` com `net.http_post`:
- URL: `(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-push'`
- Header `Authorization: Bearer` + o segredo `service_role_key`
- O comando do job não faz nada se os segredos não existirem (`where exists (...)`).

- [ ] **Step 7: Verificação manual**

Run: `npm run db:reset`, depois `npx supabase functions serve enviar-push` e, em outro terminal, `curl -X POST http://127.0.0.1:54321/functions/v1/enviar-push -H "Authorization: Bearer <service_role_key do db:start>"`
Expected: `{"enviadas":0,"semToken":0}` (o banco pode ter notificações do seed sem token; nesse caso `semToken > 0` e `enviadas` 0).

- [ ] **Step 8: README.** Explicar como criar os segredos no Vault:
  - **local:** `project_url = http://host.docker.internal:54321` e a `service_role_key` mostrada pelo `db:start`
  - **produção:** URL do projeto e chave de serviço

- [ ] **Step 9: Commit** (`feat: envio de notificações push pela Expo`)

---

### Task 12: Consulta FIPE com cache (Edge Function `fipe`)

**Files:**
- Create: `supabase/migrations/20261006001100_fipe_cache.sql`, `supabase/functions/_shared/fipe.ts`, `supabase/functions/fipe/index.ts`
- Test: `tests/functions/fipe.test.ts`

**Interfaces:**
- Produces:
  - **Tabela:** `fipe_cache(chave text pk, dados jsonb not null, atualizado_em timestamptz not null default now())`, com RLS ligado e sem políticas (só a service role acessa).
  - **Em `fipe.ts`:**
    - `export type ConsultaFipe = { tipo: 'marcas' } | { tipo: 'modelos'; marca: string } | { tipo: 'anos'; marca: string; modelo: string }`
    - `export type OpcaoFipe = { codigo: string; nome: string }`
    - `export function lerConsulta(p: URLSearchParams): ConsultaFipe | null`
    - `export function urlFipe(c: ConsultaFipe): string`
    - `export function chaveCache(c: ConsultaFipe): string`
    - `export function cacheValido(atualizadoEm: Date, agora: Date): boolean` (menos de 30 dias)
    - `export type DepsFipe = { lerCache(chave: string): Promise<{ dados: OpcaoFipe[]; atualizadoEm: Date } | null>; salvarCache(chave: string, dados: OpcaoFipe[]): Promise<void>; buscar(url: string): Promise<unknown> }`
    - `export async function buscarComCache(c: ConsultaFipe, deps: DepsFipe, agora: Date): Promise<{ status: 200 | 503; corpo: OpcaoFipe[] | { erro: 'FIPE_INDISPONIVEL' } }>`
  - **Endpoint (para o Plano 2):** `GET /functions/v1/fipe?tipo=marcas | tipo=modelos&marca=21 | tipo=anos&marca=21&modelo=4828`, com o JWT do usuário logado. Responde `OpcaoFipe[]`, ou 503 `{erro:'FIPE_INDISPONIVEL'}`.

- [ ] **Step 1: Escrever o teste `fipe.test.ts`**

```ts
// lerConsulta: 'tipo=modelos' sem marca → null; 'tipo=xyz' → null; 'tipo=anos&marca=21&modelo=4828' → objeto correto
// urlFipe: base 'https://parallelum.com.br/fipe/api/v1/carros' +
//   marcas → '/marcas'; modelos → '/marcas/21/modelos'; anos → '/marcas/21/modelos/4828/anos'
// chaveCache: 'marcas' | 'modelos:21' | 'anos:21:4828'
// cache de 10 dias → não chama buscar, retorna dados do cache (status 200)
// cache de 31 dias → chama buscar, salva e retorna dados novos
// resposta de modelos vem como { modelos: [{codigo: 4828, nome: 'Onix'}], anos: [...] } → retorna só modelos, codigo como string
// buscar lança erro + cache vencido existe → retorna o cache vencido (200)
// buscar lança erro + sem cache → { status: 503, corpo: { erro: 'FIPE_INDISPONIVEL' } }
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementar `fipe.ts`.** A API devolve `codigo` numérico em marcas e modelos e string em anos; normalizar tudo para string.

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Implementar `fipe/index.ts` e a migração**

- `fipe/index.ts` liga `DepsFipe` ao cliente com service role (`fipe_cache`) e ao `fetch`.
- Consulta inválida → 400 `{erro:'CONSULTA_INVALIDA'}`.
- Migração: cria `fipe_cache`.

- [ ] **Step 6: Verificação manual**

Run: `npx supabase functions serve fipe` e `curl "http://127.0.0.1:54321/functions/v1/fipe?tipo=marcas" -H "Authorization: Bearer <anon key>"`
Expected: lista JSON contendo `{"codigo":"23","nome":"GM - Chevrolet"}` (ou similar). Uma segunda chamada vem do cache.

- [ ] **Step 7: Commit** (`feat: consulta FIPE com cache`)

---

### Task 13: Dados de exemplo (seed) e fechamento

**Files:**
- Create: `supabase/seed.sql`, `supabase/tests/database/100-seed.test.sql`
- Modify: `README.md` (contas de teste)

**Interfaces:**
- Produces (para os planos 2 e 3), com senha `senha123` para todos:
  - **Proprietário:** `dono@frotos.dev` (Carlos), dono da frota "Frota Piloto" com código `FRT-TEST`.
  - **Motoristas:**
    - `ana@frotos.dev`: ativo, `confiavel`, com o Onix
    - `bruno@frotos.dev`: ativo, `com_aprovacao`, com o HB20
    - `caio@frotos.dev`: pendente
  - **Carros:**
    - Chevrolet Onix 2022 (prata)
    - Hyundai HB20 2021 (branco)
    - Fiat Argo 2023 (vermelho)
    - Renault Kwid 2022 (branco)
    - Fiat Mobi 2021 (preto)

- [ ] **Step 1: Escrever o teste `100-seed.test.sql`**

```sql
-- 1  frota de dono@frotos.dev tem 5 veículos e código 'FRT-TEST'
-- 2  membros: ana ativo/confiavel, bruno ativo/com_aprovacao, caio pendente
-- 3  status_carro_interna dos 5 carros (p_hoje = hoje_brt()) cobre pelo menos 'em_dia', 'proximo', 'vencido' e 'sem_historico'
-- 4  existe 1 serviço pendente do Bruno, 1 pedido aberto para o Bruno e 1 ocorrência aberta
-- 5  login: auth.users de ana tem encrypted_password = crypt('senha123', encrypted_password)
```

- [ ] **Step 2: Escrever `seed.sql`**

- **Usuários:**
  - `auth.users` com `encrypted_password = crypt('senha123', gen_salt('bf'))`, `email_confirmed_at = now()` e `raw_user_meta_data` com nome e papel
  - a linha correspondente em `auth.identities` (provider `email`), necessária para o login por e-mail
- **Dados de negócio:** inseridos direto como postgres, mantendo as invariantes:
  - `em_uso` = true só no Onix e no HB20, com vínculos `ativo` e as 4 fotos (paths fictícios)
  - `km_inicial`, `data_inicial`, `ultimo_km` e `ultima_data` coerentes
- **Leituras de km:** dos últimos 30 dias, relativas a `hoje_brt()`, para dar médias de cerca de 300 km/dia.
- **Status:** chamar `rotina_diaria()` no fim, para preencher `status_atual`.

- [ ] **Step 3: Aplicar e testar**

Run: `npm run db:reset && npm run db:test && npm test`
Expected: tudo PASS.

- [ ] **Step 4: README.** Adicionar a seção "Contas de teste" com os e-mails, a senha e o código da frota.

- [ ] **Step 5: Commit** (`feat(db): dados de exemplo da frota piloto`)
