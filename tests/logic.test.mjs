import test from 'node:test';
import assert from 'node:assert';
import { parVivo, alvoVivo, bolaDe, alvosVivos, alertasDe, comissaoDe, filaDoDia, diasDesde, metaAlvosDe } from '../js/logic.js';

test('metaAlvosDe: padrão 3 sem tag', () => assert.equal(metaAlvosDe({ criterios: 'apto 3q Santos' }), 3));
test('metaAlvosDe: lê meta_alvos dos critérios', () => assert.equal(metaAlvosDe({ criterios: 'teto 749. meta_alvos: 10' }), 10));
test('metaAlvosDe: aceita "meta alvos = N" no o_que_busca', () => assert.equal(metaAlvosDe({ o_que_busca: 'apto — meta alvos = 5' }), 5));
test('metaAlvosDe: pessoa vazia → 3', () => assert.equal(metaAlvosDe(null), 3));

test('peteca: dono respondeu e parado 24h+ alerta', () => {
  const NOW2 = new Date('2026-08-27T12:00:00Z');
  const pessoa = { id: 'p1', nome_exibicao: 'X', estagio: '5-NEGOCIACAO', ultima_interacao: '2026-08-27T10:00:00Z' };
  const carteira = { pessoa, pares: [{ par: { dono_respondeu: true, updated_at: '2026-08-25T10:00:00Z', apelido: 'X x alvo' }, imovel: null }] };
  const al = alertasDe([pessoa], [carteira], NOW2);
  assert.ok(al.some((a) => a.tipo === 'peteca'));
});
test('peteca: respondido mexido hoje NÃO alerta', () => {
  const NOW2 = new Date('2026-08-27T12:00:00Z');
  const pessoa = { id: 'p1', nome_exibicao: 'X', estagio: '5-NEGOCIACAO', ultima_interacao: '2026-08-27T10:00:00Z' };
  const carteira = { pessoa, pares: [{ par: { dono_respondeu: true, updated_at: '2026-08-27T09:00:00Z' }, imovel: null }] };
  assert.ok(!alertasDe([pessoa], [carteira], NOW2).some((a) => a.tipo === 'peteca'));
});

const NOW = new Date('2026-08-26T12:00:00Z');

test('diasDesde conta dias inteiros', () => {
  assert.equal(diasDesde('2026-08-23T12:00:00Z', NOW), 3);
  assert.equal(diasDesde(null, NOW), null);
});

test('par descartado não é vivo', () => assert.equal(parVivo({ descartado_motivo: 'x' }, {}), false));
test('par [DUPLICADO] não é vivo', () => assert.equal(parVivo({ bloqueio: '[DUPLICADO] y' }, {}), false));
test('par com imóvel morto não é vivo', () => assert.equal(parVivo({}, { status_inventario: 'morto' }), false));
test('par limpo é vivo', () => assert.equal(parVivo({ bloqueio: '[SONDADO]' }, { status_inventario: 'disponivel' }), true));
test('par sem imóvel ligado ainda conta como vivo', () => assert.equal(parVivo({}, null), true));

test('bola: esperando cliente → cliente', () => assert.equal(bolaDe('esperando cliente responder'), 'cliente'));
test('bola: aguardando novo imóvel → nós', () => assert.equal(bolaDe('aguardando novo imóvel'), 'nós'));
test('bola: aguardando infos → nós', () => assert.equal(bolaDe('aguardando infos'), 'nós'));
test('bola: dívida de retorno → nós', () => assert.equal(bolaDe('dívida de retorno'), 'nós'));
test('bola: IVAN: ligar → Ivan', () => assert.equal(bolaDe('IVAN: ligar'), 'Ivan'));
test('bola: gargalo livre → indefinida', () => assert.equal(bolaDe('Respondeu 20/08 combinado'), 'indefinida'));
test('bola: vazio → indefinida', () => assert.equal(bolaDe(null), 'indefinida'));

test('alvosVivos conta só pares vivos', () => {
  const carteira = { pessoa: { id: 'p' }, pares: [
    { par: { updated_at: '2026-08-26T10:00:00Z' }, imovel: { status_inventario: 'disponivel' } },
    { par: { descartado_motivo: 'não', updated_at: '2026-08-26T10:00:00Z' }, imovel: { status_inventario: 'disponivel' } },
    { par: { updated_at: '2026-08-26T10:00:00Z' }, imovel: { status_inventario: 'morto' } },
  ] };
  assert.equal(alvosVivos(carteira, NOW), 1);
});

test('dono mudo 48h vira alerta; antes de 48h não', () => {
  const p = { id: '1', nome_exibicao: 'X', estagio: '5-NEGOCIACAO', ultima_interacao: NOW.toISOString(), promessa_pendente: false, telefone: '11 9', contato_privado: null };
  const mk = (updated) => [{ pessoa: p, pares: [{ par: { id: 'a', dono_respondeu: false, updated_at: updated, apelido: 'X x alvo' }, imovel: { status_inventario: 'disponivel', valor: 100000 } }] }];
  assert.ok(alertasDe([p], mk('2026-08-23T12:00:00Z'), NOW).some(x => x.tipo === 'dono_mudo' && x.parId === 'a'));
  assert.ok(!alertasDe([p], mk('2026-08-25T13:00:00Z'), NOW).some(x => x.tipo === 'dono_mudo'));
});

