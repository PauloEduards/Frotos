# Projeto Frotos — Plano 2 de 3: App (base + proprietário)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o app Expo (Android + iPhone) com login e cadastro, e todas as telas do proprietário: frota, carros, plano de manutenção, painel, ações no carro, motoristas, pendências, gastos com gráficos e central de avisos. O app usa o backend do Plano 1.

**Architecture:**
- **Projeto:** app Expo (SDK 57) com Expo Router e TypeScript na pasta `mobile/`.
- **Camada de dados:** funções em `mobile/src/api/` chamam o Supabase (tabelas via RLS e RPCs). Todas lançam `ErroApp` com mensagem pronta em português.
- **Telas:** usam React Query sobre essas funções.
- **Lógica pura** (formatação, agregação de gastos, mapeamento de erros) fica em `mobile/src/lib/` e `mobile/src/features/*/`, com testes unitários.
- **Testes de tela:** usam `@testing-library/react-native` com `src/api` mockado.

**Tech Stack:**
- Expo SDK 57, Expo Router e React Native (versões do template)
- `@supabase/supabase-js@2` com `@react-native-async-storage/async-storage`
- `@tanstack/react-query@5`
- `jest-expo` e `@testing-library/react-native`
- Gráfico de barras feito com `View` (sem biblioteca)

**Spec:** `docs/superpowers/specs/2026-10-06-frota-mvp-design.md` (§4.1, §4.4, §5, §6.4, §7)

**Backend:**
- Migrations em `supabase/migrations/` e README da raiz (Plano 1, branch `feat/backend-mvp`).
- O implementador deve ler as assinaturas reais das RPCs nas migrations, incluindo `20261006001200_endurecimento.sql`, que substitui várias delas.

## Global Constraints

- **Plataformas:** o app precisa rodar em Android e iOS. Só usar bibliotecas do SDK do Expo ou JS puro, sem nada exclusivo de Android. Instalar dependências nativas com `npx expo install`.
- **Idioma:** todo texto visível em português do Brasil.
- **Erros:** toda mensagem de erro mostrada ao usuário vem de `mensagemErro(e)`. Erro de negócio (P0001) mostra o DETAIL do backend.
- **Perfis:** **nunca** usar `select('*')` em `profiles`. Listar colunas (`id, nome, telefone, papel, criado_em`), porque `expo_push_token` não é legível (42501).
- **Status:** rótulos e cores únicos em `src/lib/status.ts`:

  | status | rótulo | cor |
  |---|---|---|
  | `em_dia` | Em dia | `#2E7D32` |
  | `proximo` | Próximo | `#F9A825` |
  | `urgente` | Urgente | `#EF6C00` |
  | `vencido` | Vencido | `#C62828` |
  | `sem_historico` | Sem histórico | `#9E9E9E` |

- **Formatos:**
  - km: `45.200 km`
  - dinheiro: `R$ 1.234,50`
  - data: `dd/mm/aaaa`
  - Implementar à mão, sem `Intl`.
- **Pedidos:** ao registrar serviço vindo de um pedido, o app **sempre passa `p_request_id`** explicitamente (pendência do Plano 1).
- **Configuração:** fica em `mobile/.env` (não versionado), com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`. O `mobile/.env.example` é versionado.
- **Testes:** cada task termina com `cd mobile && npx tsc --noEmit && npx jest` verdes.
- **Contas de teste** (seed do Plano 1), todas com a senha `senha123`:
  - `dono@frotos.dev`
  - `ana@frotos.dev`
  - `bruno@frotos.dev`

## Review Focus

1. **Sessão expirada ou rede caída durante uma ação:** a tela mostra a mensagem de `mensagemErro`, não trava e não perde o formulário. Teste em `erros.test.ts` (Task 1) e nos testes de tela das Tasks 4 e 7.
2. **FIPE fora do ar (503):** o cadastro do carro cai para campos de texto, sem erro bloqueante. Teste na Task 4.
3. **Frota vazia** (sem carros, sem motoristas, sem pendências, sem gastos): toda lista mostra um estado vazio com texto, não uma tela em branco. Testes nas Tasks 6, 8, 9 e 10.
4. **Proprietário ainda sem frota:** depois do login, ele cai na criação de frota, não num painel quebrado. Teste na Task 3.
5. **Motorista logado:** vai para a tela provisória "Em breve" (o Plano 3 a substitui), nunca para telas do dono. Teste na Task 2.

---

## Estrutura de arquivos

```
mobile/
  app.json, package.json, tsconfig.json, jest.config.js, .env.example, README.md
  app/
    _layout.tsx                      providers (React Query, Sessão)
    index.tsx                        redireciona por sessão/papel
    (auth)/_layout.tsx, entrar.tsx, cadastro.tsx
    (motorista)/index.tsx            placeholder "Em breve" (Plano 3)
    (dono)/_layout.tsx               Stack do dono
    (dono)/(abas)/_layout.tsx        Tabs: Frota, Pendências, Gastos, Motoristas, Avisos
    (dono)/(abas)/index.tsx          painel (ou criar frota)
    (dono)/(abas)/pendencias.tsx, gastos.tsx, motoristas.tsx, avisos.tsx
    (dono)/configuracoes.tsx
    (dono)/carros/novo.tsx
    (dono)/carros/[id]/index.tsx     detalhe
    (dono)/carros/[id]/itens.tsx     plano de manutenção
    (dono)/carros/[id]/servico.tsx   registrar serviço
    (dono)/carros/[id]/pedido.tsx    pedido de manutenção
  src/
    lib/cliente.ts, erros.ts, formatos.ts, status.ts, tema.ts, database.types.ts (gerado)
    sessao/SessaoProvider.tsx, useSessao.ts
    api/auth.ts, frota.ts, veiculos.ts, fipe.ts, manutencao.ts, pendencias.ts, gastos.ts, avisos.ts, fotos.ts
    componentes/  Botao, Campo, Seletor, Lista vazia, BadgeStatus, Carregando, Erro, GraficoBarras, FotoRemota
    features/gastos/agregar.ts
  (testes ao lado: *.test.ts / *.test.tsx)
