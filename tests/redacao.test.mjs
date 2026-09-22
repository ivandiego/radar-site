import test from 'node:test';
import assert from 'node:assert/strict';
import { gruposDaRedacao, linhasDaExpedicao } from '../js/redacao.js';
const agora = new Date('2026-09-04T12:00:00Z');
const payload = { grupos: [
  { destino: '5513988444944', rotulo: 'EWS', canal: 'whatsapp', recebida: { texto: 'Ivan, o apartamento no Ipiranga…', hora: '2026-09-02T11:08:00Z' },
    rascunhos: [{ id: 'f1', texto: 'Bom dia…', criado_em: '2026-09-03T14:11:00Z', origem: 'operador_relogios', estado: 'pendente_aprovacao', duplicado_de: null },
                { id: 'f2', texto: 'Bom dia…', criado_em: '2026-09-03T14:19:00Z', origem: 'operador_relogios', estado: 'pendente_aprovacao', duplicado_de: 'f1' }] },
  { destino: '5513997790904', rotulo: 'Nani', canal: 'whatsapp', recebida: null,
    rascunhos: [{ id: 'f3', texto: 'Bom dia! O valor…', criado_em: '2026-09-04T01:02:00Z', origem: 'pensador', estado: 'pendente_aprovacao', duplicado_de: null }] },
] };
test('gruposDaRedacao: esperando há Xh, hora curta, aviso de duplicata', () => {
  const g = gruposDaRedacao(payload, agora);
  assert.equal(g[0].esperandoH, 21);
  assert.equal(g[0].recebida.hora, '02/09 11:08');
  assert.equal(g[0].aviso, '2 rascunhos iguais — aprovar um rejeita o outro');
  assert.equal(g[0].rascunhos[1].ehDuplicata, true);
  assert.equal(g[1].aviso, null); assert.equal(g[1].recebida, null); assert.equal(g[1].esperandoH, 10);
});
test('linhasDaExpedicao: enviadas com prova e falhas com erro, horas curtas', () => {
  const l = linhasDaExpedicao({ enviadas: [{ id: 'e1', destino_rotulo: 'Vitor', canal: 'whatsapp', texto: 'Boa noite Vitor', enviado_em: '2026-09-01T22:58:00Z', prova_envio: 'whats 22:58 trecho' }],
    falhas: [{ id: 'x1', destino: '5513981780293', destino_rotulo: 'Maracanã', canal: 'whatsapp', texto: 'Oi, Ivan…', erro: 'WhatsApp Web nao reconhece', criado_em: '2026-09-02T23:00:00Z' }] });
  assert.equal(l.enviadas[0].hora, '01/09 22:58'); assert.equal(l.enviadas[0].prova, 'whats 22:58 trecho');
  assert.equal(l.falhas[0].rotulo, 'Maracanã'); assert.ok(l.falhas[0].erro.includes('nao reconhece'));
});
// 11/09: aprovada errada (Gustavo R3) sem como recolher — a Expedição mostra o que está na fila pra sair, com Recolher
test('linhasDaExpedicao: aprovadas na fila pra sair, pela hora da aprovação', () => {
  const l = linhasDaExpedicao({ aprovadas: [{ id: 'a1', destino: '5513997835820', destino_rotulo: 'Gustavo (R3)', canal: 'whatsapp', texto: 'Gustavo, aqui é o Ivan', aprovado_em: '2026-09-11T19:10:00Z', criado_em: '2026-09-11T09:20:00Z' }] }, 'America/Sao_Paulo');
  assert.equal(l.aprovadas.length, 1); assert.equal(l.aprovadas[0].id, 'a1');
  assert.equal(l.aprovadas[0].rotulo, 'Gustavo (R3)'); assert.equal(l.aprovadas[0].hora, '11/09 16:10');
});
test('vazio: sem grupos, sem linhas', () => {
  assert.deepEqual(gruposDaRedacao({}), []);
  assert.deepEqual(linhasDaExpedicao({}), { enviadas: [], falhas: [], aprovadas: [] });
});

test('F4.20 gruposDaRedacao: mensagem que chegou DEPOIS do rascunho vira aviso no rascunho (hora curta)', () => {
  const g = gruposDaRedacao({ grupos: [{ destino: 'd', rotulo: 'EWS', canal: 'whatsapp', recebida: { texto: 'alô?', hora: '2026-09-03T18:00:00Z' },
    rascunhos: [{ id: 'f1', texto: 'Bom dia', criado_em: '2026-09-03T14:11:00Z', origem: 'relogios', estado: 'pendente_aprovacao', duplicado_de: null, chegou_depois: { texto: 'alô?', hora: '2026-09-03T18:00:00Z' } },
                { id: 'f2', texto: 'Oi', criado_em: '2026-09-03T19:00:00Z', origem: 'pensador', estado: 'pendente_aprovacao', duplicado_de: null, chegou_depois: null }] }] }, agora);
  assert.deepEqual(g[0].rascunhos[0].chegouDepois, { texto: 'alô?', hora: '03/09 18:00' });
  assert.equal(g[0].rascunhos[1].chegouDepois, null);
});

