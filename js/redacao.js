// Redação/Expedição (entrega 2, spec §5): view-model PURO. Sem DOM.
// Testado em tests/redacao.test.mjs.
const fmt = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');

export function gruposDaRedacao(payload, agora = new Date(), tz = 'UTC') {
  return (payload.grupos || []).map((g) => {
    const rascunhos = (g.rascunhos || []).map((r) => ({ id: r.id, texto: r.texto || '', hora: fmt(r.criado_em, tz), origem: r.origem || '', duplicado_de: r.duplicado_de || null, ehDuplicata: !!r.duplicado_de }));
    const dups = rascunhos.filter((r) => r.ehDuplicata).length;
    const tempos = (g.rascunhos || []).map((r) => new Date(r.criado_em).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
    return {
      destino: g.destino, rotulo: g.rotulo, canal: g.canal,
      recebida: g.recebida ? { texto: g.recebida.texto, hora: fmt(g.recebida.hora, tz) } : null,
      esperandoH: tempos.length ? Math.floor((agora.getTime() - tempos[0]) / 36e5) : 0,
      rascunhos, aviso: dups ? `${dups + 1} rascunhos iguais — aprovar um rejeita o outro` : null,
    };
  });
}

export function linhasDaExpedicao(payload, tz = 'UTC') {
  return {
    enviadas: (payload.enviadas || []).map((e) => ({ id: e.id, rotulo: e.destino_rotulo || e.destino, canal: e.canal, texto: e.texto || '', hora: fmt(e.enviado_em, tz), prova: e.prova_envio || '' })),
    falhas: (payload.falhas || []).map((f) => ({ id: f.id, rotulo: f.destino_rotulo || f.destino, canal: f.canal, texto: f.texto || '', hora: fmt(f.criado_em, tz), erro: f.erro || '' })),
  };
}
