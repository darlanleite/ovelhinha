# 🐑 Ovelhinha — Plano de Comercialização

> **Como usar:** cada item tem um dono. Quando concluir, risca: `- [x] ~~item~~`.
> **[C]** = Claude executa · **[D]** = Darlan executa · **[C+D]** = Claude prepara, Darlan finaliza (ex.: eu escrevo firmware, você grava e testa)
>
> Prioridades: **P0** = bloqueia comercialização · **P1** = necessário para piloto pago · **P2** = escala/crescimento

---

## 🖥️ SOFTWARE — Claude lista, planeja e resolve

### P0 — Segurança (bloqueadores)

- [ ] **[C]** Supabase Auth real — conta por igreja, papéis (admin / recepção / tia), login com e-mail+senha, código do dia validado no servidor
- [ ] **[C]** RLS de verdade — políticas por `church_id` extraído do JWT, remover `USING (true)` e GRANTs abertos para `anon`
- [ ] **[C]** Remover dicas de senha/código da tela de login (`Login.tsx`) e senha hardcoded `1234`
- [ ] **[C]** Restringir CORS da edge function `notify-call` (hoje é `*`)
- [ ] **[C]** Remover `.env` e `config.h` do histórico do git + adicionar ao `.gitignore`
- [ ] **[D]** Rotacionar chaves no dashboard do Supabase (anon key exposta) e trocar a senha do Wi-Fi de casa (está commitada em `firmware/gateway-esp32/config.h`)

### P0 — LGPD (dados de crianças)

- [ ] **[C]** Consentimento dos pais no fluxo de cadastro (checkbox + texto + registro com timestamp)
- [ ] **[C]** Política de retenção — anonimizar/apagar notas médicas e telefones após X dias (job ou trigger)
- [ ] **[C]** Rascunho de Política de Privacidade e Termos de Uso (para o advogado revisar)
- [ ] **[D]** Revisão jurídica dos termos (advogado — ver seção Negócio)

### P1 — Funcionalidades que fecham a promessa do produto

- [ ] **[C]** Check-out verificado por pulseira — criança só sai com o par pulseira↔responsável correto (itens 3.4 + 5.1 do roadmap)
- [ ] **[C]** Log de auditoria imutável — check-in, chamada, resposta, check-out, quem fez, quando (item 5.4)
- [ ] **[C]** Autorização de terceiros para retirada (item 5.2)
- [ ] **[C]** Alerta proativo de gateway offline (heartbeat já existe — falta o alarme na UI + push)

### P1 — Qualidade e dívida técnica

- [ ] **[C]** Corrigir bug multi-gateway — remover `patchCommandStatus(id, "sent")` prematuro do `pollCommands()` (já documentado no CLAUDE.md)
- [ ] **[C]** Remover código legado — `server/index.js`, `server/gateway.js`, `useStore`, `mockData`, `SyncBridge` (Supabase é o único caminho de sync)
- [ ] **[C]** Testes E2E (Playwright) dos 3 fluxos críticos: cadastro→check-in, acionar→pai chegou, novo culto
- [ ] **[C]** Testes unitários dos hooks (useCalls, useChildren, useBracelets)
- [ ] **[C]** Higiene do repo — README real, renomear `package.json` (está `vite_react_shadcn_ts`), remover `dist/` do versionamento

### P2 — Multi-tenancy e escala

- [ ] **[C]** Onboarding self-service — cadastro de igreja cria tenant, salas padrão, primeiro admin
- [ ] **[C]** Fluxo de pareamento de pulseira sem digitar MAC — pulseira nova entra em modo pareamento, app descobre e vincula
- [ ] **[C]** Painel super-admin (suas métricas: igrejas ativas, gateways online, uso)
- [ ] **[C]** Multi-filial (item 6.2) — uma conta, N campi
- [ ] **[C]** Modo degradado offline — recepção opera local se a internet cair, sincroniza depois
- [ ] **[C]** Notificação WhatsApp (item 6.1) — via API oficial Meta ou gateway tipo Z-API
- [ ] **[C]** Staging separado de produção (segundo projeto Supabase + preview deploy)
- [ ] **[C]** Landing page comercial (o domínio hoje aponta direto pro app)

### Firmware (código = eu, gravar/testar = você)

