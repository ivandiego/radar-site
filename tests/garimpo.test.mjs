import test from 'node:test';
import assert from 'node:assert/strict';
import { ordensDoGarimpo, reguaDeMeta, alvosNovos } from '../js/garimpo.js';
const agora = new Date('2026-09-04T12:00:00Z');
test('ordensDoGarimpo: formata e só pendente é cancelável', () => {
  const o = ordensDoGarimpo([{ id: 'g1', estado: 'pendente', pessoa_nome: 'Mesach', meta: 3, criado_em: '2026-09-04T11:00:00Z' }, { id: 'g2', estado: 'concluida', pessoa_nome: 'EWS', meta: 3, resultado: '2/3 alvos', criado_em: '2026-09-03T11:00:00Z', executado_em: '2026-09-03T12:00:00Z' }], 'America/Sao_Paulo');
  assert.equal(o[0].cancelavel, true); assert.equal(o[1].cancelavel, false); assert.equal(o[1].hora, '03/09 09:00'); assert.equal(o[1].resultado, '2/3 alvos');
  assert.deepEqual(ordensDoGarimpo(undefined), []);
});
test('reguaDeMeta: VIP ativo abaixo da meta entra, maior comissão primeiro; não-VIP, inativo e VIP na meta ficam fora', () => {
  // pessoaAtiva exige estagio iniciando em 2-6; alvoVivo exige par mexido <96h; comissaoDe lê imovel.valor
  const vivo = (id, valor) => ({ par: { id, updated_at: agora.toISOString() }, imovel: { valor } });
  const carteiras = [
    { pessoa: { id: 'p1', nome_exibicao: 'Mesach', estagio: '3-negociando', diferenca_max: 100000, valor_do_que_tem: 500000, criterios: ['meta_alvos: 3'] }, pares: [vivo('a', 600000)] },
    { pessoa: { id: 'p2', nome_exibicao: 'EWS', estagio: '4-visita', diferenca_max: 50000, valor_do_que_tem: 900000, criterios: [] }, pares: [vivo('b', 950000)] },
    { pessoa: { id: 'p3', nome_exibicao: 'Sem dinheiro', estagio: '3-negociando', diferenca_max: 0, valor_do_que_tem: 300000 }, pares: [] },
    { pessoa: { id: 'p4', nome_exibicao: 'Na meta', estagio: '3-negociando', diferenca_max: 10000, valor_do_que_tem: 300000, criterios: ['meta_alvos: 1'] }, pares: [vivo('c', 310000)] },
    { pessoa: { id: 'p5', nome_exibicao: 'Inativo', estagio: '1-lead', diferenca_max: 90000, valor_do_que_tem: 300000 }, pares: [] },
  ];
  const r = reguaDeMeta(carteiras, agora);
  assert.deepEqual(r.map((x) => x.pessoa.id), ['p2', 'p1']);
  assert.equal(r[1].vivos, 1); assert.equal(r[1].meta, 3); assert.equal(r[1].abaixo, true);
});
test('alvosNovos: só alvo_novo e ordem_concluida do diário', () => {
  const a = alvosNovos([{ tipo: 'alvo_novo', hora: '2026-09-04T10:00:00Z', pessoa_ref: 'Mesach', texto: 'Apto 2q Vila Mariana', prova_ref: 'ordem_garimpo:g2' }, { tipo: 'alarme', hora: '2026-09-04T10:01:00Z', texto: 'x' }], 'UTC');
  assert.equal(a.length, 1); assert.equal(a[0].quem, 'Mesach'); assert.equal(a[0].hora, '04/09 10:00');
});
