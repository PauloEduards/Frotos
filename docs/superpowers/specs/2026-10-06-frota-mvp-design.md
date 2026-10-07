# Projeto Frotos — MVP: Especificação de Design

**Data:** 2026-10-06
**Status:** aguardando revisão
**Responsável pelo código:** Claude (com revisão do autor)

---

## 1. Contexto e objetivo

Donos de pequenas e médias frotas que alugam carros para motoristas de aplicativo (Uber, 99) perdem dinheiro com manutenção feita fora do prazo: os carros rodam milhares de km além do intervalo e isso reduz a vida útil e o lucro. Hoje o controle é feito por WhatsApp e planilha.

O app resolve isso com:
- **Controle de todos os carros em um único app**, com a quilometragem informada pelos motoristas.
- **Previsão de quando cada carro vai precisar de manutenção** e de **quanto isso vai custar**.
- **Previsão visível também para o motorista**, para que ele se organize e leve o carro à oficina no momento certo.
- **Registro do estado do carro** (fotos e km) em cada troca de motorista, além de relatos de ocorrências.

**Concorrente de referência:** Drivvo. O diferencial é a relação **dono ↔ motorista**: quem estava com o carro, em que estado ele foi entregue, quem registrou cada km e cada manutenção.

**Modelo de negócio (pós-MVP):** mensalidade por carro, paga apenas pelo proprietário.

### Piloto
- Uma frota de **5 carros** onde trabalha o mecânico (primo do autor), que valida as previsões e acompanha o uso.
- Distribuição por **links de teste**: Android via build interno; iPhone via TestFlight, o que **exige a conta Apple Developer (cerca de US$ 99 por ano)**.
- Publicação nas lojas só depois da validação.

### Critério de sucesso do MVP
- O dono e os motoristas da frota piloto usam o app no dia a dia, sem voltar à planilha.
- As manutenções passam a ser feitas dentro do prazo previsto.
- O mecânico confirma que as previsões fazem sentido.

---

## 2. Escopo

### Entra no MVP
1. Login por e-mail e senha. Na primeira entrada, a pessoa escolhe o papel: **proprietário** ou **motorista**.
2. Criação da frota com **código de convite** (ex.: `FRT-7K2M`), que o dono pode gerar de novo.
3. Cadastro de carros com o estado inicial de cada item de manutenção.
4. Plano de manutenção com itens padrão, ajustável por carro, com a opção **"alterar em todos os carros da frota"**.
5. Entrada do motorista na frota pelo código, **com aprovação do dono**.
6. **Retirada** e **devolução** do carro, com km e 4 fotos obrigatórias.
7. Atualização de km a qualquer momento, com **lembrete semanal**.
8. **Foto do painel obrigatória** quando o km dá um salto acima do limite.
9. Registro de manutenção realizada, com **permissões configuráveis**.
10. **Ocorrências** relatadas pelo motorista.
11. Painel do dono: status da frota, previsões e **previsão de gastos de 30, 60 e 90 dias, com gráficos**.
12. Tela do motorista: o carro atual, as próximas manutenções e as ações rápidas.
13. Notificações push, com cópia dentro do app.

### Fora do MVP (fases futuras)
- Cobrança e mensalidade por carro (o piloto é gratuito).
- OCR do painel (a estrutura de fotos do painel já fica preparada para ele).
- Integração com rastreadores (Cobli e outros).
- Painel web.
- Controle do pagamento do aluguel do motorista.
- Mais de um administrador por frota.
- Permissões de manutenção por item.
- Plano de manutenção específico por modelo de carro.
- **GPS no celular do motorista: não será usado** (decisão de produto, para não ser "mais um app" pesando no celular do motorista).

---

## 3. Plataforma e arquitetura

