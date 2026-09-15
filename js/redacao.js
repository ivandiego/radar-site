// Redação/Expedição (entrega 2, spec §5): view-model PURO. Sem DOM.
// Testado em tests/redacao.test.mjs.
import { mascararTelefones } from './painel.js?v=1789348087';
const fmt = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');

export function gruposDaRedacao(payload, agora = new Date(), tz = 'UTC') {
  return (payload.grupos || []).map((g) => {
    // F4.20: chegouDepois = mensagem da pessoa que chegou DEPOIS deste texto (o Ivan não aprova às cegas)
    const rascunhos = (g.rascunhos || []).map((r) => ({ id: r.id, texto: r.texto || '', hora: fmt(r.criado_em, tz), origem: r.origem || '', duplicado_de: r.duplicado_de || null, ehDuplicata: !!r.duplicado_de,
      chegouDepois: r.chegou_depois ? { texto: r.chegou_depois.texto || '', hora: fmt(r.chegou_depois.hora, tz) } : null }));
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
    // 11/09: na fila pra sair — aprovada errada ainda pode ser recolhida antes do Carteiro pegar
    aprovadas: (payload.aprovadas || []).map((a) => ({ id: a.id, rotulo: a.destino_rotulo || a.destino, canal: a.canal, texto: a.texto || '', hora: fmt(a.aprovado_em || a.criado_em, tz) })),
  };
}

// ---- 15/09: fase 1 da régua do rascunho (radar-permutas PR 218, peças 2 e 16) ----
// `barrada` é final: a régua segurou o texto e ele não sai. O motivo mora em mensagem_fila.erro como REGUA:<códigos>
// (gatilho fila_zz_regua). Os nomes espelham REGUA_NOMES da edge fila (regras.ts); conversa_bloqueada é o robô (ii).
const REGUA_NOMES = { travessao: 'travessão', telefone: 'telefone', anuncio: 'a palavra anúncio/anunciante', saudacao: 'saudação de período no começo (use "Oi, <nome>!")', nota_interna: 'nota interna', teto_comissao: 'teto ou comissão', perguntas: '4 ou mais perguntas', conversa_bloqueada: 'conversa bloqueada (liberar ou escrever)' };
export function motivoDaRegua(erro) {
  const m = String(erro ?? '').match(/REGUA:([a-z_,]+)/);
  if (!m) return null;
  return m[1].split(',').filter(Boolean).map((c) => REGUA_NOMES[c] || c.replace(/_/g, ' ')).join(', ');
}
// As barradas vêm do diário da Redação (tipo rascunho_barrado, prova mensagem_fila:<id>); telefone sempre mascarado.
export function barradasDoDiario(itens, tz = 'UTC') {
  return (itens || []).filter((i) => i.tipo === 'rascunho_barrado').map((i) => ({
    id: String(i.prova_ref || '').replace(/^mensagem_fila:/, ''), hora: fmt(i.hora, tz),
    quem: mascararTelefones(i.quem || ''), texto: mascararTelefones(i.texto || ''), prova_ref: i.prova_ref || null,
  }));
}
