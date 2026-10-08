# Projeto Frotos — Bloco 1: App do motorista, busca de carros e visual novo

**Data:** 2026-10-07
**Status:** aguardando revisão
**Base:** especificação do MVP (`2026-10-06-frota-mvp-design.md`), backend (Plano 1) e app do proprietário (Plano 2). Este documento **amplia e substitui** os trechos do MVP que tratam de fotos de retirada e devolução e da tela do motorista.

---

## 1. Objetivo

O app deixa de ser só uma obrigação para o motorista contratado e passa a dar a ele um **motivo próprio para usar: encontrar carro para trabalhar na sua cidade**. Ao mesmo tempo, o dono ganha um canal para encontrar motoristas.

**Sucesso do bloco 1:**
1. Um motorista sem frota se cadastra (com CPF), encontra um carro anunciado na cidade dele, se candidata e é aceito pelo dono.
2. Já na frota, ele faz retirada, uso e devolução pelo app, com fotos guiadas, mesmo com internet ruim.
3. Dono e motorista recebem push.
4. O app é instalável por uma build de teste do Android.

**Fora do bloco 1:**
- avaliações e scores (bloco 2);
- OCR do painel;
- foto e verificação de CNH (decisão do autor: no início, só CPF + declaração de que tem CNH);
- FIPE;
- iPhone, enquanto não houver conta Apple Developer;
- cobrança.

---

## 2. Visual (dono e motorista)

- **Princípio:** menos texto, mais imagem. Cards grandes, botões principais com ícone + rótulo curto, e textos auxiliares só quando necessários.
- **Componente `Placa`:** imita a placa Mercosul.
  - Fundo branco, borda escura arredondada, faixa azul no topo com "BRASIL".
  - Caracteres grandes e espaçados em fonte monoespaçada.
  - Tamanhos `pequena` (listas) e `grande` (cabeçalhos).
  - Vale também para placas no formato antigo: muda só o texto, o visual é o mesmo.
- **Card do carro (`CardCarro`):**
  - topo: `Placa` (no card da busca pública **não há placa**);
  - meio: marca/modelo, ano e cor, com o selo de status ou a marca "Livre";
  - **canto inferior direito:** a foto do carro (miniatura arredondada, cerca de 96×72), com ícone de carro quando não houver foto.
- **Foto do carro:**
  - tirada **pela câmera** no cadastro do carro pelo dono, obrigatória para carros novos;
  - pode ser trocada no detalhe do carro;
  - carros já cadastrados mostram o ícone até ganharem foto.
- **Onde se aplica:**
  - as telas do dono (painel, detalhe, pendências e motoristas) passam a usar `Placa` e `CardCarro`;
  - as telas do motorista nascem com eles.

---

## 3. Cadastro do motorista

O cadastro de quem escolhe "Sou motorista" pede:
- nome, telefone, e-mail, senha;
- **estado (UF) e cidade**;
- **CPF**;
- **interruptor "Tenho CNH"**.

**Regras:**
- **CPF:**
  - O app aplica a máscara `000.000.000-00` e valida os dígitos verificadores.
  - CPF inválido: "CPF inválido."
  - O CPF é **único**: um CPF já usado gera "Este CPF já está cadastrado."
  - Ele é guardado só com os números.
- **"Tenho CNH":**
  - é uma declaração do motorista, sem foto e sem verificação no MVP (decisão do autor, para não incomodar nem expor documentos);
  - quem marcar "não" consegue usar o app, mas **não pode se candidatar a carros**: "Você precisa ter CNH para se candidatar.";
  - pode mudar a resposta depois, em "Meu perfil".
- **Quem vê o CPF:** só o próprio motorista e donos com quem ele tem candidatura ou vínculo de frota (ver §8). Nunca outros motoristas.
- **Cidade e estado:** o estado é escolhido numa lista das 27 UFs, e a cidade é digitada. A cidade é comparada sem diferenciar maiúsculas de minúsculas nem acentos (normalização no banco).

---

## 4. Motorista sem frota: Buscar carros e Candidaturas

Abas: **Buscar carros · Minhas candidaturas**.

