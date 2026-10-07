begin;
select plan(2);

select is((select schedule from cron.job where jobname = 'enviar-push'), '* * * * *', '1 job enviar-push agendado a cada minuto');
select has_extension('pg_net', '2 pg_net instalada');

select * from finish();
rollback;