```

---

### Task 1: Projeto Expo, cliente Supabase, utilitários e testes

**Files:**
- Create: `mobile/` (via `create-expo-app`), `mobile/jest.config.js`, `mobile/.env.example`, `mobile/src/lib/{cliente,erros,formatos,status,tema}.ts`, `mobile/src/lib/database.types.ts`
- Test: `mobile/src/lib/erros.test.ts`, `mobile/src/lib/formatos.test.ts`, `mobile/src/lib/status.test.ts`
- Modify: `.gitignore` da raiz (`mobile/.env`, `mobile/node_modules/`, `mobile/.expo/`), `package.json` da raiz (script `db:types`)

**Interfaces:**
- Produces:
  - **`cliente.ts`:** `export const supabase: SupabaseClient<Database>`, com `auth.storage = AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.
  - **`erros.ts`:**
    - `export class ErroApp extends Error { codigo?: string }`
    - `export function mensagemErro(e: unknown): string`
    - `export function comoErroApp(e: unknown): ErroApp`, usado pelas funções de `src/api` no `throw`
  - **`formatos.ts`:**
    - `formatarKm(n: number | null): string`
    - `formatarReais(n: number | null): string`
    - `formatarData(iso: string | null): string`
    - `formatarDiaMes(iso: string): string` (`dd/mm`)
    - `normalizarPlaca(s: string): string`
  - **`status.ts`:**
    - `export type StatusItem = 'sem_historico' | 'vencido' | 'urgente' | 'proximo' | 'em_dia'`
    - `rotuloStatus(s)`
    - `corStatus(s)`
  - **`tema.ts`:** `cores` (primária `#1565C0`, fundo `#F5F5F5`, texto `#212121`, texto secundário `#616161`, borda `#E0E0E0`) e `espaco` (4, 8, 12, 16, 24).
  - **Script na raiz:** `npm run db:types` = `supabase gen types typescript --local > mobile/src/lib/database.types.ts`.

- [ ] **Step 1: Criar o projeto**

Na raiz do repositório, rodar `npx create-expo-app@latest mobile --template default`. Depois remover os exemplos do template (`app/(tabs)`, `components/` e `constants/` de exemplo), deixando `app/_layout.tsx` mínimo.

Em `mobile/`, instalar:
- `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
- `npm i @tanstack/react-query`
- `npx expo install jest-expo jest @types/jest -- --save-dev`
- `npm i -D @testing-library/react-native`

`jest.config.js`: `preset: 'jest-expo'`, `setupFiles` com o mock oficial do AsyncStorage (`@react-native-async-storage/async-storage/jest/async-storage-mock`). Em `package.json`, o script `test` = `jest`.

`app.json`:
- `name: "Frotos"` e `slug: "frotos"`
- `android.package: "dev.frotos.app"` e `ios.bundleIdentifier: "dev.frotos.app"`
- `ios.infoPlist`: `NSCameraUsageDescription` = "O Frotos usa a câmera para registrar fotos do carro e do painel." e `NSPhotoLibraryUsageDescription` = "O Frotos usa suas fotos para anexar notas de serviço."

- [ ] **Step 2: Escrever os testes**

`formatos.test.ts`:
```ts
formatarKm(45200) === '45.200 km'; formatarKm(0) === '0 km'; formatarKm(null) === '—'
formatarReais(1234.5) === 'R$ 1.234,50'; formatarReais(0) === 'R$ 0,00'; formatarReais(1000000) === 'R$ 1.000.000,00'
formatarData('2026-10-30') === '30/10/2026'; formatarData(null) === '—'
formatarDiaMes('2026-10-30') === '30/10'
normalizarPlaca(' abc-1d23 ') === 'ABC1D23'
```

`status.test.ts`: os rótulos e cores de todos os 5 status, exatamente como na tabela dos Global Constraints.

`erros.test.ts`:
```ts
mensagemErro({ code: 'P0001', message: 'KM_MENOR', details: 'O km informado (45.200) é menor que o último registro (45.870).' })
  === 'O km informado (45.200) é menor que o último registro (45.870).'