| Camada | Tecnologia |
|---|---|
| App (Android + iPhone) | **React Native com Expo**, em **TypeScript**. Um único app, com telas diferentes conforme o papel do usuário. |
| Builds de teste | Expo EAS (build interno para Android, TestFlight para iPhone). |
| Backend | **Supabase**: PostgreSQL, login (Auth), armazenamento de fotos (Storage), funções no banco, tarefas agendadas (pg_cron) e Edge Functions para envio de push. |
| Notificações | Expo Push Notifications. |
| Segurança | **Row Level Security (RLS)** no PostgreSQL: as regras de acesso valem no banco, não só na tela. |

Princípio: **regras de negócio críticas ficam no banco**, em funções SQL: previsão, permissão efetiva, aprovação de manutenção, validação de km. Assim o app do dono, o app do motorista e os alertas automáticos usam exatamente a mesma lógica.

---

## 4. Fluxos principais

### 4.1 Proprietário: configuração inicial
1. Cria a conta e escolhe o papel "proprietário".
2. Cria a frota e recebe o código de convite.
3. Cadastra cada carro: placa, modelo, ano, km atual e **estimativa de km por dia** (padrão: 200).
4. Para cada item do plano padrão, informa o km e a data da última troca, se souber. **O que ficar em branco aparece como ⚪ "sem histórico, revisar".**
5. Opcionalmente, ajusta intervalos e custos estimados. Ao confirmar uma alteração, escolhe entre **"só este carro"** e **"alterar em todos os carros da frota"**.
6. Envia o código aos motoristas (por exemplo, no grupo de WhatsApp).

### 4.2 Motorista: entrada e retirada
1. Cria a conta, escolhe o papel "motorista" e digita o código da frota.
2. Fica **pendente** até o dono aprovar. O dono é notificado.
3. Depois de aprovado, vê a lista de carros da frota, com indicação de livre ou ocupado.
4. Escolhe um carro livre e faz a **retirada**:
   - informa o km atual
   - tira **4 fotos obrigatórias** (frente, traseira, lateral esquerda, lateral direita), mais fotos extras opcionais
   - se o km estiver acima do limite de salto, tira também a **foto do painel**
5. O vínculo só é concluído quando todas as fotos chegam ao servidor.

### 4.3 Motorista: uso diário
- **Atualizar km:** a qualquer momento. Se passar 7 dias sem atualizar, recebe um lembrete.
- **Ver previsão:** próximas manutenções do carro atual, com status e data prevista.
- **Relatar ocorrência:** escolhe o tipo, descreve e anexa fotos.
- **Registrar manutenção:** só aparece se a permissão efetiva permitir (ver 5.2).
- **Devolução:** km e as mesmas 4 fotos obrigatórias. O carro volta a ficar livre.

### 4.4 Proprietário: uso diário
- Vê a lista de carros com status em cores, a próxima manutenção de cada um e o motorista atual.
- Aprova ou recusa: entradas de motoristas e manutenções pendentes.
- Revisa leituras de km que exigiram foto do painel.
- Acompanha e resolve ocorrências.
- Registra manutenções (sem exigência de foto da nota).
- Consulta a previsão de gastos (ver 6.4).
- Remove motoristas da frota. Se o motorista estiver com um carro, o vínculo é encerrado e o carro fica livre.

---

## 5. Modelo de dados e permissões

