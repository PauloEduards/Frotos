# Projeto Frotos

Backend (Supabase) do MVP de manutenção de frotas.

## Pré-requisitos

- Node 20+
- Docker Desktop (aberto e em execução)

## Primeira vez

```bash
npm install
npm run db:start
```

A primeira execução demora porque baixa as imagens do Docker.

## Testes

- `npm run db:test`: testes do banco (pgTAP).
- `npm test`: testes das funções (Vitest).

## Resetar o banco

```bash
npm run db:reset
```

## Notificações push

A Edge Function `enviar-push` (`supabase/functions/enviar-push`) envia à Expo as notificações com `push_enviado_em` nulo (criadas nas últimas 24 h). Um job do pg_cron (`enviar-push`, a cada minuto) a chama via `pg_net`. O job só faz algo se existirem dois segredos no Vault: `project_url` e `service_role_key`.

Crie os segredos (SQL Editor ou `psql`):

```sql
select vault.create_secret('<URL>', 'project_url');
select vault.create_secret('<CHAVE>', 'service_role_key');
```

- **Local:** `<URL>` = `http://host.docker.internal:54321` e `<CHAVE>` = a `service_role key` mostrada pelo `npm run db:start`. Em outro terminal, rode `npx supabase functions serve enviar-push`.
- **Produção:** `<URL>` = URL do projeto (`https://<ref>.supabase.co`) e `<CHAVE>` = a chave de serviço (service_role). Publique a função com `npx supabase functions deploy enviar-push`.

Teste manual: `curl -X POST http://127.0.0.1:54321/functions/v1/enviar-push -H "Authorization: Bearer <service_role_key>"` responde `{"enviadas":0,"semToken":0}`.
