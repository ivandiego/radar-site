import test from 'node:test';
import assert from 'node:assert/strict';
import { setorDaViolacao, rotuloViolacao, violacoesAgrupadas } from '../js/fiscalizacao.js';
test('setorDaViolacao: cada tipo cai no setor que resolve; desconhecido → null', () => {
  assert.equal(setorDaViolacao('ignorada_suspeita'), 'redacao'); assert.equal(setorDaViolacao('compromisso_vencido'), 'cobranca');
  assert.equal(setorDaViolacao('canal_cego'), 'recepcao'); assert.equal(setorDaViolacao('teto_vazado'), 'carteira'); assert.equal(setorDaViolacao('xyz'), null);
  assert.equal(rotuloViolacao('robo_sem_ponto'), 'robo sem ponto');
});
test('violacoesAgrupadas: por gravidade, rótulo humano, prova só com referencia tabela:chave', () => {
  const v = violacoesAgrupadas({ abertas: [
    { id: 'v1', tipo: 'ignorada_suspeita', gravidade: 'alta', referencia: 'mensagem_recebida:m1', descricao: 'Mesach: "Posso te ligar?"', criado_em: '2026-09-04T09:00:00Z' },
    { id: 'v2', tipo: 'robo_sem_ponto', gravidade: 'media', referencia: 'relogios', descricao: 'sem batida', criado_em: '2026-09-04T08:00:00Z' },
    { id: 'v3', tipo: 'xyz', gravidade: 'estranha', descricao: 'x', criado_em: '2026-09-04T08:00:00Z' },
  ], resolvidas: [{ id: 'v0', tipo: 'canal_cego', gravidade: 'alta', descricao: 'x', criado_em: '2026-09-03T08:00:00Z', resolvido_em: '2026-09-04T01:00:00Z' }] }, 'America/Sao_Paulo');
  assert.equal(v.total, 3); assert.equal(v.abertas.alta[0].rotulo, 'ignorada suspeita'); assert.equal(v.abertas.alta[0].temProva, true); assert.equal(v.abertas.alta[0].setorTitulo, 'Redação');
  assert.equal(v.abertas.media[0].temProva, false); assert.equal(v.abertas.media.length, 2); assert.equal(v.abertas.media[1].setorTitulo, ''); assert.deepEqual(v.abertas.baixa, []);
  assert.equal(v.resolvidas[0].hora, '03/09 22:00');
  assert.deepEqual(violacoesAgrupadas({}, 'UTC').abertas, { alta: [], media: [], baixa: [] });
});
