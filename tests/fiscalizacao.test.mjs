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