mensagemErro({ code: 'P0001', message: 'X', details: null }) === 'Algo deu errado. Tente de novo.'
mensagemErro({ code: '42501', message: 'permission denied' }) === 'Você não tem permissão para isso.'
mensagemErro(new TypeError('Network request failed')) === 'Sem conexão com a internet. Tente de novo.'
mensagemErro({ name: 'AuthApiError', message: 'Invalid login credentials' }) === 'E-mail ou senha incorretos.'
mensagemErro({ name: 'AuthApiError', message: 'User already registered' }) === 'Este e-mail já está cadastrado.'
mensagemErro({ message: 'JWT expired' }) === 'Sua sessão expirou. Entre de novo.'
mensagemErro('qualquer coisa') === 'Algo deu errado. Tente de novo.'
comoErroApp({ code: 'P0001', message: 'KM_MENOR', details: 'x' }).codigo === 'KM_MENOR'
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd mobile && npx jest`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar**

- Implementar `erros.ts`, `formatos.ts`, `status.ts`, `tema.ts` e `cliente.ts`.
- `cliente.ts` importa `react-native-url-polyfill/auto` e lê `process.env.EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Se faltarem, lança um erro claro.
- Gerar os tipos com `npm run db:types` na raiz, com o Supabase local rodando.
- Criar `.env.example` com:
  - `EXPO_PUBLIC_SUPABASE_URL=http://192.168.0.10:54321`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=` + comentário: "use o IP do PC na rede; no emulador Android use http://10.0.2.2:54321"

- [ ] **Step 5: Verificar**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc sem erros; jest PASS.

- [ ] **Step 6: Commit** (`feat(app): projeto Expo, cliente Supabase e utilitários`)

---

### Task 2: Sessão, login, cadastro e redirecionamento por papel

**Files:**
- Create:
  - `mobile/src/api/auth.ts`
  - `mobile/src/sessao/SessaoProvider.tsx`, `mobile/src/sessao/useSessao.ts`
  - `mobile/src/componentes/{Botao,Campo,Carregando,MensagemErro}.tsx`
  - `mobile/app/_layout.tsx`, `mobile/app/index.tsx`
  - `mobile/app/(auth)/{_layout,entrar,cadastro}.tsx`
  - `mobile/app/(motorista)/index.tsx`
  - `mobile/app/(dono)/_layout.tsx`, `mobile/app/(dono)/(abas)/_layout.tsx`, `mobile/app/(dono)/(abas)/index.tsx` (placeholder; a Task 3 o completa)
- Test: `mobile/src/sessao/SessaoProvider.test.tsx`, `mobile/app/(auth)/entrar.test.tsx`, `mobile/app/(auth)/cadastro.test.tsx`

**Interfaces:**
- Produces:
  - **`api/auth.ts`:**
    - `entrar(email: string, senha: string): Promise<void>`
    - `cadastrar(d: { nome: string; telefone: string; email: string; senha: string; papel: 'proprietario' | 'motorista' }): Promise<void>`, via `signUp` com `options.data = { nome, telefone, papel }`
    - `sair(): Promise<void>`
    - `buscarPerfil(id: string): Promise<Perfil>`, com `select('id, nome, telefone, papel, criado_em')`
    - `export type Perfil = { id: string; nome: string; telefone: string | null; papel: 'proprietario' | 'motorista'; criado_em: string }`
  - **Sessão:** `useSessao(): { carregando: boolean; sessao: Session | null; perfil: Perfil | null; recarregarPerfil(): Promise<void> }`
  - **Rotas:** `app/index.tsx` redireciona:
    - sem sessão → `/(auth)/entrar`
    - proprietário → `/(dono)/(abas)`
    - motorista → `/(motorista)`
  - **Componentes:**
    - `<Botao titulo onPress carregando? variante?: 'primario'|'secundario'|'perigo' />`
    - `<Campo rotulo valor onChange tipo?: 'texto'|'email'|'senha'|'numero'|'telefone' erro? />`
    - `<MensagemErro texto />`
    - `<Carregando />`

- [ ] **Step 1: Escrever os testes**

`api/auth`, `buscarPerfil` e `supabase.auth` ficam mockados.
```tsx
// SessaoProvider: sem sessão → perfil null; com sessão → chama buscarPerfil(session.user.id) e expõe o perfil;
//   evento SIGNED_OUT do onAuthStateChange → perfil volta a null
// entrar: preenche e-mail/senha, toca "Entrar" → chama entrar('ana@frotos.dev','senha123');
//   entrar rejeita {name:'AuthApiError', message:'Invalid login credentials'} → mostra 'E-mail ou senha incorretos.'
//   e os campos continuam preenchidos
// cadastro: campos Nome, Telefone, E-mail, Senha e a escolha "Sou proprietário" / "Sou motorista";
//   sem escolher papel → mostra 'Escolha se você é proprietário ou motorista.' e não chama cadastrar;
//   senha com menos de 6 caracteres → 'A senha precisa ter pelo menos 6 caracteres.'
//   completo → cadastrar({nome, telefone, email, senha, papel:'motorista'})
// index (redirecionamento): perfil motorista → Redirect para '/(motorista)'          (Review Focus 5)
```

- [ ] **Step 2: Rodar e ver falhar** — `cd mobile && npx jest` → FAIL.

- [ ] **Step 3: Implementar**

- **`_layout.tsx` raiz:** `QueryClientProvider` (com `retry: 1`) por fora de `SessaoProvider`, por fora do `<Stack screenOptions={{ headerShown: false }}>`.
- **Tela "Entrar":** título "Frotos", subtítulo "Controle de manutenção da sua frota" e o link "Criar conta".
- **`(motorista)/index.tsx`:** mostra "Olá, {nome}!" e "O app do motorista chega em breve.", com o botão "Sair".
- **Abas do dono** (`Tabs`):
  - Frota (`index`), Pendências, Gastos, Motoristas, Avisos
  - ícones de `@expo/vector-icons` Ionicons: `car`, `alert-circle`, `stats-chart`, `people`, `notifications`
  - cada aba ainda inexistente vira uma tela simples com o título, completada nas próximas tasks

- [ ] **Step 4: Verificar** — `cd mobile && npx tsc --noEmit && npx jest` → PASS.

- [ ] **Step 5: Commit** (`feat(app): login, cadastro e sessão`)

---

### Task 3: Frota — criar, código de convite, configurações

**Files:**
- Create: `mobile/src/api/frota.ts`, `mobile/app/(dono)/configuracoes.tsx`, `mobile/src/componentes/Seletor.tsx`
- Modify: `mobile/app/(dono)/(abas)/index.tsx`
- Test: `mobile/src/api/frota.test.ts`, `mobile/app/(dono)/(abas)/index.test.tsx`, `mobile/app/(dono)/configuracoes.test.tsx`

**Interfaces:**
- Produces:
  - **Tipo:** `export type Frota = { id: string; nome: string; codigo_convite: string; modo_manutencao: 'proprietario_leva' | 'motoristas_levam'; limite_salto_km_dia: number; limiar_amarelo_km: number; limiar_amarelo_dias: number; limiar_laranja_km: number }`
  - **Funções de `api/frota.ts`:**
    - `minhaFrota(): Promise<Frota | null>`: select em `fleets` onde `owner_id = auth uid`, `maybeSingle`
    - `criarFrota(nome: string): Promise<Frota>`: RPC `criar_frota`
    - `gerarNovoCodigo(fleetId: string): Promise<string>`
    - `atualizarFrota(fleetId: string, campos: Partial<Omit<Frota,'id'|'codigo_convite'>>): Promise<void>`
  - **Componente:** `<Seletor opcoes={{valor, rotulo}[]} valor onChange />`, botões segmentados
  - **React Query:** `['frota']`

- [ ] **Step 1: Escrever os testes**

```tsx
// api/frota.test: criarFrota chama supabase.rpc('criar_frota', {p_nome:'Frota Piloto'}); erro P0001 → lança ErroApp com a mensagem do DETAIL
// painel sem frota (minhaFrota → null) mostra "Crie sua frota", campo "Nome da frota" e botão "Criar frota";
//   criar → chama criarFrota e depois mostra o código                                    (Review Focus 4)
// painel com frota mostra o card "Código da frota: FRT-TEST" com os botões "Compartilhar" e "Gerar novo código";
//   "Gerar novo código" pede confirmação ('Os motoristas que ainda não entraram vão precisar do código novo.')
//   antes de chamar gerarNovoCodigo
// Compartilhar → Share.share com mensagem
//   'Entre na minha frota no app Frotos com o código FRT-TEST.'
// configuracoes: Seletor "Quem leva o carro à oficina" com 'O proprietário leva' / 'Motoristas levam';
//   campos numéricos "Limite de km por dia sem foto do painel" (350), "Amarelo: faltando até (km)" (1000),
//   "Amarelo: faltando até (dias)" (7), "Laranja: faltando menos de (km)" (300); "Salvar" chama atualizarFrota
//   com os números; valor vazio ou negativo → 'Informe um número válido.' e não salva
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**
  - No cabeçalho da aba Frota, um ícone de engrenagem abre `/(dono)/configuracoes`.
  - Depois de salvar, invalidar `['frota']`.

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): frota, código de convite e configurações`)

---

### Task 4: Cadastro de carro com FIPE

**Files:**
- Create: `mobile/src/api/fipe.ts`, `mobile/src/api/veiculos.ts`, `mobile/app/(dono)/carros/novo.tsx`
- Test: `mobile/src/api/fipe.test.ts`, `mobile/app/(dono)/carros/novo.test.tsx`

**Interfaces:**
- Produces:
  - **`api/fipe.ts`:**
    - `export type OpcaoFipe = { codigo: string; nome: string }`
    - `listarMarcas(): Promise<OpcaoFipe[] | null>`
    - `listarModelos(marca: string): Promise<OpcaoFipe[] | null>`
    - `listarAnos(marca: string, modelo: string): Promise<OpcaoFipe[] | null>`
    - Todas usam `supabase.functions.invoke('fipe?tipo=…', { method: 'GET' })` e retornam `null` quando a resposta é 503 ou há falha de rede (fallback manual).
  - **`api/veiculos.ts`:**
    - `export type NovoVeiculo = { placa: string; marca: string; modelo: string; ano_modelo: number; cor: string; fipe_codigo: string | null; km_atual: number; km_dia_estimado: number }`
    - `cadastrarVeiculo(fleetId: string, v: NovoVeiculo): Promise<{ id: string }>`, com insert em `vehicles` e `select('id')`
  - **Cores (constante):** `CORES = ['Branco','Preto','Prata','Cinza','Vermelho','Azul','Outra']`
  - **Ano:** vem do `nome` do ano FIPE (ex.: `"2022 Flex"` → 2022, via `parseInt`).

- [ ] **Step 1: Escrever os testes**

```tsx
// novo: com FIPE ok → escolhe marca "GM - Chevrolet", depois modelo "Onix 1.0", depois ano "2022 Flex";
//   preenche Placa 'abc-1d23', Km atual '45200', Km por dia (padrão preenchido '300'), Cor 'Prata';
//   "Cadastrar carro" → cadastrarVeiculo(frota.id, {placa:'ABC1D23', marca:'GM - Chevrolet', modelo:'Onix 1.0',
//     ano_modelo:2022, cor:'Prata', fipe_codigo:'<codigo do modelo>', km_atual:45200, km_dia_estimado:300})
//   e navega para /carros/{id}/itens
// listarMarcas → null (FIPE fora) → aparece o aviso 'Não foi possível carregar a lista de modelos. Digite os dados do carro.'
//   e campos de texto Marca/Modelo/Ano; cadastro segue com fipe_codigo null                    (Review Focus 2)
// link "Não encontrei meu modelo" também troca para os campos de texto
// validações: placa inválida → 'Placa inválida.'; km vazio → 'Informe o km atual.'; ano fora de 1980..ano atual+1 → 'Ano inválido.'
// cadastrarVeiculo rejeita com erro 23505 → 'Já existe um carro com esta placa na frota.' (o formulário continua preenchido)
```

`mensagemErro` ganha o mapeamento do código `23505` → "Já existe um carro com esta placa na frota." Adicionar o caso em `erros.test.ts`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**
  - O seletor de marca e modelo é uma lista com busca: um `Campo` filtra a `FlatList` por `nome`, sem diferenciar maiúsculas de minúsculas.
  - O botão "Adicionar carro" no painel abre esta tela.

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): cadastro de carro com FIPE`)

