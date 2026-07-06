# 🐑 Ovelhinha

**Cada criança, no lugar certo.**

Sistema de gestão kids para igrejas: check-in de crianças com pulseiras BLE de LED.
Os pais recebem uma pulseira numerada ao deixar os filhos na área kids; quando a
criança precisa deles, a equipe aciona a pulseira pelo sistema e o LED acende com
a cor do motivo.

## Arquitetura

```
[App web (recepção/tia)] ──HTTPS──► [Supabase: banco + realtime + push]
                                          ▲ poll 2s
                              [Gateway ESP32-C3 (Wi-Fi + BLE)]
                                          │ BLE
                              [Pulseiras ESP32-C3 + LED RGB]
```

- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui (PWA, deploy Vercel)
- **Backend:** Supabase (Postgres + RLS + Realtime + Edge Functions)
- **Hardware:** ESP32-C3 (pulseiras e gateway), firmware Arduino em `firmware/`

## Desenvolvimento

```bash
npm install
cp .env.example .env   # preencha com as chaves do seu projeto Supabase
npm run dev
```

Testes e qualidade:

```bash
npm test           # vitest
npm run lint       # eslint
npm run build      # build de produção
```

## Firmware

- `firmware/pulseira-ble/` — pulseiras (LED RGB, protocolo BLE de 1 byte)
- `firmware/gateway_v2/` — gateway atual (provisionamento por captive portal)
- `firmware/gateway-esp32/` — gateway v1 (backup; requer `config.h`, veja `config.h.example`)

Detalhes de compilação, pinagem e armadilhas do NimBLE: veja `CLAUDE.md`.

## Documentação

- `CLAUDE.md` — documentação técnica completa do projeto
- `PLANO.md` — plano de comercialização e checklist de trabalho
