// Cobrança (entrega 4, spec §5): view-model PURO. Sem DOM. Testado em tests/cobranca.test.mjs.
const fmt = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');
const TIPOS_COBRANCA = new Set(['peteca', 'cobrou', 'lembrou', 'renegociou']);
export function blocosDaCobranca(payload, agora = new Date(), tz = 'UTC') {
  const lista = (quem) => ((payload && payload.agenda) || []).filter((c) => c.quem_deve === quem).map((c) => {
    const atrasoMs = agora.getTime() - new Date(c.prazo).getTime();
    return { id: c.id, rotulo: c.rotulo || c.destino || '?', o_que: c.o_que || '', prazo: fmt(c.prazo, tz), vencida: atrasoMs > 0, atrasoH: Math.max(0, Math.floor(atrasoMs / 36e5)), _t: new Date(c.prazo).getTime() };
  }).sort((a, b) => a._t - b._t).map(({ _t, ...c }) => c);
  const nossas = lista('nos'), deles = lista('deles');
  const petecas = ((payload && payload.diario) || []).filter((d) => TIPOS_COBRANCA.has(d.tipo)).map((d) => ({ hora: fmt(d.hora, tz), quem: d.pessoa_ref || d.destino || '', texto: d.texto || '', prova_ref: d.prova_ref || null }));
  return { nossas, deles, petecas, resumo: { nossasVencidas: nossas.filter((c) => c.vencida).length, delesVencidas: deles.filter((c) => c.vencida).length } };
}
// 15/09 (fase 1 da régua do rascunho, radar-permutas PR 218, peças 12 e 14): o 409 do agenda_lembrar vira mensagem na tela.
// Conversa bloqueada = {erro, bloqueio: <id>} (antes do insert: prazo e diário intactos) → oferece liberar a conversa.
export function avisoDoLembrete(e) {
  const dados = (e && e.dados) || {};
  if (e && e.status === 409 && dados.bloqueio) return { texto: 'O lembrete não foi criado: a conversa está bloqueada. Libere a conversa ou escreva você mesmo.', bloqueioRef: `bloqueio_conversa:${dados.bloqueio}` };
  if (e && e.status === 409) return { texto: `O lembrete não foi criado: ${dados.erro || e.message}`, bloqueioRef: null };
  return { texto: `Não consegui lembrar: ${(e && e.message) || e}`, bloqueioRef: null };
}