- [ ] **[C+D]** OTA de firmware — mudar partition scheme para com-OTA e implementar update remoto (pré-requisito para frota em campo)
- [ ] **[C+D]** Telemetria real de bateria — leitura ADC do divisor → campo `battery` no heartbeat (hoje o valor não vem do dispositivo)
- [ ] **[C+D]** Modo pareamento na pulseira (advertising com nome identificável para o fluxo de vínculo sem MAC)
- [ ] **[C+D]** Suporte a motor de vibração no firmware da pulseira (comando + PWM)
- [ ] **[C+D]** Otimização de consumo — intervalo de advertising maior + modem sleep (meta: >30h por carga)

---

## 🔌 HARDWARE — Claude planeja e especifica, Darlan executa

### Avaliação do engenheiro (estado atual → recomendação)

**Veredito geral:** a plataforma ESP32-C3 está **correta** para este produto. Não migre de chip agora — o firmware funciona, o custo é imbatível, e o caso de uso (pulseira ligada só durante o culto, recarga semanal) não exige o consumo de um nRF52. O que precisa mudar é a **integração** (PCB + bateria segura + case), não a arquitetura.

| Item | Hoje (protótipo) | Recomendação v2 (produção) | Por quê | Custo aprox. (qty 100) |
|---|---|---|---|---|
| MCU/BLE | ESP32-C3 Super Mini (placa genérica) | **Módulo ESP32-C3-MINI-1 (Espressif)** em PCB própria | Módulo oficial tem homologação Anatel — simplifica MUITO a certificação do produto final. Mantém 100% do firmware | ~R$12 |
| Carregador | Módulo TP4056 avulso | TP4056 (SOP-8) + DW01A + FS8205 **na PCB** (ou MCP73831) | Proteção contra sobrecarga/sobredescarga/curto integrada; elimina módulo pendurado | ~R$2 |
| Bateria | LiPo 3.7V 500mAh sem proteção | **LiPo 502530 400–500mAh COM PCM integrado** | PCM na célula = segunda camada de proteção. LiPo com PCM + case fechado é o padrão de todo smartwatch — não precisa LiFePO4 | ~R$14 |
| Regulador | (direto da placa) | LDO 3.3V de baixo IQ: **ME6211 / HT7833 / XC6220** | IQ de ~40µA vs. AMS1117 (~5mA) — importa para standby | ~R$0,50 |
| LED | RGB 5mm ânodo comum + 3 resistores | RGB SMD 5050 (mesmo esquema) — *ou* WS2812B-2020 se quiser simplificar trilhas | 5050 é mais barato e sem consumo quiescente (WS2812 gasta ~1mA parado) | ~R$0,50 |
| Vibração | — (não tem) | **Motor coin 1027** + MOSFET AO3400 + diodo 1N4148 | Transforma o produto: pai é avisado sem olhar o pulso. R$4 de BOM, valor percebido enorme | ~R$4 |
| Medição bateria | — (campo fake no banco) | Divisor 1MΩ/1MΩ + 100nF → ADC | Custo de centavos, dado real de bateria no dashboard | ~R$0,10 |
| Conector carga | USB-C do módulo | **Fase 1:** USB-C na PCB (só carga, resistores 5.1kΩ em CC1/CC2) · **Fase 2:** pogo pins p/ dock | USB-C primeiro (zero engenharia de dock); pogo pins quando tiver volume | ~R$1,50 |
| **BOM total pulseira** | ~R$36 (módulos) | **~R$35–45 montada** (PCB 2 camadas + SMT na JLCPCB) | Mesma faixa de custo, produto de verdade | |

**Gateway:** manter o v2 (captive portal está ótimo). Duas melhorias recomendadas:
1. Considerar **ESP32-WROOM-32E** (dual-core clássico) no lugar do C3 — coexistência BLE+WiFi muito melhor (o C3 divide um rádio single-core; o CLAUDE.md já documenta as dores). Porte do firmware é trivial (mesmo Arduino/NimBLE). Também homologado Anatel.
2. Variante com **Ethernet (W5500, ~R$15)** para igrejas com Wi-Fi ruim — o gateway é infraestrutura crítica de domingo.

**Dock de carga (operação semanal):**
- Fase 1 (piloto): hub USB de 10 portas + cabos curtos USB-C (~R$150, zero engenharia) ✅ suficiente
- Fase 2 (produto): dock custom com pogo pins, 10–20 slots

