// Garimpo (entrega 4, spec §2/§5): view-model PURO. Sem DOM. Testado em tests/garimpo.test.mjs.
import { alvosVivos, metaAlvosDe, comissaoDe, pessoaAtiva } from './logic.js';
const fmt = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');
export function ordensDoGarimpo(itens, tz = 'UTC') {
  return (itens || []).map((o) => ({ id: o.id, estado: o.estado, pessoa_nome: o.pessoa_nome || '', meta: o.meta, resultado: o.resultado || '', hora: fmt(o.executado_em || o.criado_em, tz), cancelavel: o.estado === 'pendente' }));
}
export function reguaDeMeta(carteiras, agora = new Date()) {
  return (carteiras || [])
    .filter((c) => (c.pessoa.diferenca_max || 0) > 0 && pessoaAtiva(c.pessoa))
    .map((c) => ({ pessoa: c.pessoa, vivos: alvosVivos(c, agora), meta: metaAlvosDe(c.pessoa), comissao: comissaoDe(c, agora) }))
    .filter((x) => x.vivos < x.meta)
    .sort((a, b) => b.comissao - a.comissao)
    .map(({ comissao, ...x }) => ({ ...x, abaixo: true }));
}
export function alvosNovos(diario, tz = 'UTC') {
  return (diario || []).filter((d) => d.tipo === 'alvo_novo' || d.tipo === 'ordem_concluida').map((d) => ({ hora: fmt(d.hora, tz), quem: d.pessoa_ref || d.quem || '', texto: d.texto || '', prova_ref: d.prova_ref || null }));
}