---

### Task 5: Plano de manutenção do carro

**Files:**
- Create: `mobile/app/(dono)/carros/[id]/itens.tsx`
- Modify: `mobile/src/api/veiculos.ts`
- Test: `mobile/app/(dono)/carros/[id]/itens.test.tsx`

**Interfaces:**
- Produces (em `api/veiculos.ts`):
  - `export type ItemVeiculo = { id: string; nome: string; intervalo_km: number | null; intervalo_meses: number | null; km_inicial: number | null; data_inicial: string | null; custo_estimado: number; catalog_id: string | null; ativo: boolean }`
  - `listarItens(vehicleId: string): Promise<ItemVeiculo[]>`, ordenado pela `ordem` do catálogo e depois por `nome`
  - `definirHistoricoInicial(itemId: string, km: number | null, data: string | null): Promise<void>`, via RPC `definir_historico_inicial`
  - `atualizarItem(itemId: string, d: { intervalo_km: number | null; intervalo_meses: number | null; custo_estimado: number }, aplicarEmTodos: boolean): Promise<number>`, via RPC `atualizar_item`
  - `adicionarItem(vehicleId: string, d: { nome: string; intervalo_km: number | null; intervalo_meses: number | null; custo_estimado: number }): Promise<void>`
  - `sugestaoCusto(itemId: string): Promise<number | null>`, via RPC `custo_medio_item`