// P4 (ficha 2026-09-21 bloqueio-fecha-na-reescrita v1.1, D2 obs.4): a Redação mostra o rótulo
// "reescrita" e o motivo original no card. O backend (edge fila `regras.ts` PR #232) manda
// `rascunhos[].reescrita = { motivo, fila_id } | null`. Aqui o view-model precisa PROPAGAR
// esse campo — o teste garante que `reescrita` chega inteiro em `g.rascunhos[].reescrita`.
test('P4 gruposDaRedacao: propaga reescrita={motivo, fila_id} quando o backend manda; null quando não manda', () => {
  const g = gruposDaRedacao({ grupos: [{ destino: 'd', rotulo: 'Ana', canal: 'whatsapp', recebida: null,
    rascunhos: [
      { id: 'f1', texto: 'oi de novo', criado_em: '2026-09-22T00:10:00Z', origem: 'pensador',
        estado: 'pendente_aprovacao', duplicado_de: null,
        reescrita: { motivo: 'saudar pelo nome', fila_id: 'aaaa-1111-bbbb-2222' } },
      { id: 'f2', texto: 'primeira vez', criado_em: '2026-09-22T00:11:00Z', origem: 'pensador',
        estado: 'pendente_aprovacao', duplicado_de: null, reescrita: null },
      { id: 'f3', texto: 'sem campo', criado_em: '2026-09-22T00:12:00Z', origem: 'pensador',
        estado: 'pendente_aprovacao', duplicado_de: null /* sem 'reescrita' */ },
    ] }] }, agora);
  assert.deepEqual(g[0].rascunhos[0].reescrita, { motivo: 'saudar pelo nome', fila_id: 'aaaa-1111-bbbb-2222' });
  assert.equal(g[0].rascunhos[1].reescrita, null);
  assert.equal(g[0].rascunhos[2].reescrita, null, 'campo ausente vira null explícito, nunca undefined');
});

// ---- 15/09: fase 1 da régua do rascunho (radar-permutas PR 218, peças 2 e 16) ----
// `barrada` é estado final: a régua segurou o texto. A tela mostra com o motivo, sem esconder.
// O motivo mora em mensagem_fila.erro como REGUA:<códigos> (gatilho fila_zz_regua); os nomes espelham REGUA_NOMES da edge.
import { motivoDaRegua, barradasDoDiario } from '../js/redacao.js';
test('motivoDaRegua: códigos da régua em português; conversa bloqueada; erro sem REGUA fica null', () => {
  assert.equal(motivoDaRegua('REGUA:travessao'), 'travessão');
  assert.equal(motivoDaRegua('REGUA:telefone,saudacao'), 'telefone, saudação de período no começo (use "Oi, <nome>!")');
  assert.equal(motivoDaRegua('REGUA:conversa_bloqueada'), 'conversa bloqueada (liberar ou escrever)');
  assert.equal(motivoDaRegua('REGUA:codigo_novo'), 'codigo novo');
  assert.equal(motivoDaRegua('WhatsApp Web nao reconhece'), null);
  assert.equal(motivoDaRegua(null), null);
});
test('barradasDoDiario: só rascunho_barrado, com hora curta, prova e sem telefone inteiro', () => {
  const b = barradasDoDiario([
    { setor: 'redacao', tipo: 'rascunho_barrado', hora: '2026-09-15T13:00:00Z', quem: '5513977002222', texto: '5513977002222 → "Boa tarde! Tudo bem?"', prova_ref: 'mensagem_fila:b1' },
    { setor: 'redacao', tipo: 'rascunho_decisao', hora: '2026-09-15T12:00:00Z', quem: 'EWS', texto: 'EWS → "Oi"', prova_ref: 'mensagem_fila:f1' },
  ], 'America/Sao_Paulo');
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], { id: 'b1', hora: '15/09 10:00', quem: '•••••••••2222', texto: '•••••••••2222 → "Boa tarde! Tudo bem?"', prova_ref: 'mensagem_fila:b1' });
  assert.deepEqual(barradasDoDiario(undefined), []);
});
