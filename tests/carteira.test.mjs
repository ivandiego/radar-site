// F6: montagem da carteira (pessoa → pares → imóvel) extraída do api.js pra
// função pura. Reviewer: "fetchCarteira monta o join errado → carteira vazia
// ou alvo do cliente errado" — agora tem teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { montarCarteira } from '../js/carteira.js';

const pessoas = [{ id: 'm1', nome_exibicao: 'Mesach' }, { id: 'a1', nome_exibicao: 'Ana' }];
const lados = [
  { par_id: 'p1', pessoa_id: 'm1', imovel_id: null },
  { par_id: 'p2', pessoa_id: 'm1', imovel_id: null },
  { par_id: 'p9', pessoa_id: 'zz', imovel_id: null }, // pessoa fora da carteira
];
const pares = [{ id: 'p1', apelido: 'casa Boa Vista' }, { id: 'p2', apelido: 'ap Centro' }];
const ladosDosPares = [{ par_id: 'p1', imovel_id: 'i1' }, { par_id: 'p1', imovel_id: 'i2' }];
const imoveis = [{ id: 'i1', titulo: 'Boa Vista' }, { id: 'i2', titulo: 'Segundo' }];

test('cada pessoa recebe SÓ os pares dela, com o imóvel do par', () => {
  const c = montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis);
  const mesach = c.find((x) => x.pessoa.id === 'm1');
  assert.equal(mesach.pares.length, 2);
  assert.equal(mesach.pares.find((x) => x.par.id === 'p1').imovel.titulo, 'Boa Vista');
});
test('par sem imóvel vem com imovel null, não some', () => {
  const c = montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis);
  assert.equal(c.find((x) => x.pessoa.id === 'm1').pares.find((x) => x.par.id === 'p2').imovel, null);
});
test('pessoa sem par vem com pares vazios (não some da carteira)', () => {
  const c = montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis);
  assert.deepEqual(c.find((x) => x.pessoa.id === 'a1').pares, []);
});
test('lado de pessoa desconhecida ou par inexistente é ignorado', () => {
  const c = montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis);
  assert.equal(c.length, 2);
  assert.ok(!c.flatMap((x) => x.pares).some((x) => x.par.id === 'p9'));
});
test('mesmo par com 2 lados-imóvel: fica o primeiro (1 alvo por par)', () => {
  const c = montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis);
  assert.equal(c.find((x) => x.pessoa.id === 'm1').pares.find((x) => x.par.id === 'p1').imovel.id, 'i1');
});
