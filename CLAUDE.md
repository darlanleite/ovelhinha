# 🐑 Ovelhinha — Sistema de Gestão Kids para Igrejas

## Visão Geral
Sistema web para igrejas gerenciarem a área kids com pulseiras de LED (ESP32-C3 + BLE).
Pais deixam seus filhos na área kids e recebem uma pulseira numerada. Quando há algum problema,
a equipe aciona a pulseira do pai pelo sistema, que acende o LED. O pai vai até a recepção.

**Tagline:** "Cada criança, no lugar certo."
**Site em produção:** https://ovelhinha-olive.vercel.app
**Repositório:** https://github.com/darlanleite/ovelhinha

---

## Stack Técnica
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (auth only — persist no localStorage via `useAppStore`)
- React Query (@tanstack/react-query) — estado do servidor
- Supabase (banco de dados + realtime)
- `react-qr-code` — geração de QR Code na etiqueta de impressão
- `html5-qrcode` — leitura de QR Code via câmera na TiaDaSala
- React Router DOM
- Recharts (gráficos)
- Sonner (toast notifications)
- Deploy: Vercel (auto-deploy via push no GitHub → branch `main`)

---

## Estrutura de Pastas
```
src/
  pages/          → telas do sistema
  components/
    OvelhinhaLogo.tsx   → logo SVG
    DashboardLayout.tsx → sidebar + header
    PrintableLabel.tsx  → etiqueta de impressão (print:flex, hidden em tela)
  store/
    useAppStore.ts  → auth apenas (role + tiaRoom), persiste localStorage
    useStore.ts     → store legado (não usado nas páginas novas)
    types.ts        → interfaces TypeScript
    mockData.ts     → dados mock (legado)
  hooks/
    useChildren.ts  → CRUD crianças via Supabase + realtime
    useCalls.ts     → CRUD chamadas via Supabase + realtime
    useBracelets.ts → CRUD pulseiras via Supabase + realtime
    useChurch.ts    → configurações + salas via Supabase
    useReports.ts   → histórico de cultos via Supabase
  lib/
    supabase.ts     → cliente Supabase + CHURCH_ID
    esp32.ts        → acionarPulseira / encerrarPulseira (HTTP → backend local)
  App.tsx         → rotas e providers
  index.css       → estilos globais
server/
  index.js        → backend Express + WebSocket (porta 3001)
  gateway.js      → gateway BLE (Node.js + @stoprocent/noble)
firmware/
  pulseira-ble/   → firmware ESP32-C3 (Arduino)
```

---

## Variáveis de Ambiente
```
VITE_SUPABASE_URL=https://reefzadzwbmhkojtjqhz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  (Settings → API → anon public)
VITE_CHURCH_ID=00000000-0000-0000-0000-000000000001
VITE_BACKEND_URL=https://<ngrok-url>.ngrok-free.dev
```

**Atenção:** `VITE_CHURCH_ID` não pode ter espaço no final — causa erro 400 no Supabase.

---

## Supabase

### Projeto
- URL: `https://reefzadzwbmhkojtjqhz.supabase.co`
- Church ID: `00000000-0000-0000-0000-000000000001`

### Tabelas principais
| Tabela | Descrição |
|--------|-----------|
| `churches` | Nome e slug da igreja |
| `church_settings` | `daily_code`, `reactivate_minutes` (separado de churches) |
| `rooms` | Salas (emoji, name, age_range) |
| `children` | Crianças cadastradas no culto |
| `guardians` | Responsáveis (FK → children) |
| `bracelets` | Pulseiras com status e bateria |
| `calls` | Chamadas abertas/respondidas |
| `service_history` | Histórico por culto (usa `service_date`, não `date`) |

### Permissões RLS necessárias
Além das políticas RLS, a role `anon` precisa de GRANT explícito:
```sql
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT, UPDATE, DELETE ON children, guardians, calls, bracelets, rooms, church_settings, service_history TO anon;
```

### Realtime
Cada hook usa canal com nome único por instância (`${tabela}-${CHURCH_ID}-${Date.now()}`)
para evitar conflito quando o mesmo hook é montado em múltiplos componentes simultaneamente.

---

## Rotas do Sistema
| Rota | Componente | Acesso |
|------|-----------|--------|
| `/` | Login | Público |
| `/dashboard` | Dashboard | reception |
| `/cadastro` | Cadastro | reception |
| `/acionar` | Acionar | reception |
| `/pulseiras` | Pulseiras | reception |
| `/relatorios` | Relatorios | reception |
| `/configuracoes` | Configuracoes | reception |
| `/tia` | TiaDaSala | tia |

**Autenticação:** roles `reception` e `tia`. Tia usa código de 4 dígitos do dia gerado pela recepção.

---

## Identidade Visual — Ovelhinha

