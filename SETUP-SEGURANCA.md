# 🔐 Ativação da Segurança — Passo a Passo

> Este guia ativa o novo modelo de autenticação (migração `20260706_auth_and_rls.sql`
> + frontend refatorado). Siga NA ORDEM. Itens marcados **[D]** são seus;
> **[C]** o Claude executa quando o banco estiver acessível.

## Pré-requisito

- [ ] **[D]** Liberar slot free no Supabase: a conta `projetos.eon@gmail.com` está no
  limite de 2 projetos ativos. Pause/delete um projeto que não usa (samu-app e kinesia
  já estão inativos; verifique se `solargest` pode ser pausado) OU faça upgrade.
  Depois restaure o projeto **ovelhinha** no dashboard.

## Ativação (com o banco de volta)

1. - [ ] **[D]** Dashboard → Authentication → Sign In / Up → habilitar **Anonymous sign-ins**
     (necessário para o login da tia por código do dia).

2. - [ ] **[C]** Aplicar a migração `supabase/migrations/20260706_auth_and_rls.sql`
     (Claude aplica via MCP; ou você cola no SQL Editor).

3. - [ ] **[D]** Criar seu usuário admin: Dashboard → Authentication → Users →
     **Add user** → email `darlanleite50@gmail.com` + senha forte (marque auto-confirm).

4. - [ ] **[C]** Vincular o usuário à igreja (Claude roda via MCP):
     ```sql
     insert into public.profiles (user_id, church_id, role, name)
     select id, '00000000-0000-0000-0000-000000000001', 'admin', 'Darlan'
       from auth.users where email = 'darlanleite50@gmail.com'
     on conflict (user_id) do nothing;
     ```

5. - [ ] **[C]** Redesployar a edge function `notify-call` (versão endurecida) e
     regenerar `src/lib/database.types.ts` a partir do schema real.
     Também verificar: a unique constraint de `push_subscriptions` (o upsert do
     frontend usa `onConflict: 'device_id'` — ajustar se a constraint real for
     composta) e conferir `get_advisors` de segurança do Supabase.

6. - [ ] **[C+D]** Testar localmente (`npm run dev`): login recepção, login tia
     por código, acionar pulseira, pai chegou.

7. - [ ] **[D]** Push para `main` (deploy automático Vercel).

## Rotação de credenciais (depois que tudo funcionar)

> A anon key antiga e a senha do seu Wi-Fi ficaram no histórico público do GitHub.

8. - [ ] **[D]** Dashboard → Settings → API → **rotacionar a anon key (JWT secret)**.
     Atenção: isso invalida a key antiga em TODOS os lugares de uma vez.
9. - [ ] **[D]** Atualizar `VITE_SUPABASE_ANON_KEY` no Vercel (Settings → Environment
     Variables) e no `.env` local → redeploy.
10. - [ ] **[C+D]** Atualizar `SUPABASE_KEY` no `gateway_v2.ino` (Claude edita) e
      regravar o(s) gateway(s) ESP32 via USB (você).
11. - [ ] **[D]** Trocar a senha do Wi-Fi de casa (estava commitada no `config.h`).

## Variáveis de ambiente (novo conjunto)

| Variável | Onde | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + .env | inalterada |
| `VITE_SUPABASE_ANON_KEY` | Vercel + .env | nova, pós-rotação |
| `VITE_VAPID_PUBLIC_KEY` | Vercel + .env | inalterada |
| `VITE_CHURCH_ID` | — | **REMOVIDA** — igreja agora vem do login |
| `VITE_BACKEND_URL` | — | **REMOVIDA** — backend local/ngrok aposentado |
| `ALLOWED_ORIGINS` | Secrets da edge function | ex.: `https://ovelhinha-olive.vercel.app` |

## O que muda no uso diário

- **Recepção:** entra com e-mail e senha (não existe mais senha `1234`).
- **Tia:** digita só o código do dia → escolhe a sala. O código é validado no
  servidor e a tela de login não mostra mais nenhuma dica.
- **Gestor:** exige login de staff (o PIN `1234` foi removido).
- **Dados:** sem login, o banco não devolve NADA (antes era 100% público).