**Autonomia estimada (cálculo):** ESP32-C3 conectável com modem sleep ≈ 15–20mA médio → 500mAh ≈ **25–30h ligada ≈ 8–10 cultos por carga**. Com otimização de advertising, >30h. Adequado para recarga semanal.

### Checklist de execução — Hardware

#### P1 — Pulseira v2 (piloto)

- [ ] **[C]** Esquemático completo da pulseira v2 (KiCad) — MCU + carga + proteção + LED + motor + ADC bateria
- [ ] **[C]** Layout da PCB (2 camadas, formato de pulseira ~40×25mm, antena do módulo com keep-out correto)
- [ ] **[C]** Gerar Gerber + BOM + arquivo de posicionamento para JLCPCB SMT
- [ ] **[D]** Pedido na JLCPCB (protótipo: 10 unidades montadas, ~US$60–90 total)
- [ ] **[D]** Comprar baterias LiPo 502530 com PCM (AliExpress/Mercado Livre) e pulseiras de silicone 20mm padrão relógio
- [ ] **[C]** Modelo 3D do case (para impressão — SLA/resina para piloto; desenho já pensando em injeção futura)
- [ ] **[D]** Imprimir cases (impressora própria ou serviço tipo 3D Lab / local)
- [ ] **[C+D]** Montagem final + teste funcional das 10 unidades (eu escrevo o checklist de teste, você executa)
- [ ] **[C+D]** Teste de estresse: queda, suor/umidade, criança puxando, autonomia real medida

#### P1 — Gateway v2.1

- [ ] **[C]** Portar firmware gateway_v2 para ESP32-WROOM-32E (mudanças mínimas)
- [ ] **[D]** Comprar 2× DevKit ESP32-WROOM-32E para validação
- [ ] **[C]** Case do gateway (modelo 3D, com fixação de parede)
- [ ] **[C+D]** Validar 2 gateways simultâneos com claim atômico corrigido (depende do fix de firmware da seção Software)

#### P2 — Certificação e produção

- [ ] **[D]** Contatar um OCD (Organismo de Certificação Designado) para orçar homologação Anatel — usar módulo Espressif homologado barateia; estimar R$5–15k e 2–4 meses. **Começar cedo: é o item de maior lead time**
- [ ] **[C]** Dossiê técnico para a certificação (esquemáticos, BOM, datasheets, manual)
- [ ] **[D]** Cotar injeção plástica do case (mín. viável ~500–1000 un) ou manter SLA em pequena escala
- [ ] **[C]** Projeto do dock de carga com pogo pins (fase 2)
- [ ] **[D]** Definir fornecedor de montagem em volume (JLCPCB/PCBWay seguem viáveis até ~1000 un)

---

## 📋 NEGÓCIO / LEGAL — Darlan executa (Claude prepara material)

- [ ] **[D]** Advogado: revisar termos, definir posicionamento "sistema de comunicação" vs. "sistema de segurança" (responsabilidade civil), enquadramento LGPD para dados de menores
- [ ] **[C]** Preparar proposta de precificação (SaaS + comodato de hardware) com 2–3 cenários para você decidir
- [ ] **[D]** Definir meio de pagamento (Stripe / Asaas / Pagar.me)
- [ ] **[D]** Recrutar 2–3 igrejas para piloto pago (sugestão: começar pela sua rede de contatos/denominação)
- [ ] **[C]** Material de venda — one-pager PDF + roteiro de demo
- [ ] **[D]** CNPJ / enquadramento fiscal para vender assinatura + hardware
- [ ] **[D]** Suporte de fim de semana — definir canal (WhatsApp) e quem atende no domingo

---

## 📊 Sequência recomendada

```
AGORA ──► Sprint 1: Segurança (Auth + RLS + limpar segredos)      [C + rotação de chaves D]
      ──► Sprint 2: Check-out + audit log + fix multi-gateway      [C]
      ──► Sprint 3: PCB v2 projetada + pedido JLCPCB               [C projeta, D pede]
      ──► Sprint 4: Piloto em 2–3 igrejas (hardware atual + case)  [D recruta, C suporta]
PARALELO: Anatel (maior lead time — iniciar já)                    [D contata OCD]
```

---

*Última atualização: 2026-07-06 — criado por Claude*