### 4.1 Buscar carros
- **Filtros:** UF e cidade, já preenchidos com os do perfil e editáveis. Botão "Buscar".
- **Lista:** cards da busca pública com foto, marca/modelo, ano, cor, nome da frota e cidade.
  - **A placa nunca aparece**, nem na resposta da API.
- **O que aparece:** só carros **anunciados**, **ativos**, **livres** (sem vínculo aberto) e com **visibilidade "todos da frota"**.
  - Carros reservados para alguém, ou para "só alguns", não são anunciados.
  - Se o dono marcar "anunciar" num carro reservado, o anúncio só passa a valer quando a visibilidade voltar a "todos".
- **Sem resultados:** "Nenhum carro disponível na sua região no momento."
- **Candidatura pelo card:** o botão **"Quero este carro"** abre uma mensagem opcional de até 300 caracteres e envia a candidatura.
- **Mensagens de bloqueio:**

  | Situação | Mensagem |
  |---|---|
  | Já tem candidatura pendente para o mesmo carro | "Você já se candidatou para este carro." |
  | Já é membro ativo de uma frota | "Você já faz parte de uma frota." (no MVP, um motorista ativo em uma frota não se candidata a outras) |
  | Declarou que não tem CNH | "Você precisa ter CNH para se candidatar." |

### 4.2 Minhas candidaturas
- **Lista:** cada candidatura mostra o card do carro (sem placa), a data e o status (**Aguardando**, **Aceita**, **Recusada**, **Cancelada**).
- **Cancelar:** "Cancelar candidatura" vale só para as pendentes.
- **Entrar com código:** campo "Entrar com código da frota" (fluxo do MVP: o pedido de entrada fica pendente e o dono aprova).
- **Pedido por código pendente:** aparece aqui como "Pedido de entrada na frota X — Aguardando".
- **Aceite:** quando uma candidatura ou um pedido por código é aceito, o motorista recebe push e o app **troca as abas** (§5).

---

## 5. Motorista na frota

Abas: **Meu carro · Carros · Avisos**.

### 5.1 Meu carro
- **Sem vínculo:**
  - carro reservado para ele (vindo da candidatura aceita): mostra o `CardCarro` desse carro e **a retirada guiada** (§6);
  - sem carro reservado: "Escolha um carro na aba Carros".
- **Retirada em andamento** (aguardando fotos): mostra os campos que faltam, já preenchidos com o que estiver na fila.
- **Com vínculo ativo:** os campos de foto **somem**. A tela mostra:
  - o `CardCarro` grande (placa + foto) e o km atual;
  - as próximas manutenções (status em cores, data prevista, "faltam X km");
  - pedidos de manutenção do dono, com prazo;
  - os botões grandes:
    - **Atualizar km:** foto do painel + km;
    - **Relatar ocorrência:** tipo, texto e até 5 fotos;
    - **Registrar serviço:** só aparece quando a permissão ou um pedido permite (spec do MVP §5.3/§5.4); itens, km, data, valor, oficina e **foto da nota**;
    - **Devolver carro:** fluxo guiado das 5 fotos + km.
- **Fila:** um indicador "N envios pendentes" aparece quando a fila offline não está vazia (§7).

### 5.2 Carros
Lista os carros da frota que estão liberados para ele (§9) e livres, com `CardCarro` e placa visível. Tocar num carro leva à retirada guiada. Serve para o revezamento.

### 5.3 Avisos
É a mesma central de avisos do dono. Tocar abre a tela relacionada: carro, pedido, candidatura.

---

## 6. Retirada e devolução guiadas

- **Fotos sempre, na retirada e na devolução, em sequência:** **frente → traseira → lateral esquerda → lateral direita → painel**.
- **Captura:**
  - cada passo mostra uma silhueta do ângulo esperado e um botão de câmera;
  - só câmera do app, sem galeria;
  - o motorista pode refazer a foto antes de avançar.
- **Km:** depois da foto do painel, o motorista digita o km.
  - **A foto do painel é a prova do km.** A leitura de retirada e de devolução sempre leva a foto do painel, então a regra de salto não pede foto extra nesses momentos, porque ela já existe.
  - O salto continua sendo marcado como "conferir" para o dono, como no Plano 1.
