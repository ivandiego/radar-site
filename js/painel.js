// Painel (entrega 1, spec §4): view-model PURO dos cartões por setor e do
// bloco "o que NÃO está acontecendo". Sem DOM. Testado em tests/painel.test.mjs.
export const ROTULOS_SETOR = {
  recepcao: { titulo: 'Recepção', quem: 'Coletor + Ouvidor' },
  redacao: { titulo: 'Redação', quem: 'Pensador' },
  expedicao: { titulo: 'Expedição', quem: 'Carteiro' },
  cobranca: { titulo: 'Cobrança', quem: 'Relógios' },
  garimpo: { titulo: 'Garimpo', quem: 'Relógios' },
  fiscalizacao: { titulo: 'Fiscalização', quem: 'Fiscal' },
};
const ORDEM = ['recepcao', 'redacao', 'expedicao', 'cobranca', 'garimpo', 'fiscalizacao'];
const TIPOS = {
  chat_lido: ['chat lido', 'chats lidos'], recebida: ['recebida', 'recebidas'],
  rascunho_liberado: ['rascunho liberado', 'rascunhos liberados'], rascunho_decisao: ['rascunho pra você decidir', 'rascunhos pra você decidir'],
  rejeitado: ['rejeitado', 'rejeitados'], ignorada: ['ignorada', 'ignoradas'],
  enviada: ['enviada', 'enviadas'], falhou: ['falha de envio', 'falhas de envio'],
  promessa_nossa: ['promessa nossa', 'promessas nossas'], promessa_deles: ['promessa deles', 'promessas deles'], cumprida: ['cumprida', 'cumpridas'], renegociada: ['renegociada', 'renegociadas'],
  ordem_pendente: ['ordem pendente', 'ordens pendentes'], ordem_executando: ['ordem em execução', 'ordens em execução'], ordem_concluida: ['ordem concluída', 'ordens concluídas'], ordem_cancelada: ['ordem cancelada', 'ordens canceladas'],
  violacao: ['violação', 'violações'], violacao_resolvida: ['violação resolvida', 'violações resolvidas'],
};
export function rotuloTipo(tipo, n = 2) {
  const t = TIPOS[tipo];
  if (!t) return String(tipo || '').replace(/_/g, ' ');
  return n === 1 ? t[0] : t[1];
}
const hhmm = (iso, tz) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });

export function cartoesDoPainel(payload, tz = 'UTC') {
  return ORDEM.map((setor) => {
    const s = (payload.setores || {})[setor] || { ultima_rodada: null, fez: [], travado: [] };
    const fez = s.fez && s.fez.length ? s.fez.map((f) => `${f.n} ${rotuloTipo(f.tipo, f.n)}`).join(' · ') : 'nada registrado nas últimas 24h';
    const estado = !s.ultima_rodada ? 'parado' : (s.travado && s.travado.length ? 'atencao' : 'ok');
    return { setor, titulo: ROTULOS_SETOR[setor].titulo, quem: ROTULOS_SETOR[setor].quem, rodada: s.ultima_rodada ? hhmm(s.ultima_rodada, tz) : null, fez, travado: s.travado || [], estado };
  });
}

export function naoAcontecendo(payload) {
  return (payload.nao_acontecendo || []).map((x) => ({ ...x, setorTitulo: (ROTULOS_SETOR[x.setor] || {}).titulo || x.setor }));
}
