// Fiscalização (entrega 4, spec §2/§5): view-model PURO. Sem DOM. Testado em tests/fiscalizacao.test.mjs.
import { ROTULOS_SETOR } from './painel.js';
const fmt = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');
const SETOR_DO_TIPO = {
  caixa_apodrecendo: 'redacao', respondida_sem_resposta: 'redacao', decisao_esquecida: 'redacao', ignorada_suspeita: 'redacao',
  aprovada_envelhecida: 'expedicao', estado_fantasma: 'expedicao', compromisso_vencido: 'cobranca',
  ordem_travada: 'garimpo', tarefa_travada: 'garimpo', canal_cego: 'recepcao', chat_sem_recibo: 'recepcao', robo_sem_ponto: 'recepcao',
  telefone_vazado: 'carteira', teto_vazado: 'carteira', visita_sem_aceite: 'carteira',
};
export function setorDaViolacao(tipo) { return SETOR_DO_TIPO[tipo] || null; }
export function rotuloViolacao(tipo) { return String(tipo || '').replace(/_/g, ' '); }
const item = (v, tz) => {
  const setor = setorDaViolacao(v.tipo);
  return { id: v.id, tipo: v.tipo, rotulo: rotuloViolacao(v.tipo), gravidade: v.gravidade || 'media', descricao: v.descricao || '', referencia: v.referencia || '', temProva: /^[a-z_]+:.+$/.test(v.referencia || ''), hora: fmt(v.resolvido_em || v.criado_em, tz), setor, setorTitulo: setor === 'carteira' ? 'Carteira' : ((ROTULOS_SETOR[setor] || {}).titulo || '') };
};
export function violacoesAgrupadas(payload, tz = 'UTC') {
  const abertas = { alta: [], media: [], baixa: [] };
  for (const v of (payload && payload.abertas) || []) (abertas[v.gravidade] || abertas.media).push(item(v, tz));
  const resolvidas = ((payload && payload.resolvidas) || []).map((v) => item(v, tz));
  return { abertas, resolvidas, total: abertas.alta.length + abertas.media.length + abertas.baixa.length };
}

// F4.5.9: auditoria mecânica de VIPs (última rodada) — a unidade é o VIP; vermelho > amarelo > verde.
const COR_ROTULO = { vermelho: 'site não bate com o canal', amarelo: 'alguém espera por nós', verde: 'site bate com o canal' };
export function vipsDaAuditoria(payload, tz = 'UTC') {
  const linhas = (payload && payload.vips) || [];
  const peso = { vermelho: 0, amarelo: 1, verde: 2 };
  const vips = linhas.map((v) => ({
    pessoaId: v.pessoa_id || '', nome: v.nome || '?', veredito: peso[v.veredito] == null ? 'vermelho' : v.veredito,
    rotulo: COR_ROTULO[v.veredito] || COR_ROTULO.vermelho,
    motivos: (Array.isArray(v.motivos) ? v.motivos : []).map((m) => ({ codigo: String(m.codigo || ''), texto: String(m.texto || m.codigo || ''), gravidade: m.gravidade || 'vermelho' })),
    alvos: Array.isArray(v.alvos) ? v.alvos.length : 0,
    alvosExcluidos: (Array.isArray(v.alvos) ? v.alvos : []).filter((a) => a && a.estado && a.estado.estado_real === 'excluido').length,
    canalUltima: v.canal_ultima || '', siteUltima: v.site_ultima || '', prints: Array.isArray(v.evidencias) ? v.evidencias.length : 0,
  })).sort((a, b) => peso[a.veredito] - peso[b.veredito] || a.nome.localeCompare(b.nome, 'pt-BR'));
  const resumo = { total: vips.length, vermelhos: vips.filter((v) => v.veredito === 'vermelho').length, amarelos: vips.filter((v) => v.veredito === 'amarelo').length, verdes: vips.filter((v) => v.veredito === 'verde').length };
  return { vips, resumo, rodada: payload && payload.rodada_em ? fmt(payload.rodada_em, tz) : null };
}

// F4.6.3b/F4.6.5 (Relator): a última rodada da auditoria contada por agente — o que o Leitor leu, o que o
// Confrontador decidiu, o que o Espelho corrigiu — a partir dos heartbeats (detalhe JSON) devolvidos pela edge.
const NOME_AGENTE = { leitor: 'Leitor', confrontador: 'Confrontador', espelho: 'Espelho' };
export function rodadasDaAuditoria(payload, tz = 'UTC') {
  const ag = (payload && payload.agentes) || {};
  const linhas = [];
  for (const chave of ['leitor', 'confrontador', 'espelho']) {
    const h = ag[chave]; if (!h) { linhas.push({ agente: NOME_AGENTE[chave], quando: null, rodada: null, resumo: 'nunca rodou', ok: false }); continue; }
    const d = h.detalhe && typeof h.detalhe === 'object' ? h.detalhe : {};
    let resumo = '';
    if (chave === 'leitor') resumo = `${d.pedidos ?? '?'} destinos pedidos, ${d.lidos ?? '?'} lidos, ${d.pulados ?? 0} pulados${d.pulados && d.por_motivo ? ' (' + Object.entries(d.por_motivo).map(([k, n]) => `${n} ${k}`).join(', ') + ')' : ''}${d.pedidos && d.ms ? ` · ${Math.round(d.ms / d.pedidos / 1000)} s por destino` : ''}`;
    else if (chave === 'confrontador') resumo = d.sem_sessao ? 'site sem sessão: 0 VIPs' : `${d.total ?? '?'} VIPs: ${d.vermelhos ?? 0} vermelhos, ${d.amarelos ?? 0} amarelos, ${d.verdes ?? 0} verdes${d.sem_retrato ? ` · ${d.sem_retrato} sem retrato` : ''}`;
    else resumo = `${d.updates ?? 0} correção(ões) previstas, ${d.aplicados ?? 0} aplicadas${d.dry ? ' (modo seco)' : ''}${Array.isArray(d.erros) && d.erros.length ? ` · ${d.erros.length} recusadas` : ''}`;
    const idade = h.atualizado_em ? (Date.now() - new Date(h.atualizado_em).getTime()) / 3600e3 : Infinity;
    linhas.push({ agente: NOME_AGENTE[chave], quando: h.atualizado_em ? fmt(h.atualizado_em, tz) : null, rodada: d.rodada || null, resumo, ok: idade < 30 && !(Array.isArray(d.erros) && d.erros.length) });
  }
  const mesmaRodada = new Set(linhas.map((l) => l.rodada).filter(Boolean)).size <= 1;
  return { linhas, rodada: (payload && payload.rodada) || linhas.find((l) => l.rodada)?.rodada || null, mesmaRodada };
}
