import test from 'node:test';
import assert from 'node:assert/strict';
import { chegadasDaRecepcao } from '../js/recepcao.js';
const payload = {
  chegadas: [
    { id: 'm1', canal: 'whatsapp', remetente: 'Mesach', destino: '5511949564957', texto: 'Posso te ligar?', hora_olx: '09:27, 9/3/2026', criado_em: '2026-09-03T12:28:00Z', estado: 'nova' },
    { id: 'm2', canal: 'olx', remetente: 'Paula', anuncio: 'Casa Boa Vista', destino: '1401234567', texto: '[AUDIO 0:12]', hora_olx: null, criado_em: '2026-09-03T10:00:00Z', estado: 'respondida' },
  ],
  enviadas: [{ id: 'e1', destino: '5511949564957', enviado_em: '2026-09-03T13:00:00Z' }],
  ordens: [{ id: 'o1', estado: 'concluida', instrucao: 'CONFERIR (vip): 2 chats', telefones: ['5511949564957'], resultado: 'CONFERIR: 2/2 chats relidos', criado_em: '2026-09-04T11:00:00Z', executado_em: '2026-09-04T11:05:00Z' }],
};
test('chegadasDaRecepcao: itens formatados, áudio marcado, quem falou por último, resumo e ordens', () => {
  const r = chegadasDaRecepcao(payload, 'America/Sao_Paulo');
  assert.equal(r.itens.length, 2);
  assert.equal(r.itens[0].ultimaPalavra, 'nossa'); assert.equal(r.itens[0].hora_canal, '03/09 09:27'); assert.equal(r.itens[0].hora_registro, '03/09 09:28');
  assert.equal(r.itens[1].ehAudio, true); assert.equal(r.itens[1].ultimaPalavra, 'deles'); assert.equal(r.itens[1].hora_canal, '—');
  assert.deepEqual(r.resumo, { novas: 1, audios: 1, whatsapp: 1, olx: 1 });
  assert.equal(r.ordens[0].rotulo, 'CONFERIR'); assert.equal(r.ordens[0].hora, '04/09 08:05');
  assert.deepEqual(chegadasDaRecepcao({}, 'UTC'), { itens: [], resumo: { novas: 0, audios: 0, whatsapp: 0, olx: 0 }, ordens: [] });
});
test('chegadasDaRecepcao: ordem PROFUNDA e varredura simples rotuladas', () => {
  const r = chegadasDaRecepcao({ ordens: [{ id: 'a', estado: 'pendente', instrucao: 'varredura PROFUNDA', criado_em: '2026-09-04T11:00:00Z' }, { id: 'b', estado: 'pendente', criado_em: '2026-09-04T11:00:00Z' }] }, 'UTC');
  assert.deepEqual(r.ordens.map((o) => o.rotulo), ['PROFUNDA', 'Varredura']);
});

import { contextoDaConversa, pedidoDeResposta } from '../js/recepcao.js';
test('Responder na Recepção: o item traz o destino da mensagem (identidade pelo registro, nada digitado)', () => {
  const { itens } = chegadasDaRecepcao(payload, 'UTC');
  assert.equal(itens[0].destino, '5511949564957');
});
test('contextoDaConversa: quem, canal, sem par (não inventar cliente/imóvel/valor), mensagens abertas e histórico', () => {
  const t = contextoDaConversa({ remetente: 'Janette', canal: 'whatsapp', anuncio: '' },
    [{ texto: 'Bom dia Ivan', criado_em: '2026-09-11T14:07:00Z' }, { texto: 'Estou ligando pra saber sobre o seu imóvel', criado_em: '2026-09-11T14:07:30Z' }],
    [{ quando: '10/09 11:15', quem: 'nós', texto: 'Oi Janette, o interesse no apto continua' }], 'UTC');
  assert.ok(t.includes('Janette') && t.includes('whatsapp'));
  assert.ok(/não está ligad[ao] a um par/i.test(t) && /não invente/i.test(t), t);
  assert.ok(t.includes('11/09 14:07 “Estou ligando pra saber sobre o seu imóvel”'), t);
  assert.ok(t.includes('10/09 11:15 nós: Oi Janette'), t);
});
test('pedidoDeResposta: canal e destino da mensagem, rótulo = remetente, origem site, só os ids escolhidos', () => {
  assert.deepEqual(pedidoDeResposta({ canal: 'whatsapp', destino: '5513996037761', remetente: 'Janette' }, ' Oi Janette! ', ['a', 'b']),
    { canal: 'whatsapp', destino: '5513996037761', destino_rotulo: 'Janette', texto: 'Oi Janette!', origem: 'site', responde_ids: ['a', 'b'] });
  assert.equal(pedidoDeResposta({ canal: 'whatsapp', destino: 'x', remetente: 'y' }, '   ', []), null);
});