- [ ] **Step 1: Escrever os testes**

```tsx
// lista os itens com "a cada 10.000 km ou 6 meses" e "Custo estimado R$ 180,00";
//   item sem km_inicial e data_inicial mostra 'Sem histórico — revisar'
// tocar num item abre o editor com "Última troca: km" e "Última troca: data (dd/mm/aaaa)";
//   salvar → definirHistoricoInicial(id, 40000, '2026-08-01'); deixar os dois vazios → (id, null, null)
// editar intervalo/custo e tocar "Salvar" → pergunta 'Aplicar esta mudança a:' com 'Só este carro' / 'Todos os carros da frota';
//   'Todos os carros da frota' → atualizarItem(id, {...}, true) e mostra 'Alterado em 3 carros.' (valor retornado)
// sugestaoCusto retorna 210 → mostra 'Média paga: R$ 210,00 — usar este valor' e tocar preenche o custo
// "Adicionar item" com nome 'Bateria', 0 km e 24 meses → adicionarItem(...)
// data inválida '31/02/2026' → 'Data inválida.'
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** A tela tem o título "Plano de manutenção" e um texto de ajuda no topo: "Informe quando cada item foi trocado pela última vez. Se não souber, deixe em branco."

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): plano de manutenção do carro`)

---

### Task 6: Painel da frota e detalhe do carro

**Files:**
- Create:
  - `mobile/src/api/fotos.ts`
  - `mobile/src/componentes/{BadgeStatus,ListaVazia,FotoRemota}.tsx`
  - `mobile/app/(dono)/carros/[id]/index.tsx`
- Modify: `mobile/src/api/veiculos.ts`, `mobile/app/(dono)/(abas)/index.tsx`
- Test: `mobile/app/(dono)/(abas)/index.test.tsx` (ampliar), `mobile/app/(dono)/carros/[id]/index.test.tsx`

**Interfaces:**
- Produces (em `api/veiculos.ts`):
  - `export type ResumoCarro = { vehicle_id: string; placa: string; marca: string; modelo: string; status: StatusItem; proxima_data: string | null; proximo_item: string | null; estimada: boolean; motorista_nome: string | null }`
  - `resumoFrota(fleetId: string): Promise<ResumoCarro[]>`, via RPC `resumo_frota`
  - `export type PrevisaoItem = { vehicle_item_id: string; nome: string; proximo_km: number | null; km_restante: number | null; data_prevista: string | null; status: StatusItem; custo_estimado: number }`
  - `previsaoItens(vehicleId: string): Promise<PrevisaoItem[]>`
  - `statusCarro(vehicleId: string): Promise<{ status: StatusItem; proxima_data: string | null; proximo_item: string | null; media: number; estimada: boolean }>`
  - `buscarVeiculo(id: string)`
  - `leiturasKm(vehicleId: string, limite = 20)`: `odometer_readings` com `km, origem, capturado_em, foto_painel_path, salto_suspeito`, ordenado por `capturado_em` desc
  - `servicos(vehicleId: string)`: `maintenance_records` com itens e `status`, ordenado por `data` desc
  - `vinculos(vehicleId: string)`: `assignments` com as fotos de inspeção e o nome do motorista
