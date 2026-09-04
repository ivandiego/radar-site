import test from 'node:test';
import assert from 'node:assert/strict';
import { linhasDaTabela, fichaDe, reguasDe, conversaOrdenada, patchDaAcao, patchPessoa } from '../js/ficha.js';
const now = new Date('2026-09-04T12:00:00Z');
const par = (id, extra) => ({ par: { id, apelido: 'casa ' + id, updated_at: '2026-09-03T12:00:00Z', bloqueio: '', dono_respondeu: false, ...extra }, imovel: { id: 'i' + id, valor: 500000, telefone_anunciante: '(13) 99999-0001', link_fonte_privado: 'https://sp.olx.com.br/x-1401234567' } });
const mesach = { pessoa: { id: 'm1', nome_exibicao: 'Mesach', estagio: '3-RESPONDEU', classificacao: 'vip', valor_do_que_tem: 350000, diferenca_max: 100000, gargalo: 'esperando cliente ver fotos', telefone: '(11) 94956-4957', canal: 'whatsapp', ultima_interacao: '2026-09-02T12:00:00Z', interacao: { ultima_palavra: 'deles', texto: 'Posso te ligar?' }, criterios: '' },
  pares: [par('a', { dono_respondeu: true, bloqueio: '[RESPONDEU 02/09 via site] topo | whats: ok' }), par('b'), par('c', { descartado_motivo: 'vendido (site, 01/09)' })] };