### Cores (usar exatamente esses valores)
```
Primária · Azul Céu:    #5B8CFF  → botões, header, links
Secundária · Âmbar:     #FFB347  → pulseira, badges
Sucesso · Verde Mint:   #3ECFAA  → confirmações, "pai chegou"
Urgência · Coral:       #FF6B6B  → chamadas abertas, alertas
Background · Lã:        #F0EDE8  → fundo login, cards neutros
Background alt:         #F8F9FC  → fundo principal
Texto principal:        #1A1F36
Texto secundário:       #6B7280
Borda:                  #E8EAF0
```

### Tipografia
- Títulos/Logo: **Nunito** (peso 800/900, letter-spacing -0.02em)
- Corpo: **DM Sans** (peso 400/500)
- Números/Códigos: **DM Mono**

### Logo
A logo é uma ovelha SVG estilizada com:
- Corpo de lã: círculos sobrepostos em #F0EDE8
- Rosto: elipse em #5B8CFF com olhinhos brancos
- Pulseirinha no braço: retângulo em #FFB347 (referência ao produto)
- Perninhas: #D9D4CC
- Componente: `src/components/OvelhinhaLogo.tsx` (props: size, white)

---

## Interfaces TypeScript (types.ts)

```typescript
Child {
  id, name, birthDate, roomId, medicalNotes
  guardians: Guardian[]
  braceletNumber: string | null
  authorizedPickup: string | null
  status: 'present' | 'called' | 'left'
  checkedInAt: string
}

Guardian { id, name, phone }

Bracelet {
  id, number
  espId: string | null       // MAC address do ESP32
  status: 'available' | 'in-use' | 'charging' | 'offline'
  battery: number            // 0-100
  guardianName: string | null
  childId: string | null
  lastHeartbeat: string | null   // mapeado de last_seen_at no DB
  connectivityStatus: 'online' | 'warning' | 'unreachable'  // derivado
  lastGatewayId: string | null
}

Call {
  id, childId, braceletNumber
  roomId: string
  reason, reasonIcon
  status: 'open' | 'answered' | 'reactivated'
  answeredBy: 'reception' | 'tia' | null
  createdAt, answeredAt: string | null
}

Room { id, name, emoji, ageRange }

ServiceHistory { id, date, serviceName, childrenCount, callsCount }

AppSettings { churchName, reactivateMinutes, dailyCode }
```

---

## Hooks Supabase

### useChildren
- `children` — lista todas as crianças do culto atual com guardians
- `addChild(child, guardians)` — insere criança + guardians + atualiza bracelet
- `updateChild(id, updates)` — atualiza status, braceletNumber etc.
- `checkInChild(id, braceletNumber, roomId)` — reativa criança existente (status→present, vincula pulseira)

### useCalls
- `calls`, `openCalls` — chamadas do culto
- `addCall({childId, braceletNumber, roomId, reason, reasonIcon})`
- `answerCall(callId, answeredBy)` — tenta RPC `answer_call`, fallback manual
- `reactivateCall(callId)`

### useBracelets
- `bracelets`, `stats` — pulseiras com connectivityStatus derivado de `last_seen_at`
- `updateBracelet(id, updates)`
- `addBracelet(bracelet)`
- `connectivityStatus` derivado: `online` (<30s), `warning` (30-90s), `unreachable` (>90s)

### useChurch
- `settings` — combina `churches` (name) + `church_settings` (daily_code, reactivate_minutes)
- `rooms` — salas da igreja
- `updateSettings` — atualiza tabelas corretas separadamente
- `generateDailyCode()`, `addRoom()`, `removeRoom()`, `novoCulto()`
- `novoCulto()` — **não deleta crianças**. Marca todas como `left`, limpa bracelet_number, libera pulseiras, apaga chamadas, salva service_history. Cadastros são preservados para check-in recorrente.

### useReports
- `history` — histórico de cultos (campo `service_date` no DB, mapeado para `date` no tipo)

---

## Backend Local (server/)

### server/index.js — porta 3001
- `POST /api/acionar` — body: `{ braceletId, reason }` → acende LED via BLE
- `POST /api/encerrar` — body: `{ braceletId }` → apaga LED via BLE
- WebSocket broadcast para gateways BLE conectados

### server/gateway.js — BLE gateway
- Usa `@stoprocent/noble` (funciona com Node.js v24 + macOS Sequoia)
- Conecta aos ESP32-C3 via BLE e envia comandos 0x01 (acionar) / 0x02 (encerrar)

### Expor para produção via ngrok
```bash
ngrok http 3001
```
Atualizar `VITE_BACKEND_URL` no `.env` com a URL do ngrok.

---

## Firmware ESP32-C3 (firmware/pulseira-ble/)

### LED RGB — Ânodo comum
- Pino mais longo (ânodo) → 3V3
- LOW = acende, HIGH = apaga
- Pinos: PIN_R=2, PIN_G=3, PIN_B=4 (B e R estavam invertidos fisicamente)

### Cores por motivo
- Vermelho = Urgência
- Amarelo = Banheiro / outros
- Verde = confirmação

### Comandos BLE
- `0x01` = acionar (acende LED)
- `0x02` = encerrar (apaga LED)

---

## Arquitetura de Hardware (ESP32-C3)

