import test from 'node:test';
import assert from 'node:assert/strict';
import { blocosDaCobranca } from '../js/cobranca.js';
const agora = new Date('2026-09-04T12:00:00Z');
const payload = {
  agenda: [
    { id: 'c1', rotulo: 'Mesach', o_que: 'mandar as fotos', prazo: '2026-09-05T15:00:00Z', quem_deve: 'deles' },
    { id: 'c2', rotulo: 'Paula', o_que: 'retornar com a proposta', prazo: '2026-09-03T15:00:00Z', quem_deve: 'nos' },
    { id: 'c3', rotulo: 'Vitor', o_que: 'confirmar visita', prazo: '2026-09-02T12:00:00Z', quem_deve: 'deles' },
  ],
  diario: [{ tipo: 'peteca', hora: '2026-09-04T09:00:00Z', pessoa_ref: 'EWS', texto: 'retomada: conseguiu ver a ficha?', prova_ref: 'mensagem_fila:f9' }, { tipo: 'alarme', hora: '2026-09-04T09:01:00Z', texto: 'x' }],
};
test('blocosDaCobranca: separa nossas/deles, vencidas primeiro com atraso, petecas só de tipos de cobrança', () => {
  const b = blocosDaCobranca(payload, agora, 'America/Sao_Paulo');
  assert.deepEqual(b.nossas.map((c) => c.id), ['c2']); assert.equal(b.nossas[0].vencida, true); assert.equal(b.nossas[0].atrasoH, 21); assert.equal(b.nossas[0].prazo, '03/09 12:00');
  assert.deepEqual(b.deles.map((c) => c.id), ['c3', 'c1']); assert.equal(b.deles[1].vencida, false); assert.equal(b.deles[1].atrasoH, 0);
  assert.equal(b.petecas.length, 1); assert.equal(b.petecas[0].quem, 'EWS');
  assert.deepEqual(b.resumo, { nossasVencidas: 1, delesVencidas: 1 });
  assert.deepEqual(blocosDaCobranca({}, agora, 'UTC').resumo, { nossasVencidas: 0, delesVencidas: 0 });
});