test('cliente parado 48h vira alerta', () => {
  const p = { id: '1', nome_exibicao: 'X', estagio: '3-RESPONDEU', ultima_interacao: '2026-08-22T12:00:00Z', promessa_pendente: false, telefone: 'x', contato_privado: null };
  assert.ok(alertasDe([p], [{ pessoa: p, pares: [] }], NOW).some(x => x.tipo === 'cliente_parado'));
});

test('promessa pendente vira alerta de dívida', () => {
  const p = { id: '1', nome_exibicao: 'X', estagio: '4-PERFIL-COLETADO', ultima_interacao: NOW.toISOString(), promessa_pendente: true, telefone: 'x', contato_privado: null };
  assert.ok(alertasDe([p], [{ pessoa: p, pares: [] }], NOW).some(x => x.tipo === 'divida'));
});

test('sem telefone em negociação = canal em risco', () => {
  const p = { id: '2', nome_exibicao: 'V', estagio: '5-NEGOCIACAO', ultima_interacao: NOW.toISOString(), promessa_pendente: false, telefone: null, contato_privado: null };
  assert.ok(alertasDe([p], [{ pessoa: p, pares: [] }], NOW).some(x => x.tipo === 'canal_risco'));
});

test('estágio baixo sem telefone NÃO é canal em risco', () => {
  const p = { id: '2', nome_exibicao: 'V', estagio: '2-CONTATADO', ultima_interacao: NOW.toISOString(), promessa_pendente: false, telefone: null, contato_privado: null };
  assert.ok(!alertasDe([p], [{ pessoa: p, pares: [] }], NOW).some(x => x.tipo === 'canal_risco'));
});

test('comissão = 6% do maior alvo vivo', () => {
  const carteira = { pessoa: { valor_do_que_tem: 200000 }, pares: [
    { par: { updated_at: '2026-08-26T10:00:00Z' }, imovel: { status_inventario: 'disponivel', valor: 400000 } },
    { par: { updated_at: '2026-08-26T10:00:00Z' }, imovel: { status_inventario: 'disponivel', valor: 300000 } },
  ] };
  assert.equal(comissaoDe(carteira, NOW), 24000);
});

test('comissão cai no valor_do_que_tem sem alvos', () => {
  assert.equal(comissaoDe({ pessoa: { valor_do_que_tem: 200000 }, pares: [] }), 12000);
});

test('fila ordena por comissão desc e só ativos 2-6', () => {
  const recente = new Date(Date.now() - 3600e3).toISOString(); // 1h atrás — imune ao calendário
  const c1 = { pessoa: { id: 'a', nome_exibicao: 'A', estagio: '3-RESPONDEU', gargalo: 'aguardando novo imóvel' }, pares: [{ par: { updated_at: recente }, imovel: { status_inventario: 'disponivel', valor: 700000 } }] };
  const c2 = { pessoa: { id: 'b', nome_exibicao: 'B', estagio: '3-RESPONDEU', gargalo: null }, pares: [{ par: { updated_at: recente }, imovel: { status_inventario: 'disponivel', valor: 300000 } }] };
  const c3 = { pessoa: { id: 'c', nome_exibicao: 'C', estagio: '0-MORTO' }, pares: [] };
  const fila = filaDoDia([c2, c3, c1]);
  assert.deepEqual(fila.map(x => x.pessoa.id), ['a', 'b']);
  assert.equal(fila[0].comissao, 42000);
});

test('alvo parado 96h+ sem resposta NAO conta como vivo', () => {
  const par={updated_at:'2026-08-20T12:00:00Z', dono_respondeu:false};
  assert.equal(alvoVivo(par, {status_inventario:'disponivel'}, NOW), false);
});
test('alvo mexido ha 2 dias conta como vivo', () => {
  const par={updated_at:'2026-08-24T12:00:00Z', dono_respondeu:false};
  assert.equal(alvoVivo(par, {status_inventario:'disponivel'}, NOW), true);
});
test('dono respondeu = vivo mesmo antigo', () => {
  const par={updated_at:'2026-08-01T12:00:00Z', dono_respondeu:true};
  assert.equal(alvoVivo(par, {status_inventario:'disponivel'}, NOW), true);
});
test('contagem usa a regua de 96h', () => {
  const c={pessoa:{id:'p'}, pares:[
    {par:{updated_at:'2026-08-25T12:00:00Z'}, imovel:{status_inventario:'disponivel'}},
    {par:{updated_at:'2026-08-10T12:00:00Z'}, imovel:{status_inventario:'disponivel'}},
    {par:{updated_at:'2026-08-01T12:00:00Z', dono_respondeu:true}, imovel:{status_inventario:'disponivel'}},
  ]};
  assert.equal(alvosVivos(c, NOW), 2);
});

// ---- Onda 0 (C1): esc() precisa escapar aspas (injeção de atributo/XSS)
import { esc } from '../js/logic.js';
test('esc: escapa aspas duplas (atributo)', () => assert.ok(!esc('a"b').includes('"')));
test('esc: escapa < > &', () => assert.equal(esc('<b>&'), '&lt;b&gt;&amp;'));
test('esc: aspas simples viram entidade', () => assert.ok(!esc("a'b").includes("'")));
test('esc: nulo vira vazio', () => assert.equal(esc(null), ''));
