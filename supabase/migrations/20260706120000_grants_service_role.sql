-- service_role (backend/edge functions) precisa de privilégios explícitos:
-- com "Automatically expose new tables" desabilitado no projeto, nenhum role
-- recebe grant automático — authenticated/anon já são tratados na migração
-- de RLS; aqui garantimos o service_role (ele bypassa RLS, mas não bypassa
-- privilégios de tabela).

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
