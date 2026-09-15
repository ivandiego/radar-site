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

// ---- 15/09: fase 1 da régua do rascunho (radar-permutas PR 218, peças 12 e 14) ----
// agenda_lembrar dá 409 ANTES do insert quando a conversa está bloqueada ({erro, bloqueio}); e 409 quando já tem lembrete.
// A tela diz o que aconteceu (sem alert) e, no bloqueio, oferece liberar a conversa.
import { avisoDoLembrete } from '../js/cobranca.js';
test('avisoDoLembrete: 409 de conversa bloqueada explica e aponta o bloqueio para liberar', () => {
  const e = Object.assign(new Error('conversa bloqueada: liberar ou escrever'), { status: 409, dados: { erro: 'conversa bloqueada: liberar ou escrever', bloqueio: 'bl1' } });
  const a = avisoDoLembrete(e);
  assert.equal(a.bloqueioRef, 'bloqueio_conversa:bl1');
  assert.match(a.texto, /conversa está bloqueada/); assert.match(a.texto, /não foi criado/);
  assert.ok(!a.texto.includes('—'));
});
test('avisoDoLembrete: 409 de lembrete repetido explica sem oferecer liberar; outro erro repassa a mensagem', () => {
  const dup = avisoDoLembrete(Object.assign(new Error('x'), { status: 409, dados: { erro: 'esse compromisso já tem lembrete na fila ou enviado: aguardando o Ivan' } }));
  assert.equal(dup.bloqueioRef, null); assert.match(dup.texto, /já tem lembrete/);
  const outro = avisoDoLembrete(new Error('fila indisponível (500)'));
  assert.equal(outro.bloqueioRef, null); assert.equal(outro.texto, 'Não consegui lembrar: fila indisponível (500)');
});
