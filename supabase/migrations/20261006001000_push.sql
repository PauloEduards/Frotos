-- Envio de push: chama a Edge Function enviar-push a cada minuto.
-- Requer os segredos 'project_url' e 'service_role_key' no Vault (ver README).
-- Sem os segredos, o comando do job não faz nada.
create extension if not exists pg_net;

select cron.schedule(
  'enviar-push',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key')
  $$
);
