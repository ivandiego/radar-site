// Recepção (entrega 4, spec §2/§5): view-model PURO. Sem DOM. Testado em tests/recepcao.test.mjs.
const fmt = (iso, tz) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '') : '—');
const chave = (d) => String(d || '').replace(/\D/g, '').slice(-8);
// "HH:MM, M/D/AAAA" (hora do canal, Brasília) → iso
function horaCanal(hora_olx) {
  const m = String(hora_olx || '').match(/(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Date.UTC(+m[5], +m[3] - 1, +m[4], +m[1] + 3, +m[2])).toISOString() : null;
}
export function chegadasDaRecepcao(payload, tz = 'UTC') {
  const chegadas = (payload && payload.chegadas) || [];
  const ultimaEnviada = new Map();
  for (const e of (payload && payload.enviadas) || []) { const k = chave(e.destino); if (!ultimaEnviada.has(k) || ultimaEnviada.get(k) < e.enviado_em) ultimaEnviada.set(k, e.enviado_em); }
  const ultimaRecebida = new Map();
  for (const c of chegadas) { const k = chave(c.destino); if (!ultimaRecebida.has(k) || ultimaRecebida.get(k) < c.criado_em) ultimaRecebida.set(k, c.criado_em); }
  const itens = chegadas.map((c) => {
    const k = chave(c.destino);
    const nossa = ultimaEnviada.has(k) && ultimaEnviada.get(k) > ultimaRecebida.get(k);
    return { id: c.id, canal: c.canal, remetente: c.remetente || c.destino, anuncio: c.anuncio || '', texto: c.texto || '', ehAudio: /^\[AUDIO/i.test(c.texto || ''), hora_canal: fmt(horaCanal(c.hora_olx), tz), hora_registro: fmt(c.criado_em, tz), estado: c.estado, ultimaPalavra: nossa ? 'nossa' : 'deles' };
  });
  const resumo = { novas: itens.filter((i) => i.estado === 'nova').length, audios: itens.filter((i) => i.ehAudio).length, whatsapp: itens.filter((i) => i.canal === 'whatsapp').length, olx: itens.filter((i) => i.canal === 'olx').length };
  const ordens = ((payload && payload.ordens) || []).map((o) => ({ id: o.id, estado: o.estado, rotulo: o.telefones && o.telefones.length ? 'CONFERIR' : /PROFUNDA/i.test(o.instrucao || '') ? 'PROFUNDA' : 'Varredura', resultado: o.resultado || '', hora: fmt(o.executado_em || o.criado_em, tz) }));
  return { itens, resumo, ordens };
}
