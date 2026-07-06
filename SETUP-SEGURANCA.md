# 🔐 Ativação da Segurança — Passo a Passo

> Este guia ativa o novo modelo de autenticação (migração `20260706_auth_and_rls.sql`
> + frontend refatorado). Siga NA ORDEM. Itens marcados **[D]** são seus;
> **[C]** o Claude executa quando o banco estiver acessível.

## Pré-requisito — PROJETO NOVO em conta nova (decisão 2026-07-06)

> Os 2 slots free de `projetos.eon@gmail.com` estão ocupados por projetos em uso.
> Solução custo zero: **projeto novo na conta pessoal `darlanleite50@gmail.com`**.
> Bônus: URL e chaves novas (a anon key antiga vazou no GitHub e passa a apontar
> para um projeto pausado), e o schema inteiro nasce versionado em migrações.
> O projeto antigo (`reefzadzwbmhkojtjqhz`) fica pausado como arquivo morto.
>
> Antes do piloto com igreja real: migrar a org para Pro (~US$25/mês) — free
> pausa após ~1 semana sem uso.

- [ ] **[D]** Criar conta no [supabase.com](https://supabase.com) com
  `darlanleite50@gmail.com` (free, sem cartão)
- [ ] **[D]** Criar projeto **ovelhinha** (região **South America (São Paulo)**;
  guarde bem a senha do banco)
- [ ] **[D]** Convidar `projetos.eon@gmail.com` para a organização com papel
  **Developer** (Settings → Team → Invite) — é o que permite ao Claude operar o
  banco via MCP. IMPORTANTE: papel Developer, NÃO Owner/Admin (Owner/Admin
  contaria no limite free daquela conta).

## Ativação (com o projeto novo criado)

1. - [ ] **[D]** Dashboard → Authentication → Sign In / Up → habilitar **Anonymous sign-ins**
     (necessário para o login da tia por código do dia).

2. - [ ] **[C]** Aplicar as migrações na ordem (Claude aplica via MCP; ou cole no SQL Editor):
     `20260101000000_schema_base.sql` → `20260409_add_gateway_delivery.sql` →
     `20260410_unique_gateway_name.sql` → `20260706_auth_and_rls.sql`

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

## Credenciais novas (o projeto novo JÁ resolve a rotação)

> A anon key antiga que vazou no GitHub aponta para o projeto pausado — inofensiva.
> Basta apontar tudo para o projeto novo:

8. - [ ] **[C+D]** Atualizar `.env` local com URL + anon key do projeto novo
     (Claude escreve se tiver acesso MCP; os valores estão em Settings → API).
9. - [ ] **[D]** Atualizar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel
     (Settings → Environment Variables) → redeploy.
10. - [ ] **[C+D]** Atualizar `SUPABASE_URL`/`SUPABASE_KEY` no `gateway_v2.ino`
      (Claude edita) e regravar o(s) gateway(s) ESP32 via USB (você).
      O `CHURCH_ID` não muda — o seed usa o mesmo UUID.
      Redigitar os `esp_id` das pulseiras em Configurações → ESP32.
11. - [ ] **[D]** Trocar a senha do Wi-Fi de casa (estava commitada no `config.h`
      antigo, que segue visível no histórico público do GitHub).
12. - [ ] **[D]** (Opcional, mais tarde) Deletar o projeto antigo `reefzadzwbmhkojtjqhz`
      quando tiver certeza de que nenhum dado antigo será necessário.

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