```
[Tablet da recepção / Mobile da tia]
        ↓ HTTPS (Supabase Realtime)
[Supabase] ← banco de dados + sync entre dispositivos

[Tablet da recepção]
        ↓ HTTP (ngrok → localhost:3001)
[Backend Node.js — server/index.js]
        ↓ WebSocket
[Gateway BLE — server/gateway.js]
        ↓ BLE 5.0
[Pulseiras dos pais — ESP32-C3 + LED RGB]
```

### Componentes por pulseira
- ESP32-C3 Super Mini (~R$14)
- LED RGB 5mm ânodo comum (~R$2)
- Bateria LiPo 3.7V 500mAh (~R$15)
- Módulo TP4056 USB-C (~R$5)
- Resistores 220Ω

---

## Funcionalidades — 31 no total, 4 fases

### ✅ Fase 1 — MVP (concluído)
- 1.1 Cadastro rápido na chegada
- 1.3 Modo sem impressora (número sequencial)
- 2.1 Chamar pelo nome ou número
- 3.1 Dashboard em tempo real
- Hardware: LED acende/apaga

### 🔵 Fase 2 — Muito útil
- 1.2 Impressão de etiqueta (nome + QR Code + número)
- 1.4 Múltiplos responsáveis
- 1.5 Cadastro recorrente (check-in em 1 clique)
- 2.2 Chamar por QR Code
- 2.3 Motivo da chamada com cor (🚽🤒😢⚠️🍼📝) ✅
- 2.5 Reacionamento automático
- 4.1 Login da tia por código de 4 dígitos ✅
- 4.2 Scanner de QR Code nativo no celular
- 4.3 Busca por nome ou número ✅
- 4.4 Lista só da sua turma ✅
- 4.5 Notificação de confirmação no celular da tia

### 🟡 Fase 3 — Segurança
- 2.4 Encerrar chamada ("Pai chegou" → pulseira apaga) ✅
- 3.2 Lista de crianças presentes com filtros ✅
- 3.3 Gestão de pulseiras (status + bateria) ✅
- 3.4 Check-out por pulseira
- 3.5 Histórico e relatórios por culto ✅
- 3.6 Configurações do sistema ✅
- 5.1 Liberação de saída por pulseira
- 5.2 Autorização de terceiros
- 5.3 Alerta de pulseira fora do alcance ✅ (connectivityStatus)
- 5.4 Log de todos os eventos

### ⚪ Fase 4 — Crescimento futuro
- 6.1 Notificação por WhatsApp automático
- 6.2 Múltiplas igrejas / filiais
- 6.3 Presença e frequência mensal
- 6.4 Integração com sistemas da igreja
- 6.5 Vibração na pulseira (motor haptic)
- 1.6 Foto da criança no cadastro

---

## Status do Projeto

### ✅ Concluído — Fase 1
- Interface web completa (todas as 8 telas)
- Migração completa para Supabase (banco + realtime)
- Auth com Zustand (`useAppStore`) — role + tiaRoom
- Hooks Supabase: useChildren, useCalls, useBracelets, useChurch, useReports
- Sincronização em tempo real entre dispositivos via Supabase Realtime
- Backend Node.js com API REST (acionar/encerrar LED)
- Gateway BLE com @stoprocent/noble
- Firmware ESP32-C3 com LED RGB ânodo comum
- Deploy automático no Vercel via GitHub (ovelhinha-olive.vercel.app)
- Fluxo completo testado: cadastro → acionar → LED acende → pai chegou → LED apaga

### ✅ Concluído — Fase 2
- **Cadastro recorrente:** `novoCulto` preserva crianças (status→left), `checkInChild` reativa no próximo culto
- **Cadastro.tsx refatorado:** modo `new | existing` — busca dinâmica no Supabase, crianças já no culto aparecem com tag "NO CULTO" e bloqueadas, QR Code real com `react-qr-code`
- **Impressão de etiqueta:** `PrintableLabel.tsx` com nome, sala, número da pulseira e QR Code — usa `window.print()` + classes Tailwind `print:flex` / `print:hidden`
- **Scanner QR Code na TiaDaSala:** `html5-qrcode` lê UUID do QR Code e abre automaticamente o painel de motivos da criança correspondente
- **Desvincular pulseira em Pulseiras.tsx:** botão "Desvincular" em pulseiras `in-use` chama `updateChild` (status→left) e libera a bracelet

### ⏳ Próximos passos
- Check-out por pulseira (criança só sai com par correto)
- Reacionamento automático após X minutos
- Notificação por WhatsApp

---

## Convenções de Código
- Componentes: PascalCase (`DashboardLayout.tsx`)
- Hooks: camelCase com prefixo use (`useChildren.ts`)
- Toast com ícone 🐑: `toast("Pulseira #07 acionada! 🐑")`
- Dados do servidor: sempre via hooks Supabase, nunca via `useStore` legado
- Canais realtime: sempre com nome único por instância (`${tabela}-${CHURCH_ID}-${Date.now()}`)