- Produces (em `api/fotos.ts`): `urlsAssinadas(paths: string[]): Promise<Record<string, string>>`, via `storage.from('fotos').createSignedUrls(paths, 3600)`
- Produces (componentes):
  - `<BadgeStatus status />`, cor e rótulo de `status.ts`
  - `<ListaVazia texto />`
  - `<FotoRemota path urls />`, imagem 96×96; ao tocar, abre em tela cheia num `Modal`

- [ ] **Step 1: Escrever os testes**

```tsx
// painel: lista os carros de resumoFrota ordenados por severidade (vencido, urgente, sem_historico, proximo, em_dia);
//   cada card: 'ABC1D23 · Chevrolet Onix', BadgeStatus, 'Próxima: Óleo do motor em 30/10/2026', 'Motorista: Ana' ou 'Livre';
//   estimada=true → texto 'previsão estimada'
//   frota sem carros → ListaVazia 'Nenhum carro cadastrado. Toque em "Adicionar carro".'   (Review Focus 3)
//   puxar para atualizar refaz a consulta
// detalhe: cabeçalho com placa, modelo, cor, 'Km atual: 45.200 km', 'Média: 300 km/dia' (ou 'Média estimada: 300 km/dia');
//   seção "Manutenção" com cada PrevisaoItem: nome, BadgeStatus, 'Faltam 800 km · previsto para 30/10/2026'
//     (km_restante <= 0 → 'Vencido há 200 km'; sem histórico → 'Sem histórico — revisar');
//   seção "Leituras de km": '45.200 km · 07/10/2026 · Atualização', com selo 'Conferir' quando salto_suspeito, e foto do painel quando houver;
//   seção "Serviços": data, itens, valor, status ('Aprovado', 'Pendente', 'Recusado', 'Contestado');
//   seção "Retiradas e devoluções": motorista, datas, km, miniaturas das 4 fotos via FotoRemota
// erro de rede em previsaoItens → MensagemErro 'Sem conexão com a internet. Tente de novo.' e botão 'Tentar de novo'
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**
  - Rótulos de origem: retirada → Retirada, devolucao → Devolução, atualizacao → Atualização, manutencao → Manutenção, correcao_dono → Correção.
  - Ao tocar num card do painel, abre `/carros/{id}`.
  - O detalhe tem os botões "Plano de manutenção" (vai para `itens`), "Registrar serviço" e "Pedido de manutenção". Os dois últimos ganham ação na Task 7.

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): painel da frota e detalhe do carro`)

---

### Task 7: Ações do dono no carro

**Files:**
- Create: `mobile/src/api/manutencao.ts`, `mobile/app/(dono)/carros/[id]/servico.tsx`, `mobile/app/(dono)/carros/[id]/pedido.tsx`
- Modify: `mobile/app/(dono)/carros/[id]/index.tsx`, `mobile/src/api/veiculos.ts`
- Test: `mobile/app/(dono)/carros/[id]/servico.test.tsx`, `mobile/app/(dono)/carros/[id]/pedido.test.tsx`, `mobile/app/(dono)/carros/[id]/index.test.tsx` (ampliar)

**Interfaces:**
- Produces (em `api/manutencao.ts`):
  - `export type ItemServico = { vehicle_item_id: string; valor?: number } | { nome_outro: string; valor?: number }`
  - `registrarServico(d: { vehicleId: string; itens: ItemServico[]; km: number; data: string; valorTotal: number; oficina?: string; requestId?: string }): Promise<void>`, via RPC `registrar_servico` (sem foto no Plano 2; para o dono ela é opcional)
  - `criarPedido(vehicleId: string, itens: string[], prazo: string, observacao?: string): Promise<void>`
  - `cancelarPedido(requestId: string): Promise<void>`
  - `pedidosAbertos(vehicleId: string)`
- Produces (em `api/veiculos.ts`):
  - `corrigirKm(vehicleId: string, km: number): Promise<void>`, via `registrar_km` com `p_origem: 'correcao_dono'`
  - `atualizarVeiculo(id: string, campos: { exige_aprovacao_sempre?: boolean; ativo?: boolean; km_dia_estimado?: number }): Promise<void>`

- [ ] **Step 1: Escrever os testes**

```tsx
// servico: checklist dos itens do carro (pré-marca os 🟡/🟠/🔴), "Outro serviço" com nome; Km do painel, Data (hoje),
//   Valor total, Oficina (opcional); "Registrar" → registrarServico({vehicleId, itens:[{vehicle_item_id}...], km, data:'2026-10-07', valorTotal, oficina});
//   aberto a partir de um pedido (?pedido=ID) → itens do pedido marcados e requestId:'ID' enviado      (Global Constraint)
//   nenhum item → 'Marque pelo menos um serviço.'; erro P0001 DATA_FUTURA → mostra o DETAIL e mantém o formulário  (Review Focus 1)
// pedido: carro sem motorista (motorista_nome null) → 'Este carro está sem motorista. O pedido vai para quem estiver com ele.' e botão desabilitado;
//   com motorista: itens pré-marcados (🟡/🟠/🔴), Prazo (dd/mm/aaaa), Observação; "Enviar pedido" → criarPedido(...)
//   prazo no passado → 'O prazo precisa ser hoje ou depois.'
// detalhe: lista "Pedidos abertos" com 'Cancelar' (confirmação) → cancelarPedido;
//   menu "Mais": 'Corrigir km' (pede o km e avisa 'Use só para corrigir um km digitado errado.') → corrigirKm;
//   interruptor 'Sempre exigir minha aprovação' → atualizarVeiculo(id,{exige_aprovacao_sempre:true});
//   'Desativar carro' (confirmação 'O carro sai do painel e das previsões.') → atualizarVeiculo(id,{ativo:false})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** Depois de cada ação, invalidar as consultas do carro, do painel e de `['pendencias']`.

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): serviço, pedido e ações do dono no carro`)

