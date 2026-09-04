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
