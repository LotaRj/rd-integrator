---
name: rd-integrator
description: >-
  Projeto rd-integrator — backend Express que encaminha conversões para a API v2
  do RD Station. Use ao criar ou editar landing pages HTML que publicas no RD
  Station (arquivo único), ao integrar formulários com POST /convert, ou ao
  explicar integração do servidor com LPs.
---

# RD Integrator — contexto do projeto

Skill em `.cursor/skills/rd-integrator/` para o Cursor carregar no contexto deste repositório.

## O que é

Repositório com:

1. **`server/`** — API Node (Express) com rota **`POST /convert`**. Recebe JSON da landing page, monta o envelope da API 2.0 da RD (`event_type: CONVERSION`, `event_family: CDP`) e envia para **`https://api.rd.services`**: se `RD_TOKEN` parecer JWT (três partes com `.`), usa **OAuth** (`platform/events?event_type=conversion` + Bearer); senão usa **Chave de API** (`platform/conversions?api_key=`). Nunca misturar JWT na query `api_key`.
2. **`landing-pages/`** — HTML/CSS de LPs de referência (ex.: `skyderm/skyderm-lp.html`). O conteúdo costuma ser **colado ou publicado no RD Station** como **um único arquivo** (ou HTML sem dependência de `script src` externo no mesmo host).

A lógica de negócio da conversão (identificador da conversão, campos customizados `cf_*`, tags) fica na **LP + configuração no RD**; o servidor só **normaliza e encaminha**.

## Restrição importante: LP no RD Station

Quando a LP vai **direto para o RD**, em geral **não há** `script src` para JS externo confiável. Toda a integração com a API deve ficar **no mesmo HTML**: um `<script>` no final do `body` com o `fetch` (ou o bloco IIFE de coleta de formulário + `fetch`, como em `landing-pages/skyderm/skyderm-lp.html`).

- Campos do formulário: use `name` igual à chave do JSON da API (`nome`, `email`, `celular`, `cf_*`, etc.) ou `data-rd-field` para sobrescrever a chave.
- No `<form>`: `data-rd-integrator`, `data-rd-api-url`, `data-rd-lp`, opcional `data-rd-tags`, `data-rd-success-id` — o script inline lê esses atributos.

Se o RD só aceitar um bloco, **inline também o CSS** (`<style>`) e remova `<link href=...>` se necessário.

## Contrato `POST /convert`

- **URL na LP:** `https://rd-integrator-production.up.railway.app/convert` (ajustar em `data-rd-api-url`).
- **Headers:** `Content-Type: application/json`.
- **Obrigatórios no body:** `lp` (identificador da conversão no RD), `email`, e **`nome` ou `name`**.
- **Opcionais mapeados no servidor:** `celular` | `mobile_phone` | `phone` → `mobile_phone` no RD; `cidade` | `city` → `city`.
- **Outros campos** (ex.: `cf_especialidade`) são repassados ao payload da conversão.
- **`tags`:** string `"a,b"` ou array; se vazio/omitido, o servidor usa `[lp]`.

Implementação: [`server/lib/rdPayload.js`](server/lib/rdPayload.js) (`buildRdEnvelopeFromConvertBody`). Comentários de contrato e env: [`server/server.js`](server/server.js).

## CORS e porta

O servidor usa **CORS permissivo** (`origin: true`) e escuta sempre na **porta 3000**. Não há lista de origens nem `PORT` configurável por variável — qualquer domínio da LP pode fazer `POST /convert` desde que aponte para a URL correta do backend.

O **token** da API RD (`RD_TOKEN`) fica só no servidor: em local, ficheiro **`server/.env`** com `RD_TOKEN=...` (o `server.js` carrega com `dotenv` a partir dessa pasta); em produção, variável no painel do host. Nunca no HTML.

## Checklist para uma LP nova (para a IA seguir)

1. Criar/editar um **único** HTML (ou HTML + CSS inline se o canal exigir).
2. Formulário com `data-rd-api-url` apontando para o backend em produção; `data-rd-lp` igual ao **identificador de conversão** configurado no RD.
3. Inputs com `name` alinhado ao contrato (`nome`/`name`, `email`, `cf_*`, etc.).
4. Script **inline** no final: copiar o padrão da Skyderm (IIFE `collectPayload` + `fetch`) — não referenciar arquivo externo no repositório como dependência de runtime no RD.
5. Garantir `RD_TOKEN` válido no ambiente onde o Node roda (painel do provedor ou export no shell).

## O que não fazer

- Não depender de JS externo no mesmo repositório para LPs publicadas no RD — o deploy único é o HTML.
- Não colocar o token da RD no HTML — só a URL pública `/convert`.
