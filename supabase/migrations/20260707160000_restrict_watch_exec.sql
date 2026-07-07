-- check_gateways_offline é executada pelo pg_cron (superuser); não há
-- razão para a API pública poder invocá-la.
revoke execute on function public.check_gateways_offline() from public, anon, authenticated;
grant execute on function public.check_gateways_offline() to service_role;
