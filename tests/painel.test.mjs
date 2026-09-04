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

// ---- PR 2 (04/09): alarmes no topo do Painel ----
import { alarmesDoPainel } from '../js/painel.js';
test('alarmesDoPainel: alarmes com rótulo do setor, hora curta e texto; vazio → []', () => {
  const a = alarmesDoPainel({ alarmes: [
    { id: 'a2', setor: 'expedicao', hora: '2026-09-04T02:00:00Z', texto: 'envio_falhou: Lilis — deslogado', prova_ref: 'mensagem_fila:f3', motivo: 'envio_falhou' },
    { id: 'a1', setor: 'recepcao', hora: '2026-09-04T01:00:00Z', texto: 'lacuna: possível perda no chat da Lilis', prova_ref: 'chat_varrido:5513', motivo: 'lacuna' },
  ] });
  assert.equal(a.length, 2);
  assert.equal(a[0].setorTitulo, 'Expedição'); assert.equal(a[0].hora, '02:00'); assert.equal(a[0].id, 'a2');
  assert.equal(a[1].texto, 'lacuna: possível perda no chat da Lilis');
  assert.deepEqual(alarmesDoPainel({}), []);
});
test('cartoesDoPainel: setor com alarme aberto fica em atenção mesmo sem travado', () => {
  const p = { setores: { recepcao: { ultima_rodada: '2026-09-03T22:00:00Z', fez: [], travado: [] } }, alarmes: [{ id: 'a1', setor: 'recepcao', hora: '2026-09-04T01:00:00Z', texto: 'lacuna: x', motivo: 'lacuna' }] };
  assert.equal(cartoesDoPainel(p)[0].estado, 'atencao');
});

// Entrega 4: faixa comum das telas de setor
import { faixaDoSetor } from '../js/painel.js';
test('faixaDoSetor: título, quem, rodada em BRT, fez, travado e alarmes do setor', () => {
  const p = { setores: { recepcao: { ultima_rodada: '2026-09-04T01:00:00Z', fez: [{ tipo: 'chat_lido', n: 37 }], travado: ['WhatsApp deslogado (QR) desde 14:40'] } }, alarmes: [{ setor: 'recepcao' }, { setor: 'redacao' }] };
  const f = faixaDoSetor(p, 'recepcao', 'America/Sao_Paulo');
  assert.equal(f.titulo, 'Recepção'); assert.equal(f.quem, 'Coletor + Ouvidor');
  assert.equal(f.rodada, '22:00'); assert.equal(f.fez, '37 chats lidos');
  assert.deepEqual(f.travado, ['WhatsApp deslogado (QR) desde 14:40']); assert.equal(f.alarmes, 1); assert.equal(f.estado, 'atencao');
  assert.equal(faixaDoSetor({}, 'garimpo', 'UTC').estado, 'parado');
});

// Entrega 5 (spec §4): VIP mudo há 5+ dias
import { vipsMudos } from '../js/painel.js';
test('vipsMudos: VIP ativo sem interação há 5+ dias (ou nunca) entra, maior atraso primeiro; não-VIP, inativo e recente ficam fora', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  const cs = [
    { pessoa: { id: 'a', nome_exibicao: 'A', estagio: '3-x', diferenca_max: 1, ultima_interacao: '2026-09-01T12:00:00Z' }, pares: [] },
    { pessoa: { id: 'b', nome_exibicao: 'B', estagio: '3-x', diferenca_max: 1, ultima_interacao: '2026-09-08T12:00:00Z' }, pares: [] },
    { pessoa: { id: 'c', nome_exibicao: 'C', estagio: '3-x', diferenca_max: 0, ultima_interacao: null }, pares: [] },
    { pessoa: { id: 'd', nome_exibicao: 'D', estagio: '4-x', diferenca_max: 1, ultima_interacao: null }, pares: [] },
    { pessoa: { id: 'e', nome_exibicao: 'E', estagio: '1-x', diferenca_max: 1, ultima_interacao: null }, pares: [] },
  ];
  assert.deepEqual(vipsMudos(cs, now), [{ pessoaId: 'd', nome: 'D', dias: null }, { pessoaId: 'a', nome: 'A', dias: 9 }]);
  assert.deepEqual(vipsMudos(cs, now, 10), [{ pessoaId: 'd', nome: 'D', dias: null }]);
});
