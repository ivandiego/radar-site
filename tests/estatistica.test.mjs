// F4.10 — tela Estatística: helpers puros (formatação e leitura do JSON que o Confrontador grava). Sem LLM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoDe, linhasAbertura, bolaConosco, serieTexto } from '../js/estatistica.js';

const dados = {
  calculado_em: '2026-09-07T12:00:00Z', conversas: 134,
  olx: { conversas: 91, abordagens: 87, respondidas: 36, taxa: 41, mediana_h: 10.7, dentro_24h: 24, uma_msg: 76, mudos: 51, mudos_2msgs: 4,
    por_mes: { '2026-07': { abordagens: 13, respondidas: 13 }, '2026-08': { abordagens: 64, respondidas: 16 } },
    por_abertura: [{ abertura: 'sou corretor e trabalho com permuta', abordagens: 31, respondidas: 3, taxa: 10 }, { abertura: 'nome + anúncio', abordagens: 11, respondidas: 11, taxa: 100 }],
    iniciadas_por_eles: 4, respondidas_por_nos: 4 },
  whatsapp: { conversas: 43, abordagens: 7, respondidas: 7, taxa: 100, mediana_h: 0.4, dentro_24h: 7, uma_msg: 5, mudos: 0, mudos_2msgs: 0, por_mes: {}, por_abertura: [], iniciadas_por_eles: 36, respondidas_por_nos: 21 },
  bola_conosco: [{ canal: 'whatsapp', destino: '5513999990001', cab: 'Carla', dias: 6, ultima: 'Oi, vi o anúncio', ultima_em: '2026-09-01T10:00:00Z', nunca_respondida: true }, { canal: 'olx', destino: '==A===@conference.olxbr', cab: 'Mesach', dias: 1, ultima: 'Oi, pode ser', ultima_em: '2026-09-06T10:00:00Z', nunca_respondida: false }],
};
test('resumoDe: cartões por canal com taxa, mediana em horas legíveis, uma mensagem só, bola conosco', () => {
  const r = resumoDe(dados, 'America/Sao_Paulo');
  assert.equal(r.quando, '07/09 09:00');
  assert.deepEqual(r.olx, { abordagens: 87, respondidas: 36, taxa: '41%', mediana: '10,7 h', dentro24: '24 de 36', umaMsg: '76 de 87', mudos: 51, iniciadas: 4, respondidasPorNos: 4, bola: 1 });
  assert.equal(r.whatsapp.mediana, '24 min'); assert.equal(r.whatsapp.bola, 1); assert.equal(r.whatsapp.iniciadas, 36); assert.equal(r.whatsapp.respondidasPorNos, 21);
  assert.deepEqual(resumoDe(null, 'America/Sao_Paulo'), null);
});
test('linhasAbertura: ordenadas por abordagens, com taxa e destaque da melhor', () => {
  const l = linhasAbertura(dados.olx);
  assert.deepEqual(l.map((x) => [x.abertura, x.texto, x.melhor]), [['sou corretor e trabalho com permuta', '3 de 31 (10%)', false], ['nome + anúncio', '11 de 11 (100%)', true]]);
  assert.deepEqual(linhasAbertura({}), []);
});
test('bolaConosco: ordenada por dias, rótulo com canal e nome, link pra responder', () => {
  const b = bolaConosco(dados, 'America/Sao_Paulo');
  assert.deepEqual(b.map((x) => [x.canal, x.quem, x.dias, x.nunca, x.href]), [['whatsapp', 'Carla', 6, true, '#redacao'], ['olx', 'Mesach', 1, false, '#redacao']]);
  assert.equal(b[0].quando, '01/09 07:00');
  assert.deepEqual(bolaConosco({}, 'America/Sao_Paulo'), []);
});
test('serieTexto: série por rodada em texto curto', () => {
  const s = serieTexto([{ rodada: 'R1', calculado_em: '2026-09-06T12:00:00Z', olx_taxa: 100, olx_abordagens: 2, wa_bola: 0, olx_bola: 0 }, { rodada: 'R2', calculado_em: '2026-09-07T12:00:00Z', olx_taxa: 33, olx_abordagens: 3, wa_bola: 2, olx_bola: 1 }], 'America/Sao_Paulo');
  assert.deepEqual(s, [{ quando: '06/09 09:00', taxa: '100%', abordagens: 2, bola: 0 }, { quando: '07/09 09:00', taxa: '33%', abordagens: 3, bola: 3 }]);
});