### 5.1 Tabelas

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (= usuário do Auth), `nome`, `telefone`, `papel` (`proprietario` / `motorista`), `expo_push_token` |
| `fleets` | `id`, `owner_id`, `nome`, `codigo_convite` (único), configurações: `limite_salto_km_dia` (padrão 1500), `limiar_amarelo_km` (1000), `limiar_amarelo_dias` (7), `limiar_laranja_km` (300) |
| `fleet_members` | `fleet_id`, `driver_id`, `status` (`pendente` / `ativo` / `removido`), `nivel_manutencao` (`sem_permissao` / `com_aprovacao` / `confiavel`; padrão `com_aprovacao`) |
| `vehicles` | `id`, `fleet_id`, `placa`, `modelo`, `ano`, `km_atual`, `km_dia_estimado` (padrão 200), `exige_aprovacao_sempre` (bool), `ativo` |
| `maintenance_catalog` | Itens padrão: `nome`, `intervalo_km`, `intervalo_meses`, `custo_sugerido` |
| `vehicle_items` | `vehicle_id`, `catalog_id` (opcional), `nome`, `intervalo_km`, `intervalo_meses`, `ultimo_km` (pode ser nulo), `ultima_data` (pode ser nula), `custo_estimado`, `status_atual`, `ativo` |
| `assignments` | `vehicle_id`, `driver_id`, `inicio_em`, `fim_em`, `km_inicio`, `km_fim`, `status` (`aguardando_fotos` / `ativo` / `encerrado`) |
| `odometer_readings` | `vehicle_id`, `autor_id`, `km`, `origem` (`retirada` / `devolucao` / `atualizacao` / `manutencao` / `correcao_dono`), `foto_painel_path` (opcional), `capturado_em`, `recebido_em` |
| `inspection_photos` | `assignment_id`, `momento` (`retirada` / `devolucao`), `posicao` (`frente` / `traseira` / `lateral_esq` / `lateral_dir` / `extra`), `path`, `capturado_em`, `recebido_em` |
| `maintenance_records` | `vehicle_id`, `autor_id`, `km`, `data`, `valor_total`, `nota_foto_path`, `status` (`pendente` / `aprovado` / `recusado` / `contestado`), `revisado_por`, `revisado_em`, `motivo` |
| `maintenance_record_items` | `record_id`, `vehicle_item_id`, `valor` (opcional) |
| `incidents` | `vehicle_id`, `driver_id`, `tipo` (`mecanico` / `acidente_leve` / `acidente_grave` / `outro`), `descricao`, `status` (`aberta` / `resolvida`), `resolvida_em` |
| `incident_photos` | `incident_id`, `path`, `capturado_em` |
| `notifications` | `user_id`, `tipo`, `titulo`, `corpo`, `referencia` (tabela + id), `lida`, `criada_em` |

**Fotos:** bucket **privado** no Supabase Storage, organizado como `fleet_id/vehicle_id/...`. As políticas de acesso seguem as mesmas regras das tabelas.

**Catálogo padrão inicial** (intervalos a validar com o mecânico antes do piloto):

| Item | Intervalo km | Intervalo meses |
|---|---|---|
| Óleo do motor | 10.000 | 6 |
| Filtro de óleo | 10.000 | 6 |
| Filtro de ar | 15.000 | 12 |
| Filtro de combustível | 20.000 | 12 |
| Filtro de cabine (ar-condicionado) | 15.000 | 12 |
| Pastilhas de freio | 30.000 | 24 |
| Fluido de freio | 30.000 | 24 |
| Pneus (rodízio e alinhamento) | 10.000 | 6 |
| Correia dentada | 50.000 | 48 |
| Velas de ignição | 30.000 | 24 |
| Líquido de arrefecimento | 40.000 | 24 |

### 5.2 Regras de acesso (garantidas por RLS)
- **Dono:** acesso total às frotas que possui.
- **Motorista `ativo`:**
  - vê os carros da frota (placa, modelo e se estão livres ou ocupados)
  - vê previsões, itens e histórico **somente do carro com vínculo ativo**
  - vê os próprios registros (leituras, manutenções, ocorrências)
- **Motorista `pendente` ou `removido`:** não vê dados da frota.
- **Vínculos:** um carro tem no máximo um vínculo `ativo` ou `aguardando_fotos`, e um motorista também. Isso é garantido por índices únicos parciais.

**Permissão efetiva de manutenção** (função no banco):
- Se `nivel_manutencao = sem_permissao` → o motorista não pode registrar.
- Se `vehicles.exige_aprovacao_sempre = true` → o registro entra como `pendente`, mesmo para motorista confiável.
- Se `nivel_manutencao = com_aprovacao` → o registro entra como `pendente`.
- Se `nivel_manutencao = confiavel` → o registro entra como `aprovado`. O dono é avisado e pode **contestar**, o que desfaz o registro.
- Registros de motorista **exigem foto da nota ou do serviço**. Registros do dono não exigem.
- Só o motorista com vínculo ativo no carro pode registrar manutenção, km ou ocorrência nele.