- **Conclusão:** só no servidor, quando todas as 5 fotos e o km chegam (fila offline, §7).
  - Até lá, a tela mostra "Enviando… 3/5".
  - O carro já aparece como ocupado para os outros desde o início da retirada.
- **Fim da devolução:** o carro volta a ficar livre e **mantém a visibilidade configurada**. Se estava reservado só para esse motorista, continua reservado para ele. Só o dono muda isso.

---

## 7. Fila offline, fotos e push

**Fila offline**
- Ações que envolvem fotos e registros vão para uma fila persistida no celular:
  - retirada, devolução, atualização de km;
  - ocorrência, serviço;
  - foto do carro (dono).
- **Cada item da fila:** arquivos locais, a chamada RPC a fazer e os horários de captura.
- **Processamento:** a fila roda em ordem quando há conexão, com nova tentativa e espera progressiva.
- **Erros:**
  - erro de negócio (P0001, ex.: `KM_MENOR`): para o item e mostra a mensagem, para o usuário corrigir ou descartar;
  - erro de rede: tenta de novo.
- **Compressão:** cerca de 1600px no lado maior e JPEG com qualidade 0,7 (aprox. 300–500 KB).

**Antifraude das fotos** (resolve a pendência do Plano 1)
- Uma foto só é aceita como prova se o objeto no storage foi **enviado pelo próprio usuário** (dono do objeto = `auth.uid()`) e **ainda não foi usado** em outro registro de foto, leitura, serviço ou ocorrência.
- O horário de captura continua sendo gravado junto com o de recebimento.

**Push**
- **Registro do token:** ao entrar no app (dono e motorista), o app pede permissão e salva o token da Expo em `profiles.expo_push_token`. O backend de envio já existe (Plano 1).
- **Toque na notificação:** abre a tela relacionada usando `ref_tabela`/`ref_id`.
- **Notificações novas:**
  - **dono:** "Novo candidato para o carro {modelo}";
  - **motorista:** "Sua candidatura foi aceita" ou "Sua candidatura foi recusada".

---

## 8. Do lado do dono

- **Configurações:** a frota ganha **UF e cidade**. São obrigatórias para anunciar carros. Sem elas, o botão de anunciar explica "Informe a cidade da frota em Configurações".
- **Cadastro do carro:** passa a pedir a **foto do carro** (câmera).
- **Detalhe do carro:**
  - **Visibilidade** (§9);
  - interruptor **"Anunciar na busca de motoristas"**, desligado por padrão;
  - **"Trocar foto do carro"**.
- **Motoristas → "Pedidos de motoristas"** (nova seção no topo):
  - **Lista:** candidaturas pendentes, cada uma com nome, telefone, cidade/UF, CPF (formatado), "Tem CNH: sim", mensagem e **o carro desejado** (`CardCarro` com placa).
  - **Aceitar:**
    - o motorista vira **membro ativo** da frota com nível `com_aprovacao`;
    - o carro fica com visibilidade **"só um motorista" = ele**;
    - o anúncio é desligado;
    - as outras candidaturas pendentes **para o mesmo carro** são recusadas automaticamente, com aviso a esses candidatos;
    - o motorista recebe push.
  - **Recusar:** a candidatura fica recusada e o motorista recebe push.
  - Os "Pedidos para entrar" (por código) continuam como estão.
- **Badges:** o badge da aba Motoristas mostra pedidos de motoristas + pedidos de entrada pendentes.

---

## 9. Visibilidade do carro (dentro da frota)

| Modo | Quem vê o carro para retirar |
|---|---|
| **Todos da frota** (padrão) | todo membro ativo |
| **Só alguns** | membros ativos marcados pelo dono |
| **Só um motorista** | apenas aquele membro |

- **Garantia no banco:** a retirada (`iniciar_retirada`) recusa um motorista sem permissão de visibilidade com "Este carro não está disponível para você."
- **Lista "Carros" do motorista:** filtra pela visibilidade.
- **Mudança de modo:** só o dono altera. A reserva vale também depois da devolução.
- **Motorista removido da frota:** sai de todas as listas de visibilidade. Um carro "só um motorista" dele volta para "todos da frota" e o dono é avisado.

