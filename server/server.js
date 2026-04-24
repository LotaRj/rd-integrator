/**
 * RD Integrator — API genérica para landing pages enviarem conversões ao RD Station.
 *
 * CORS permissivo (qualquer origem); porta fixa 3000.
 *
 * Autenticação: TOKEN PÚBLICO da tela Configurações → Integrações → API do RD.
 * Esse token funciona na API pública de conversões (endpoint legado mas ativo e suportado):
 *   https://www.rdstation.com.br/api/1.3/conversions
 *
 * Por que não a v2 (`api.rd.services`)?
 *   A v2 exige OAuth2 (JWT) gerado a partir de um App privado criado no RD App Store —
 *   fluxo com Client ID / Secret / refresh token. Para o caso de uso de LP → conversão,
 *   a 1.3 com token público é suficiente, estável, e mantém o token protegido no servidor.
 *
 * Env:
 *   RD_TOKEN — token público do RD (ex.: 10ccb7f605340a6aa36484013f0e1e9e)
 *
 * Contrato POST /convert (JSON):
 *   Obrigatórios: lp, email, e (nome OU name).
 *   Opcionais mapeados: celular | mobile_phone | phone → mobile_phone;
 *                       cidade | city → city.
 *   Qualquer outra chave (ex.: cf_*) é repassada ao payload.
 *   tags: string "a,b,c" ou array; se omitido, usa [lp].
 */

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const { buildRdEnvelopeFromConvertBody } = require('./lib/rdPayload');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const RD_CONVERSIONS_URL = 'https://www.rdstation.com.br/api/1.3/conversions';

const app  = express();
const PORT = 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(express.json());

app.use(
  cors({
    origin: true,
    methods: ['POST', 'OPTIONS', 'GET'],
    allowedHeaders: ['Content-Type']
  })
);

// ── Rota de conversão ────────────────────────────────────────
app.post('/convert', async (req, res) => {
  const built = buildRdEnvelopeFromConvertBody(req.body);
  if (!built.ok) {
    return res.status(400).json({ error: built.error });
  }

  const { lp, email } = req.body;

  const token = process.env.RD_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'RD_TOKEN não configurado no servidor' });
  }

  // API 1.3: payload "flat" com token no body.
  // O envelope v2 gerado por buildRdEnvelope vem em { event_type, event_family, payload }.
  // Extraímos o payload, renomeamos os campos para os nomes que a 1.3 espera.
  const p = built.envelope.payload;

  const rd13Payload = {
    token_rdstation:   token,
    identificador:     p.conversion_identifier,
    nome:              p.name,
    email:             p.email,
    ...(p.mobile_phone && { celular: p.mobile_phone }),
    ...(p.city         && { cidade:  p.city }),
    // Campos customizados (cf_*) e quaisquer outros extras passam direto
    ...Object.fromEntries(
      Object.entries(p).filter(([k]) =>
        !['conversion_identifier', 'name', 'email', 'mobile_phone', 'city', 'tags'].includes(k)
      )
    ),
    // Tags: 1.3 aceita string separada por vírgula
    tags: Array.isArray(p.tags) ? p.tags.join(',') : p.tags
  };

  try {
    const rdResponse = await fetch(RD_CONVERSIONS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(rd13Payload)
    });

    const rdBody = await rdResponse.text();

    if (!rdResponse.ok) {
      console.error(`[RD ERROR] ${rdResponse.status}:`, rdBody);
      return res.status(502).json({ error: 'Falha ao registrar no RD Station', detail: rdBody });
    }

    console.log(`[CONVERSION] lp=${lp} | email=${email}`);
    return res.status(200).json({ ok: true, message: 'Lead registrado com sucesso' });

  } catch (err) {
    console.error('[NETWORK ERROR]', err.message);
    return res.status(500).json({ error: 'Erro interno ao contatar RD Station' });
  }
});

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`RD Integrator na porta ${PORT}`);
});