---

### Task 8: Motoristas

**Files:**
- Modify: `mobile/src/api/frota.ts`, `mobile/app/(dono)/(abas)/motoristas.tsx`
- Test: `mobile/app/(dono)/(abas)/motoristas.test.tsx`

**Interfaces:**
- Produces (em `api/frota.ts`):
  - `export type Membro = { id: string; driver_id: string; status: 'pendente' | 'ativo' | 'removido'; nivel_manutencao: 'sem_permissao' | 'com_aprovacao' | 'confiavel'; nome: string; telefone: string | null; carro_placa: string | null }`
  - `listarMembros(fleetId: string): Promise<Membro[]>`, com os perfis por colunas explícitas e a placa do vínculo não encerrado
  - `responderEntrada(memberId: string, aprovar: boolean): Promise<void>`
  - `definirNivel(memberId: string, nivel: Membro['nivel_manutencao']): Promise<void>`
  - `removerMotorista(memberId: string): Promise<void>`

- [ ] **Step 1: Escrever os testes**

```tsx
// seção "Pedidos para entrar" (pendentes): nome, telefone, botões 'Aprovar' / 'Recusar' → responderEntrada(id, true|false)
// seção "Motoristas" (ativos): nome, 'Com o carro ABC1D23' ou 'Sem carro'; Seletor de nível com
//   'Não registra' / 'Registra com aprovação' / 'Confiável' → definirNivel; texto de ajuda do nível 'Confiável':
//   'Os serviços entram direto na previsão. Você pode contestar depois.'
// 'Remover da frota' → confirmação 'Se ele estiver com um carro, o carro fica livre.' → removerMotorista
// removidos não aparecem; nenhum motorista → ListaVazia 'Nenhum motorista ainda. Compartilhe o código da frota.'  (Review Focus 3)
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): gestão de motoristas`)

---

### Task 9: Pendências

**Files:**
- Create: `mobile/src/api/pendencias.ts`
- Modify: `mobile/app/(dono)/(abas)/pendencias.tsx`
- Test: `mobile/app/(dono)/(abas)/pendencias.test.tsx`

**Interfaces:**
- Produces (em `api/pendencias.ts`):
  - `servicosParaRevisar(fleetId: string)`: registros `pendente`, com placa, autor, itens, valor, data, oficina e `nota_foto_path`
  - `servicosRecentesDeMotoristas(fleetId: string, dias = 30)`: registros `aprovado` cujo autor não é o dono (para contestar)
  - `leiturasParaConferir(fleetId: string, dias = 30)`: `odometer_readings` com `salto_suspeito = true` e foto
  - `ocorrenciasAbertas(fleetId: string)`: `incidents` com status `aberta`, fotos, placa e motorista
  - `revisarServico(recordId: string, decisao: 'aprovar' | 'recusar' | 'contestar', motivo?: string): Promise<void>`
  - `resolverOcorrencia(incidentId: string): Promise<void>`
  - Contagem total de pendências (serviços a revisar + ocorrências abertas), usada como **badge** da aba

- [ ] **Step 1: Escrever os testes**

```tsx
// seção "Serviços para aprovar": 'ABC1D23 · Bruno · 05/10/2026', itens, 'R$ 210,00', miniatura da nota;
//   'Aprovar' → revisarServico(id,'aprovar'); 'Recusar' abre campo 'Motivo (opcional)' → revisarServico(id,'recusar', motivo)
// seção "Registrados por motoristas confiáveis": 'Contestar' (confirmação 'O serviço sai da previsão.') → revisarServico(id,'contestar', motivo)
// seção "Leituras de km para conferir": '+2.000 km em 1 dia', foto do painel ampliável
// seção "Ocorrências": tipo ('Acidente grave' destacado em vermelho), descrição, fotos; 'Marcar como resolvida' → resolverOcorrencia
// tudo vazio → ListaVazia 'Nenhuma pendência. Tudo em dia!'                              (Review Focus 3)
// badge da aba = total de serviços para aprovar + ocorrências abertas
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** Rótulos dos tipos de ocorrência: mecanico → Barulho/mecânico, acidente_leve → Acidente leve, acidente_grave → Acidente grave, outro → Outro.

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): pendências do proprietário`)

---

### Task 10: Gastos — projeção, gráficos e realizado

**Files:**
- Create: `mobile/src/features/gastos/agregar.ts`, `mobile/src/api/gastos.ts`, `mobile/src/componentes/GraficoBarras.tsx`
- Modify: `mobile/app/(dono)/(abas)/gastos.tsx`
- Test: `mobile/src/features/gastos/agregar.test.ts`, `mobile/app/(dono)/(abas)/gastos.test.tsx`

**Interfaces:**
- Produces (em `api/gastos.ts`):
  - `export type LinhaProjecao = { vehicle_id: string; placa: string; vehicle_item_id: string; item_nome: string; data: string | null; valor: number }`
  - `export type LinhaRealizado = { record_id: string; vehicle_id: string; placa: string; data: string; valor_total: number; itens: string[] }`
  - `projecaoGastos(fleetId: string, dias: 30 | 60 | 90): Promise<LinhaProjecao[]>`
  - `gastosRealizados(fleetId: string, dias: 30 | 60 | 90): Promise<LinhaRealizado[]>`
