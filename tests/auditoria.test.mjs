import test from 'node:test';
import assert from 'node:assert/strict';
import { arvoreDoVip, montarAuditoria, amostra } from '../js/auditoria.js';

const carteira = { pessoa: { id: 'm1', nome_exibicao: 'Mesach', telefone: '(11) 94956-4957' }, pares: [
  { par: { id: 'p1', apelido: 'casa 123m2 3q', descartado_motivo: null }, imovel: { id: 'i1', telefone_anunciante: '(13) 99726-5365', status_inventario: 'ativo' } },
  { par: { id: 'p2', apelido: 'Casa Paris', descartado_motivo: null }, imovel: { id: 'i2', telefone_anunciante: null, status_inventario: 'ativo' } },
  { par: { id: 'p3', apelido: 'morto', descartado_motivo: 'x' }, imovel: { id: 'i3', telefone_anunciante: '(13) 90000-0000', status_inventario: 'ativo' } },
] };
test('arvoreDoVip: VIP + alvos vivos, chave8, sem telefone entra com chave null', () => {
  const a = arvoreDoVip(carteira);
  assert.deepEqual(a.map((x) => [x.papel, x.rotulo, x.chave]), [['VIP', 'Mesach', '49564957'], ['alvo', 'casa 123m2 3q', '97265365'], ['alvo', 'Casa Paris', null]]);
});
test('montarAuditoria: resumo conta selos e sem telefone; linhas formatadas', () => {
  const por = {
    '49564957': { auditoria: { selo: 'auditada', motivos: [], linhas: [{ quem: 'ele(a)', texto: 'Posso te ligar?', hora_canal: '2026-09-02T22:29:00.000Z', hora_registro: '2026-09-02T22:30:00Z', prova: 'mensagem_recebida:r1', ok: true, motivo: null }] } },
    '97265365': { auditoria: { selo: 'divergente', motivos: ['lacuna: possível perda…'], linhas: [] } },
  };
  const m = montarAuditoria(arvoreDoVip(carteira), por);
  assert.deepEqual(m.resumo, { total: 3, auditadas: 1, divergentes: 1, nao_varridas: 0, sem_telefone: 1 });
  assert.equal(m.conversas[0].linhas[0].hora_canal, '02/09 22:29');
  assert.equal(m.conversas[1].motivos[0], 'lacuna: possível perda…');
  assert.equal(m.conversas[2].selo, 'sem_telefone');
});
test('montarAuditoria: telefone sem resposta da edge fn conta como não varrida', () => {
  const m = montarAuditoria(arvoreDoVip(carteira), {});
  assert.equal(m.resumo.nao_varridas, 2);
});
test('amostra: n chaves únicas, determinística com aleatório fixo', () => {
  const seq = [0.9, 0.1, 0.5, 0.3]; let i = 0;
  const r = amostra(['a', 'b', 'c', 'd', 'e'], 3, () => seq[i++ % seq.length]);
  assert.equal(r.length, 3); assert.equal(new Set(r).size, 3);
  assert.deepEqual(amostra(['a'], 5), ['a']);
});
