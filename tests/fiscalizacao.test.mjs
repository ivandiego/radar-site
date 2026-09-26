import test from 'node:test';
import assert from 'node:assert/strict';
import { setorDaViolacao, rotuloViolacao, violacoesAgrupadas, vipsDaAuditoria, rodadasDaAuditoria } from '../js/fiscalizacao.js';
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

test('vipsDaAuditoria: ordena vermelho > amarelo > verde, conta, motivos e alvos excluídos; sem rodada → rodada null', () => {
  const a = vipsDaAuditoria({ rodada_em: '2026-09-05T09:00:00Z', vips: [
    { pessoa_id: 'p2', nome: 'fernanda', veredito: 'amarelo', motivos: [{ codigo: 'promessa_vencida', texto: 'promessa vencida em 2026-09-02', gravidade: 'amarelo' }], alvos: [], evidencias: ['a.png'] },
    { pessoa_id: 'p1', nome: 'Mateus', veredito: 'vermelho', motivos: [{ codigo: 'alvo_excluido_marcado_disponivel', texto: 'anúncio 1523198681 excluído', gravidade: 'vermelho' }], alvos: [{ estado: { estado_real: 'excluido' } }, { estado: { estado_real: 'mudo' } }], canal_ultima: 'dele(a) 2026-09-02: Bom dia' },
    { pessoa_id: 'p3', nome: 'Bio', veredito: 'verde', motivos: [], alvos: [] },
  ] }, 'UTC');
  assert.deepEqual(a.vips.map((v) => v.nome), ['Mateus', 'fernanda', 'Bio']);
  assert.deepEqual(a.resumo, { total: 3, vermelhos: 1, amarelos: 1, verdes: 1 });
  assert.equal(a.vips[0].alvos, 2); assert.equal(a.vips[0].alvosExcluidos, 1); assert.equal(a.vips[0].motivos[0].texto, 'anúncio 1523198681 excluído');
  assert.equal(a.vips[0].rotulo, 'site não bate com o canal'); assert.equal(a.rodada, '05/09 09:00');
  assert.equal(vipsDaAuditoria(null).rodada, null); assert.deepEqual(vipsDaAuditoria({}).resumo, { total: 0, vermelhos: 0, amarelos: 0, verdes: 0 });
});

test('rodadasDaAuditoria: uma linha por agente com o que fez; agente sem ponto = nunca rodou; rodadas diferentes = cadeia quebrada', () => {
  const agora = new Date().toISOString();
  const r = rodadasDaAuditoria({ rodada: 'R1', agentes: {
    leitor: { atualizado_em: agora, detalhe: { pedidos: 58, lidos: 49, pulados: 9, por_motivo: { nao_achado: 5, sem_thread_para_anuncio: 4 }, ms: 638000, rodada: 'R1' } },
    confrontador: { atualizado_em: agora, detalhe: { total: 22, vermelhos: 12, amarelos: 3, verdes: 7, sem_retrato: 0, rodada: 'R1' } },
    espelho: { atualizado_em: agora, detalhe: { updates: 6, aplicados: 0, dry: true, erros: [], rodada: 'R1' } },
  } }, 'UTC');
  assert.deepEqual(r.linhas.map((l) => l.agente), ['Leitor', 'Confrontador', 'Espelho']);
  assert.equal(r.linhas[0].resumo, '58 destinos pedidos, 49 lidos, 9 pulados (5 nao_achado, 4 sem_thread_para_anuncio) · 11 s por destino');
  assert.equal(r.linhas[1].resumo, '22 VIPs: 12 vermelhos, 3 amarelos, 7 verdes');
  assert.equal(r.linhas[2].resumo, '6 correção(ões) previstas, 0 aplicadas (modo seco)');
  assert.ok(r.linhas.every((l) => l.ok)); assert.equal(r.rodada, 'R1'); assert.equal(r.mesmaRodada, true);
  const q = rodadasDaAuditoria({ agentes: { leitor: { atualizado_em: '2026-09-01T00:00:00Z', detalhe: { pedidos: 1, lidos: 1, rodada: 'R1' } }, confrontador: { atualizado_em: agora, detalhe: { sem_sessao: true, rodada: 'R2' } } } }, 'UTC');
  assert.equal(q.linhas[0].ok, false); assert.equal(q.linhas[1].resumo, 'site sem sessão: 0 VIPs'); assert.equal(q.linhas[2].resumo, 'nunca rodou'); assert.equal(q.mesmaRodada, false);
  assert.equal(rodadasDaAuditoria(null).linhas.length, 3);
});
test('vipsDaAuditoria: leva o que o site dizia (site_ultima) pro confronto na tela', () => {
  const a = vipsDaAuditoria({ rodada_em: '2026-09-05T09:00:00Z', vips: [{ pessoa_id: 'p1', nome: 'X', veredito: 'verde', motivos: [], alvos: [], canal_ultima: 'dele(a) 2026-09-05T10: oi', site_ultima: 'aguardando fotos | ligar' }] });
  assert.equal(a.vips[0].siteUltima, 'aguardando fotos | ligar'); assert.equal(a.vips[0].canalUltima, 'dele(a) 2026-09-05T10: oi');
});