- Produces (em `features/gastos/agregar.ts`, funções puras):
  - `export type Barra = { rotulo: string; total: number }`
  - `porPeriodo(linhas: LinhaProjecao[], dias: 30|60|90, hoje: string): Barra[]`
    - **30 dias:** 5 blocos de 7 dias a partir de `hoje`, com rótulo `dd/mm` do início do bloco.
    - **60 e 90 dias:** meses de calendário de `hoje` até `hoje + dias`, com rótulo `out`, `nov`... (abreviações `jan fev mar abr mai jun jul ago set out nov dez`).
    - Ignora `data null`. Inclui barras com total 0.
  - `porCarro(linhas): { vehicle_id: string; placa: string; total: number }[]` (ordem decrescente)
  - `porItem(linhas): { item_nome: string; total: number; quantidade: number }[]` (ordem decrescente)
  - `revisoesRecomendadas(linhas): LinhaProjecao[]` (linhas com `data null`)
  - `totalPrevisto(linhas): number` (ignora `data null`)
  - `totalRealizado(r: LinhaRealizado[]): number`
- Produces (componente): `<GraficoBarras barras={Barra[]} formatarValor={(n)=>string} />`, barras verticais em `View`, altura proporcional ao maior valor, valor em cima e rótulo embaixo.

- [ ] **Step 1: Escrever os testes**

`agregar.test.ts`, com `hoje = '2026-10-07'`:
```ts
// porPeriodo 30: linhas em 2026-10-08 (180) e 2026-10-20 (250) → 5 barras
//   [{'07/10',180},{'14/10',250},{'21/10',0},{'28/10',0},{'04/11',0}]
// porPeriodo 90: linhas em 2026-10-16 (180), 2026-12-05 (180), 2026-11-02 (600)
//   → [{'out',180},{'nov',600},{'dez',180},{'jan',0}]   (2026-10-07 + 90 = 2027-01-05)
// linha com data null não entra em porPeriodo nem em totalPrevisto, mas aparece em revisoesRecomendadas
// porCarro e porItem somam e ordenam decrescente; porItem conta as repetições (óleo 2x → quantidade 2)
// totalRealizado([{valor_total:150},{valor_total:210}]) = 360
```

`gastos.test.tsx`:
```tsx
// Seletor '30 dias' / '60 dias' / '90 dias' (padrão 30) refaz as consultas com o período
// card 'Previsto: R$ 610,00' e 'Gasto nos últimos 30 dias: R$ 360,00'
// GraficoBarras renderiza uma barra por item de porPeriodo
// listas "Por carro" e "Por item" ('Óleo do motor · 2x · R$ 360,00')
// "Revisão recomendada" lista os itens sem histórico ('Kwid · Correia dentada')
// aviso em 60/90: 'Quanto mais longe, menos precisa é a previsão.'
// sem dados → ListaVazia 'Sem gastos previstos para este período.'                       (Review Focus 3)
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Verificar** — tsc + jest → PASS.

- [ ] **Step 5: Commit** (`feat(app): previsão de gastos com gráfico`)

---

### Task 11: Central de avisos e fechamento

**Files:**
- Create: `mobile/src/api/avisos.ts`, `mobile/README.md`
- Modify: `mobile/app/(dono)/(abas)/avisos.tsx`, `mobile/app/(dono)/(abas)/_layout.tsx` (badges), `README.md` da raiz (link para `mobile/README.md`)
- Test: `mobile/app/(dono)/(abas)/avisos.test.tsx`

**Interfaces:**
- Produces (em `api/avisos.ts`):
  - `export type Aviso = { id: string; tipo: string; titulo: string; corpo: string; prioridade: 'normal' | 'alta'; ref_tabela: string | null; ref_id: string | null; lida: boolean; criada_em: string }`
  - `listarAvisos(limite = 50): Promise<Aviso[]>`
  - `marcarLido(id: string): Promise<void>`
  - `marcarTodosLidos(): Promise<void>`
  - `contarNaoLidos(): Promise<number>`

- [ ] **Step 1: Escrever os testes**

```tsx
// lista título, corpo e data ('07/10/2026 08:00'); não lidos em negrito; prioridade 'alta' com marca vermelha
// tocar marca como lido e navega: ref_tabela 'vehicles' ou 'vehicle_items' → carro; 'maintenance_records' ou 'incidents' → Pendências;
//   'fleet_members' → Motoristas; outros → só marca como lido
// 'Marcar todos como lidos' → marcarTodosLidos
// vazio → ListaVazia 'Nenhum aviso por enquanto.'
// badge da aba Avisos = contarNaoLidos
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**

`mobile/README.md` explica:
1. Copiar `.env.example` para `.env` e preencher o IP do PC e a anon key (que aparece em `npm run db:start`).
2. Rodar `npx expo start` e abrir no celular Android com o **Expo Go** (na mesma rede Wi-Fi) ou no emulador.
3. Entrar com `dono@frotos.dev` / `senha123`.
4. Se o celular não conectar, liberar a porta 54321 no Firewall do Windows.

- [ ] **Step 4: Verificação final**

Run:
- `cd mobile && npx tsc --noEmit && npx jest`
- `npx expo export --platform android --output-dir ../.superpowers/export-check`
- depois apagar a pasta `../.superpowers/export-check`

Expected: tudo verde, e o export gera o bundle sem erro.

- [ ] **Step 5: Commit** (`feat(app): central de avisos e README do app`)
