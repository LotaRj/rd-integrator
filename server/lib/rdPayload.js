/**
 * Chaves reservadas do contrato público POST /convert.
 * Não são repassadas como "extras" ao RD (evita duplicar nome/name, etc.).
 */
const RESERVED_KEYS = new Set([
  'lp',
  'tags',
  'nome',
  'name',
  'email',
  'celular',
  'mobile_phone',
  'phone',
  'cidade',
  'city'
]);

function normalizeTags(tags, lp) {
  if (tags == null || tags === '') return [lp];
  let arr;
  if (Array.isArray(tags)) {
    arr = tags.map((t) => String(t).trim()).filter(Boolean);
  } else {
    arr = String(tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return arr.length ? arr : [lp];
}

/**
 * Monta o envelope JSON exigido pela API v2 de conversões do RD Station.
 * Aceita sinônimos PT / RD no corpo: nome|name, celular|mobile_phone|phone, cidade|city.
 *
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true, envelope: object } | { ok: false, error: string }}
 */
function buildRdEnvelopeFromConvertBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido' };
  }

  const lp = body.lp;
  const email = body.email;
  const name = body.nome ?? body.name;
  const mobile = body.celular ?? body.mobile_phone ?? body.phone;
  const city = body.cidade ?? body.city;

  if (!lp || typeof lp !== 'string') {
    return { ok: false, error: 'Campo obrigatório: lp' };
  }
  if (!email || typeof email !== 'string') {
    return { ok: false, error: 'Campo obrigatório: email' };
  }
  if (name == null || String(name).trim() === '') {
    return { ok: false, error: 'Campo obrigatório: nome ou name' };
  }

  const extra = {};
  for (const [k, v] of Object.entries(body)) {
    if (RESERVED_KEYS.has(k)) continue;
    extra[k] = v;
  }

  const payload = {
    conversion_identifier: lp,
    name: String(name).trim(),
    email: String(email).trim(),
    ...(mobile != null &&
      String(mobile).trim() !== '' && { mobile_phone: String(mobile).trim() }),
    ...(city != null && String(city).trim() !== '' && { city: String(city).trim() }),
    ...extra,
    tags: normalizeTags(body.tags, lp)
  };

  return {
    ok: true,
    envelope: {
      event_type: 'CONVERSION',
      event_family: 'CDP',
      payload
    }
  };
}

module.exports = {
  RESERVED_KEYS,
  buildRdEnvelopeFromConvertBody,
  normalizeTags
};
