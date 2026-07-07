# Política de Privacidade — Ovelhinha

> **RASCUNHO para revisão jurídica — não publicar sem aprovação de advogado.**
> Pontos que exigem decisão do advogado estão marcados com ⚖️.

*Última atualização: [DATA]*

## 1. Quem somos

O **Ovelhinha** ("nós") é um sistema de gestão do ministério infantil usado por
igrejas ("Igreja") para registrar a presença de crianças e comunicar os
responsáveis durante os cultos, por meio de pulseiras com aviso luminoso.

⚖️ *Definir enquadramento: a Igreja é a **controladora** dos dados e o
Ovelhinha atua como **operador** (art. 5º, VI e VII, LGPD).*

## 2. Quais dados tratamos

| Dado | De quem | Finalidade |
|---|---|---|
| Nome e data de nascimento | Criança | Identificação durante o culto e alocação por faixa etária |
| Observações de saúde (alergias, medicações) | Criança | Cuidado adequado durante a permanência |
| Nome e telefone | Responsáveis | Contato e chamada durante o culto |
| Nome de pessoa autorizada a buscar | Terceiro indicado | Segurança na entrega da criança |
| Registros de eventos (check-in, chamadas, saídas) | Operação | Segurança e prestação de contas |

Não coletamos fotos, biometria, localização ou qualquer dado além dos listados.

## 3. Base legal

O tratamento de dados de crianças é realizado **com consentimento específico e
em destaque dado por pelo menos um dos pais ou responsável legal**
(art. 14, §1º, LGPD), coletado no ato do cadastro, com registro de data, hora
e identificação de quem consentiu.

⚖️ *Avaliar base legal complementar de legítimo interesse/proteção da vida
para os registros de segurança (auditoria de entrada/saída).*

## 4. Retenção e eliminação

- **Observações de saúde:** apagadas automaticamente **90 dias** após o último
  check-in da criança.
- **Cadastro completo (nome, nascimento, responsáveis):** apagado
  automaticamente após **365 dias** sem check-in.
- **Registros de eventos (auditoria):** mantidos por até **400 dias** para fins
  de segurança, sem dados pessoais além de identificadores internos.
- O responsável pode solicitar a eliminação antecipada a qualquer momento
  (seção 6).

## 5. Compartilhamento

Os dados **não são vendidos nem compartilhados com terceiros**. Ficam
armazenados em infraestrutura de nuvem (Supabase — servidores na região de
São Paulo, Brasil) com acesso restrito por autenticação e controle de acesso
por igreja. ⚖️ *Confirmar cláusulas de suboperador do provedor.*

## 6. Direitos do titular

O responsável pode, a qualquer momento, solicitar à Igreja: acesso aos dados,
correção, eliminação, informação sobre o tratamento e revogação do
consentimento. Canal de contato: **[E-MAIL/TELEFONE DA IGREJA]**.
⚖️ *Definir prazo de resposta e fluxo operacional.*

## 7. Segurança

- Acesso ao sistema somente com autenticação; cada igreja acessa apenas os
  próprios dados (isolamento por políticas de acesso no banco de dados).
- Toda movimentação de crianças (entrada, chamada, saída, inclusive tentativas
  de retirada com pulseira incorreta) é registrada em log imutável.
- Comunicação criptografada (HTTPS/TLS) em todas as camadas.

## 8. Encarregado (DPO)

⚖️ *Indicar encarregado pelo tratamento de dados e canal de contato
(art. 41, LGPD).*

**[NOME / E-MAIL DO ENCARREGADO]**