---

## 10. Backend — mudanças (nova migração)

**Perfis (`profiles`)**
- Colunas novas: `uf`, `cidade`, `cpf` (único, só os números), `tem_cnh bool default false`.
- **Leitura de terceiros:**
  - o dono lê esses campos só de motoristas com candidatura para a frota dele ou membros dela;
  - `cpf` nunca fica visível para outros motoristas;
  - `expo_push_token` continua ilegível.

**Frotas (`fleets`)**
- Colunas novas: `uf`, `cidade`.

**Veículos (`vehicles`)**
- Colunas novas:
  - `foto_path`;
  - `anunciado bool default false`;
  - `visibilidade` (`todos` / `alguns` / `um`, padrão `todos`).
- Tabela nova `vehicle_visibility(vehicle_id, driver_id)`, que guarda os membros de "alguns" e o motorista de "um".

**Candidaturas**
- Tabela nova `candidaturas(id, vehicle_id, fleet_id, driver_id, mensagem, status: pendente/aceita/recusada/cancelada, criada_em, respondida_em)`.
- Única pendente por (motorista, carro).

**RPCs novas**
- `buscar_carros(p_uf, p_cidade)`:
  - security definer;
  - retorna **sem placa**: `vehicle_id, marca, modelo, ano_modelo, cor, foto_path, frota_nome, cidade, uf`;
  - qualquer motorista autenticado pode chamar.
- `candidatar(p_vehicle_id, p_mensagem)`.
- `cancelar_candidatura(p_id)`.
- `responder_candidatura(p_id, p_aceitar)`: tudo atômico, incluindo virar membro, reservar o carro, desligar o anúncio e recusar as concorrentes.
- `definir_visibilidade(p_vehicle_id, p_modo, p_motoristas uuid[])`.

**RPCs alteradas**
- `iniciar_retirada`: checa a visibilidade.
- Retirada e devolução: exigem a foto do painel (posição `painel` nova em `posicao_foto`).
- `remover_motorista`: limpa a visibilidade.
- `foto_valida`: passa a exigir dono do objeto = `auth.uid()` e caminho ainda não usado.

**Storage**
- **Bucket `carros`:** caminho `{fleet_id}/{vehicle_id}/{uuid}.jpg`.
  - Legível por qualquer usuário autenticado, porque a foto aparece na busca pública.
  - Só o dono da frota escreve.
- Fotos de prova continuam no bucket `fotos` (privado).

**Notificações novas**
- `candidatura_nova` (dono);
- `candidatura_aceita` e `candidatura_recusada` (motorista).

---

## 11. Build de teste

- **Build de desenvolvimento** Android via EAS, porque o push não funciona no Expo Go. Depois, **build de teste** (APK por link) para o piloto.
- **Contas:** exigem conta Expo (gratuita).
- **Configuração:** fica no README (`eas.json` com perfis `development` e `preview`).

---

## 12. Testes

- **Banco (pgTAP):**
  - busca sem placa e só com carros elegíveis;
  - candidatura, com as regras de bloqueio da §4.1 (incluindo sem CNH);
  - aceite atômico (membro, reserva, anúncio desligado, concorrentes recusadas, notificações);
  - visibilidade na retirada, nos três modos;
  - remoção de motorista limpando a visibilidade;
  - fotos antifraude (dono do objeto, reuso);
  - painel obrigatório na retirada e na devolução;
  - CPF único e legível só por quem pode.
- **App (Jest):**
  - `Placa`, `CardCarro` (com e sem placa, com e sem foto);
  - cadastro do motorista (CPF inválido/duplicado, interruptor de CNH);
  - busca (vazia, com resultados), candidatura;
  - troca de abas ao ser aceito;
  - retirada guiada (sequência, refazer foto);
  - fila offline (persistência, nova tentativa, erro de negócio);
  - registro do token de push;
  - pedidos de motoristas no dono.
- **Manual:** roteiro no celular Android com a build de teste: dono + 2 motoristas, candidatura → aceite → retirada → uso → devolução, com o Wi-Fi desligado no meio.