**Aprovação e contestação de manutenção** (função atômica no banco):
- **Ao aprovar:**
  - atualiza `ultimo_km` e `ultima_data` dos itens envolvidos
  - grava uma leitura de km com origem `manutencao`, se o km for maior que o atual
  - recalcula o status do carro
- **Ao contestar:**
  - restaura o `ultimo_km` e a `ultima_data` anteriores, recalculados a partir do último registro aprovado de cada item
  - muda o status do registro para `contestado`
- Todo registro guarda quem criou, quem revisou e quando.

### 5.3 Validação de km (função no banco)
1. **Km menor que a última leitura:** recusado, com mensagem clara (ex.: "O km informado (45.200) é menor que o último registro (45.870)."). Só o dono pode registrar uma correção (origem `correcao_dono`).
2. **Salto acima do limite:**
   - **Regra:** se (km novo − última leitura) > `limite_salto_km_dia` × max(1, dias desde a última leitura), a leitura **exige foto do painel**.
   - **Captura:** a foto é tirada **apenas pela câmera dentro do app**, sem opção de galeria.
   - **Histórico:** ela fica no histórico do carro junto com as fotos de retirada e devolução.
   - **Aviso:** o dono recebe notificação para revisar.
3. Toda leitura guarda `capturado_em` (horário do celular) e `recebido_em` (horário do servidor).
4. Uma leitura válida atualiza `vehicles.km_atual`.

---

## 6. Previsão de manutenção e de gastos

### 6.1 Média diária de km
- Considera as leituras dos **últimos 30 dias**: (km da última − km da primeira) ÷ dias entre elas.
- Exige **pelo menos 2 leituras com 3 dias ou mais de distância**. Sem isso, usa `km_dia_estimado` do carro, e o app mostra o rótulo **"previsão estimada"**.

### 6.2 Previsão por item
Para cada `vehicle_item` ativo, com histórico:
- `proximo_km = ultimo_km + intervalo_km`
- `km_restante = proximo_km − km_atual`
- `data_por_km = hoje + (km_restante ÷ media_diaria)`
- `data_por_tempo = ultima_data + intervalo_meses`
- `data_prevista = a menor entre data_por_km e data_por_tempo`

Se só um dos dois (`ultimo_km` ou `ultima_data`) for conhecido, usa apenas o critério disponível. Se nenhum for conhecido, o item fica ⚪.

### 6.3 Status
Avaliado em ordem; vale o primeiro que se aplicar:

| Ordem | Status | Condição |
|---|---|---|
| 1 | ⚪ Sem histórico | Sem `ultimo_km` e sem `ultima_data` |
| 2 | 🔴 Vencido | `km_restante ≤ 0` ou `data_prevista ≤ hoje` |
| 3 | 🟠 Urgente | `km_restante < limiar_laranja_km` (padrão 300) |
| 4 | 🟡 Próximo | `km_restante ≤ limiar_amarelo_km` (padrão 1000) ou `data_prevista ≤ hoje + limiar_amarelo_dias` (padrão 7) |
| 5 | 🟢 Em dia | Demais casos |

- Quando um critério não está disponível (ex.: item só com `ultima_data`, sem `km_restante`), as condições que dependem dele são ignoradas.
- Todos os limiares são configurações da frota, ajustáveis após o piloto.
- **Status do carro** = o pior status entre os itens dele. O ⚪ só vale para o carro se nenhum item estiver 🔴 ou 🟠.
- **Próxima manutenção do carro** = o item com a menor `data_prevista`.

### 6.4 Previsão de gastos
- **Custo de cada item:**
  - usa `custo_estimado`, informado pelo dono ou sugerido pelo catálogo
  - depois de registros aprovados, o app **sugere** como novo custo estimado a média do que foi pago naquele item; o dono decide se aceita
