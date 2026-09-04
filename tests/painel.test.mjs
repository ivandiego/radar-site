import test from 'node:test';
import assert from 'node:assert/strict';
import { cartoesDoPainel, rotuloTipo, naoAcontecendo, ROTULOS_SETOR } from '../js/painel.js';

const vazio = { ultima_rodada: null, fez: [], travado: [] };
const payload = {
  setores: {
    recepcao: { ultima_rodada: '2026-09-03T22:00:00Z', fez: [{ tipo: 'chat_lido', n: 37 }, { tipo: 'recebida', n: 184 }], travado: ['WhatsApp deslogado (QR) desde 21:59'] },
    redacao: { ultima_rodada: '2026-09-03T22:02:00Z', fez: [{ tipo: 'rascunho_liberado', n: 4 }, { tipo: 'rascunho_decisao', n: 6 }], travado: [] },
    expedicao: vazio, cobranca: vazio, garimpo: vazio, fiscalizacao: vazio,
  },
  nao_acontecendo: [{ tipo: 'cliente_sem_resposta', texto: 'Nani sem resposta há 3h', setor: 'redacao', ref: 'mensagem_recebida:r1' }],
};
test('rotuloTipo: português de gente, singular/plural', () => {
  assert.equal(rotuloTipo('chat_lido'), 'chats lidos');
  assert.equal(rotuloTipo('chat_lido', 1), 'chat lido');
  assert.equal(rotuloTipo('rascunho_decisao'), 'rascunhos pra você decidir');
  assert.equal(rotuloTipo('ordem_concluida'), 'ordens concluídas');
  assert.equal(rotuloTipo('tipo_desconhecido'), 'tipo desconhecido');
});
test('cartoesDoPainel: um cartão por setor, na ordem, com "fez" em texto', () => {
  const cs = cartoesDoPainel(payload);
  assert.equal(cs.length, 6);
  assert.equal(cs[0].setor, 'recepcao'); assert.equal(cs[0].titulo, ROTULOS_SETOR.recepcao.titulo);
  assert.equal(cs[0].rodada, '22:00');
  assert.equal(cs[0].fez, '37 chats lidos · 184 recebidas');
  assert.equal(cs[0].estado, 'atencao');
  assert.equal(cs[1].fez, '4 rascunhos liberados · 6 rascunhos pra você decidir');
  assert.equal(cs[1].estado, 'ok');
});
test('cartoesDoPainel: setor sem rodada = parado', () => {
  const cs = cartoesDoPainel(payload);
  assert.equal(cs[2].estado, 'parado'); assert.equal(cs[2].rodada, null); assert.equal(cs[2].fez, 'nada registrado nas últimas 24h');
});
test('naoAcontecendo: repassa com rótulo do setor', () => {
  const n = naoAcontecendo(payload);
  assert.equal(n[0].setorTitulo, 'Redação'); assert.equal(n[0].ref, 'mensagem_recebida:r1');
});
