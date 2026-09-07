// F4.10 — tela Estatística: helpers puros sobre o JSON que o Confrontador grava em estatistica_rodada. Sem LLM.
const fmt = (iso, tz) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '') : '');
const horas = (h) => (h === null || h === undefined ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${String(Math.round(h * 10) / 10).replace('.', ',')} h`);
const canalDe = (d, canal) => {
  const c = (d && d[canal]) || {};
  return { abordagens: c.abordagens || 0, respondidas: c.respondidas || 0, taxa: `${c.taxa || 0}%`, mediana: horas(c.mediana_h), dentro24: `${c.dentro_24h || 0} de ${c.respondidas || 0}`,
    umaMsg: `${c.uma_msg || 0} de ${c.abordagens || 0}`, mudos: c.mudos || 0, iniciadas: c.iniciadas_por_eles || 0, respondidasPorNos: c.respondidas_por_nos || 0,
    bola: ((d && d.bola_conosco) || []).filter((b) => b.canal === canal).length };
};
export function resumoDe(dados, tz) {
  if (!dados) return null;
  return { quando: fmt(dados.calculado_em, tz), conversas: dados.conversas || 0, olx: canalDe(dados, 'olx'), whatsapp: canalDe(dados, 'whatsapp') };
}
export function linhasAbertura(canal) {
  const l = ((canal && canal.por_abertura) || []).slice().sort((a, b) => (b.abordagens || 0) - (a.abordagens || 0));
  const melhor = l.filter((a) => (a.abordagens || 0) >= 3).sort((a, b) => (b.taxa || 0) - (a.taxa || 0))[0];
  return l.map((a) => ({ abertura: a.abertura, texto: `${a.respondidas || 0} de ${a.abordagens || 0} (${a.taxa || 0}%)`, melhor: !!melhor && melhor.abertura === a.abertura }));
}
export function bolaConosco(dados, tz) {
  return ((dados && dados.bola_conosco) || []).slice().sort((a, b) => (b.dias || 0) - (a.dias || 0))
    .map((b) => ({ canal: b.canal, quem: b.cab || b.destino, destino: b.destino, dias: b.dias || 0, nunca: !!b.nunca_respondida, ultima: b.ultima || '', quando: fmt(b.ultima_em, tz), href: '#redacao' }));
}
export function serieTexto(serie, tz) {
  return (serie || []).map((s) => ({ quando: fmt(s.calculado_em, tz), taxa: `${s.olx_taxa || 0}%`, abordagens: s.olx_abordagens || 0, bola: (s.wa_bola || 0) + (s.olx_bola || 0) }));
}