- **Projeção por período (30, 60 ou 90 dias):**
  - para cada item, simula as trocas futuras a partir da `data_prevista`, repetindo a cada intervalo (pelo km, usando a média diária, e pelo tempo, valendo o que vier primeiro) até o fim do período
  - um item pode aparecer **mais de uma vez** no período
  - itens ⚪ entram como **"revisão recomendada"**, em uma linha separada, sem data
- **Visões no painel do dono:**
  - seletor de período: 30, 60 ou 90 dias
  - **gráfico de barras** do gasto previsto: por semana no período de 30 dias, por mês em 60 e 90 dias
  - quebra **por carro** e **por item**
  - **previsto × realizado:** gasto real, a partir das manutenções aprovadas, nos últimos 30, 60 ou 90 dias
  - aviso discreto de que a precisão diminui em períodos mais longos

---

## 7. Notificações

Push via Expo, com **cópia na tabela `notifications`** (central de avisos dentro do app).

| Destinatário | Evento |
|---|---|
| Dono | Item de um carro muda para 🟡, 🟠 ou 🔴 (somente na **mudança** de status) |
| Dono | Nova ocorrência (`acidente_grave` com prioridade alta) |
| Dono | Motorista pede entrada na frota |
| Dono | Manutenção pendente de aprovação, ou registrada por motorista confiável |
| Dono | Leitura de km com foto do painel (salto acima do limite) |
| Motorista | Lembrete semanal: 7 dias sem atualizar o km do carro atual |
| Motorista | Item do carro atual muda para 🟡, 🟠 ou 🔴 |
| Motorista | Entrada na frota aprovada; manutenção aprovada, recusada ou contestada |

**Execução:**
- **Tarefa diária** (pg_cron): recalcula os status de todos os itens, detecta as mudanças, gera as notificações e verifica os lembretes semanais.
- **Eventos imediatos** (ocorrências, pendências): geram notificação no momento em que acontecem.
- **Envio do push:** feito por uma Edge Function.

---

## 8. Erros, conectividade e fotos

- **Fila de envio offline:** fotos e registros feitos sem internet ficam numa fila no celular e são enviados automaticamente quando a conexão volta, com barra de progresso. A retirada e a devolução só são concluídas no servidor quando todas as fotos obrigatórias chegam.
- **Compressão:** as fotos são redimensionadas e comprimidas antes do envio (cerca de 300 a 500 KB cada) para economizar o plano de dados do motorista.
- **Horários:** cada foto e leitura guarda o horário de captura (celular) e o de recebimento (servidor).
- **Fotos obrigatórias e do painel:** são tiradas apenas pela câmera do app.
- **Mensagens de erro** em português claro, dizendo o que aconteceu e o que fazer.
- **Falha de push:** a notificação continua disponível na central de avisos do app.

---

## 9. Testes

- **Banco de dados** (testes SQL executados pela CLI do Supabase):
  - cálculo da média diária, previsão por item e status, incluindo casos limite: sem histórico, só km, só data, fallback da estimativa
  - projeção de gastos com itens repetidos no período
  - políticas de RLS: dono, motorista ativo, pendente e removido, motorista de outra frota
  - permissão efetiva de manutenção (todas as combinações de nível × trava do carro)
  - aprovação e contestação atômicas
  - validação de km: menor que a última, salto com e sem foto do painel
  - unicidade dos vínculos
- **App:** testes unitários (Jest) para formatação, fila de envio e regras de tela; testes de componentes nas telas principais.
- **Dados de exemplo:** script que cria uma frota fictícia com 5 carros, motoristas e histórico, para testes manuais.
- **Roteiro do piloto:** passo a passo para o dono e os motoristas na primeira semana.

---

## 10. Pendências para antes do piloto
- Validar com o mecânico os intervalos e custos do catálogo padrão (seção 5.1).
- Levantar os modelos dos 5 carros da frota piloto.
- Confirmar se o dono e os motoristas usam iPhone (o que define a necessidade da conta Apple Developer já no piloto).