const ana = { pessoa: { id: 'a1', nome_exibicao: 'Ana', estagio: '3-RESPONDEU', valor_do_que_tem: 900000, diferenca_max: 0, ultima_interacao: null }, pares: [] };
const lead = { pessoa: { id: 'l1', nome_exibicao: 'Lead', estagio: '1-LEAD', diferenca_max: 50000 }, pares: [] };
test('linhasDaTabela: só ativos, só VIPs por padrão, comissão desc; campos calculados', () => {
  const l = linhasDaTabela([mesach, ana, lead], { soVips: true }, now);
  assert.deepEqual(l.map((x) => x.id), ['m1']);
  const m = l[0];
  assert.equal(m.alvos, 2); assert.equal(m.meta, 3); assert.equal(m.clsAlvos, 'warn'); assert.equal(m.respondidos, 1); assert.equal(m.mudos, 1);
  assert.equal(m.diasInt, 2); assert.equal(m.ultimaPalavra, 'dele(a)'); assert.match(m.dicaInt, /Posso te ligar/);
  assert.equal(m.bola, 'cliente'); assert.equal(m.comissao, 30000); assert.equal(m.canal, 'whatsapp'); assert.equal(m.canalMorto, false);
  const todos = linhasDaTabela([mesach, ana, lead], { soVips: false }, now);
  assert.deepEqual(todos.map((x) => x.id), ['a1', 'm1']); // comissão 54000 > 30000; lead inativo fora
});
test('linhasDaTabela: ordenação por coluna e sentido', () => {
  const asc = linhasDaTabela([mesach, ana], { soVips: false, col: 'cliente', asc: true }, now);
  assert.deepEqual(asc.map((x) => x.nome), ['Ana', 'Mesach']);
  const tem = linhasDaTabela([mesach, ana], { soVips: false, col: 'tem', asc: false }, now);
  assert.deepEqual(tem.map((x) => x.id), ['a1', 'm1']);
});
test('fichaDe: pessoa, alvos vivos com estado/pontas/negócio, descartados separados', () => {
  const ck = new Map([['a', { cliente: new Set(['contactado', 'valor']), dono: new Set(['contactado']) }]]);
  const f = fichaDe(mesach, ck, now);
  assert.equal(f.pessoa.nome, 'Mesach'); assert.equal(f.pessoa.meta, 3); assert.equal(f.pessoa.alvos, 2); assert.equal(f.pessoa.comissao, 30000);
  assert.equal(f.alvos.length, 2); assert.equal(f.descartados.length, 1); assert.equal(f.descartados[0].motivo, 'vendido (site, 01/09)');
  const a = f.alvos.find((x) => x.parId === 'a');
  assert.equal(a.estado, 'respondeu'); assert.equal(a.canalResposta, 'Whats'); assert.equal(a.linkOlx, 'https://sp.olx.com.br/x-1401234567'); assert.equal(a.dias, 1);
  assert.deepEqual(a.pontas, { cliente: ['contactado', 'valor'], dono: ['contactado'] });
  assert.deepEqual(a.negocio, { n: 1, falta: 'valor', atras: 'dono', bola: 'nós (completar a ponta)' });
  const b = f.alvos.find((x) => x.parId === 'b');
  assert.equal(b.estado, 'aguardando'); assert.equal(b.negocio, null); assert.deepEqual(b.pontas, { cliente: [], dono: [] });
  assert.equal(fichaDe({ ...mesach, pares: [par('z', { updated_at: '2026-08-20T12:00:00Z' })] }, null, now).alvos[0].estado, 'mudo');
});
test('reguasDe: peteca primeiro, só os 4 tipos', () => {
  const r = reguasDe(mesach, now);
  assert.equal(r[0].tipo, 'peteca'); assert.ok(r.every((x) => ['peteca', 'divida', 'dono_mudo', 'canal_risco'].includes(x.tipo)));
  assert.deepEqual(reguasDe(ana, now), []);
});
test('conversaOrdenada: 4 mais recentes, quem e hora em BRT', () => {
  const c = conversaOrdenada({ entrada: [{ criado_em: '2026-09-03T12:28:00Z', texto: 'Posso te ligar?' }], saida: [{ criado_em: '2026-09-03T13:00:00Z', enviado_em: null, estado: 'aprovada', texto: 'Pode sim' }, { criado_em: '2026-09-01T10:00:00Z', enviado_em: '2026-09-01T10:05:00Z', estado: 'enviada', texto: 'Bom dia' }] }, 'America/Sao_Paulo');
  assert.deepEqual(c.map((x) => x.quem), ['nós (na fila)', 'ele(a)', 'nós']);
  assert.equal(c[1].quando, '03/09 09:28'); assert.equal(c[1].texto, 'Posso te ligar?');
  assert.deepEqual(conversaOrdenada({}, 'UTC'), []);
});
test('patchDaAcao: carimbo por ação, mantém o histórico', () => {
  const atual = { bloqueio: 'antes', dono_respondeu: false };
  assert.deepEqual(patchDaAcao('respondeu', 'topo', atual, '04/09'), { dono_respondeu: true, bloqueio: '[RESPONDEU 04/09 via site] topo | antes' });
  assert.deepEqual(patchDaAcao('nota', 'ligar amanhã', { bloqueio: null }, '04/09'), { bloqueio: '[NOTA 04/09 via site] ligar amanhã' });
  assert.deepEqual(patchDaAcao('morto', 'vendido', atual, '04/09'), { descartado_motivo: 'vendido (site, 04/09)' });
  assert.deepEqual(patchDaAcao('escolheu', 'o de Suzano', atual, '04/09'), { bloqueio: '[CLIENTE ESCOLHEU 04/09 via site] o de Suzano | antes' });
});
test('patchPessoa: números e nulos; insert ganha defaults; update não', () => {
  const campos = { nome: 'Ana', classificacao: 'vip', o_que_tem_texto: 'apto', valor_do_que_tem: '350000', o_que_busca: '', diferenca_max: '', telefone: '(11) 9', link: '' };
  const ins = patchPessoa(campos, false, '04/09', '2026-09-04T12:00:00Z');
  assert.equal(ins.valor_do_que_tem, 350000); assert.equal(ins.diferenca_max, null); assert.equal(ins.o_que_busca, null); assert.equal(ins.link_thread_olx_privado, null);
  assert.equal(ins.estagio, '3-RESPONDEU'); assert.equal(ins.gargalo, 'aguardando novo imóvel'); assert.equal(ins.ultima_interacao, '2026-09-04T12:00:00Z'); assert.equal(ins.atualizado_via, 'site');
  assert.match(ins.proximo_passo, /^04\/09: cadastrado pelo site/);
  const upd = patchPessoa(campos, true, '04/09', '2026-09-04T12:00:00Z');
  assert.equal(upd.estagio, undefined); assert.equal(upd.ultima_interacao, undefined); assert.equal(upd.nome_exibicao, 'Ana'); assert.equal(upd.atualizado_via, 'site');
});