// 26/09 (painel das pontas, plano autônomo do Radar, PR 4): o Ivan pediu "as pontas não estão andando juntas… não consigo
// acompanhar". Cada VIP mostra suas pontas: o estado de cada dono (lido do canal pela auditoria) ao lado de quando foi a
// última conversa com o cliente. Informação, não acusação: sinal compartilhado sai escrito como tal.
import { pontasDoVip, clienteDaUltima } from '../js/fiscalizacao.js';
test('pontasDoVip: estado de cada dono com a fonte escrita; não lido é "não lido", nunca "mudo"', () => {
  const alvos = [
    { par: { apelido: 'Sobota × casa Sorocaba' }, estado: { estado_real: 'respondeu', msgs_deles: 2, ultima_deles_olx: '2026-09-03T13:00:00Z' } },
    { par: { apelido: 'Dennys × Aviação' }, estado: { estado_real: 'respondeu', msgs_deles: 1, canal_resposta: 'whatsapp', ultima_deles: '2026-09-22T17:29:00Z' } },
    { par: { apelido: 'Ana × Gonzaga' }, estado: { estado_real: 'mudo', msgs_deles: 0, dias_mudo: 5.4 } },
    { par: { apelido: 'EWS × Centro SV' }, estado: { estado_real: 'mudo', msgs_deles: 0, dias_mudo: 9, wa_nao_lido: true } },
    { par: { apelido: 'Mateus × Tupi' }, estado: { estado_real: 'sem_conversa', msgs_deles: 0 } },
    { par: { apelido: 'Layza × Boqueirão' }, estado: { estado_real: 'excluido', msgs_deles: 0 } },
    { par: { apelido: 'X × sem retrato' }, estado: { estado_real: 'sem_retrato' } },
  ];
  const p = pontasDoVip(alvos, 'America/Sao_Paulo');
  assert.equal(p.length, 7);
  assert.equal(p[0].classe, 'respondeu'); assert.match(p[0].texto, /respondeu na OLX em 03\/09/);
  assert.equal(p[1].classe, 'respondeu'); assert.match(p[1].texto, /WhatsApp do anunciante/); assert.match(p[1].texto, /pode ser sobre outro imóvel/);
  assert.equal(p[2].classe, 'mudo'); assert.match(p[2].texto, /mudo há 5 dias/);
  assert.equal(p[3].classe, 'nao-lido'); assert.match(p[3].texto, /não lido/, 'meia conversa: não diz mudo');
  assert.equal(p[4].classe, 'sem-conversa'); assert.match(p[4].texto, /sem conversa/);
  assert.equal(p[5].classe, 'excluido'); assert.match(p[5].texto, /anúncio excluído/);
  assert.equal(p[6].classe, 'nao-lido');
  assert.deepEqual(p.map((x) => x.apelido), alvos.map((a) => a.par.apelido));
});
test('vipsDaAuditoria leva as pontas e quem falou por último com o cliente', () => {
  const a = vipsDaAuditoria({ rodada_em: '2026-09-05T09:00:00Z', vips: [{ pessoa_id: 'v', nome: 'Sobota', veredito: 'amarelo', motivos: [],
    alvos: [{ par: { apelido: 'casa' }, estado: { estado_real: 'mudo', dias_mudo: 3 } }], canal_ultima: 'nosso 2026-08-29T12:00: vou ver com o dono' }] }, 'America/Sao_Paulo');
  assert.equal(a.vips[0].pontas.length, 1);
  assert.match(a.vips[0].cliente, /nossa em 29\/08/);
  const b = vipsDaAuditoria({ vips: [{ pessoa_id: 'w', nome: 'W', veredito: 'verde', alvos: [], canal_ultima: 'dele(a) 2026-09-04T10:00: ok' }] }, 'America/Sao_Paulo');
  assert.match(b.vips[0].cliente, /dele\(a\) em 04\/09/);
  const c = vipsDaAuditoria({ vips: [{ pessoa_id: 'z', nome: 'Z', veredito: 'verde', alvos: [], canal_ultima: '' }] }, 'America/Sao_Paulo');
  assert.equal(c.vips[0].cliente, 'conversa do cliente não lida nesta rodada');
});

test('pontasDoVip (revisão): respondeu com a OLX não lida continua respondeu; sem_conversa com wa_nao_lido é não lido; mudo < 1 dia não é "mudo há 0 dias"', () => {
  const p = pontasDoVip([
    { par: { apelido: 'a' }, estado: { estado_real: 'respondeu', msgs_deles: 1, canal_resposta: 'whatsapp', olx_nao_lido: true } },
    { par: { apelido: 'b' }, estado: { estado_real: 'sem_conversa', wa_nao_lido: true } },
    { par: { apelido: 'c' }, estado: { estado_real: 'mudo', dias_mudo: 0.4 } },
    { par: { apelido: 'd' }, estado: { estado_real: 'mudo', dias_mudo: null } },
  ], 'UTC');
  assert.equal(p[0].classe, 'respondeu'); assert.match(p[0].texto, /outro imóvel/);
  assert.equal(p[1].classe, 'nao-lido');
  assert.equal(p[2].texto, 'abordado, sem resposta ainda'); assert.equal(p[3].texto, 'abordado, sem resposta ainda');
  assert.equal(clienteDaUltima('sem conversa no WhatsApp', 'UTC'), 'sem conversa com o cliente encontrada nesta rodada');
  assert.equal(clienteDaUltima('erro: whats: sem retrato nesta rodada', 'UTC'), 'conversa do cliente não lida nesta rodada');
});
