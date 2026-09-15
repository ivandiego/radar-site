import test from 'node:test';
import assert from 'node:assert/strict';
import { cartoesDoPainel, rotuloTipo, naoAcontecendo, ROTULOS_SETOR } from '../js/painel.js';

const vazio = { ultima_rodada: null, fez: [], travado: [] };
const payload = {
  setores: {
    recepcao: { ultima_rodada: '2026-09-03T22:00:00Z', fez: [{ tipo: 'chat_lido', n: 37 }, { tipo: 'recebida', n: 184 }], travado: ['WhatsApp deslogado (QR) desde 21:59'] },
    redacao: { ultima_rodada: '2026-09-03T22:02:00Z', fez: [{ tipo: 'rascunho_liberado', n: 4 }, { tipo: 'rascunho_decisao', n: 6 }], travado: [] },
    expedicao: vazio, cobranca: vazio, garimpo: vazio, fiscalizacao: vazio,
  },
  nao_acontecendo: [{ tipo: 'cliente_sem_resposta', texto: 'Nani sem resposta há 3h', setor: 'redacao', ref: 'mensagem_recebida:r1' }],
};
test('rotuloTipo: português de gente, singular/plural', () => {
  assert.equal(rotuloTipo('chat_lido'), 'chats lidos');
  assert.equal(rotuloTipo('chat_lido', 1), 'chat lido');
  assert.equal(rotuloTipo('rascunho_decisao'), 'rascunhos pra você decidir');
  assert.equal(rotuloTipo('ordem_concluida'), 'ordens concluídas');
  assert.equal(rotuloTipo('tipo_desconhecido'), 'tipo desconhecido');
});
test('cartoesDoPainel: um cartão por setor, na ordem, com "fez" em texto', () => {
  const cs = cartoesDoPainel(payload);
  assert.equal(cs.length, 6);
  assert.equal(cs[0].setor, 'recepcao'); assert.equal(cs[0].titulo, ROTULOS_SETOR.recepcao.titulo);
  assert.equal(cs[0].rodada, '22:00');
  assert.equal(cs[0].fez, '37 chats lidos · 184 recebidas');
  assert.equal(cs[0].estado, 'atencao');
  assert.equal(cs[1].fez, '4 rascunhos liberados · 6 rascunhos pra você decidir');
  assert.equal(cs[1].estado, 'ok');
});
test('cartoesDoPainel: setor sem rodada = parado', () => {
  const cs = cartoesDoPainel(payload);
  assert.equal(cs[2].estado, 'parado'); assert.equal(cs[2].rodada, null); assert.equal(cs[2].fez, 'nada registrado nas últimas 24h');
});
test('naoAcontecendo: repassa com rótulo do setor', () => {
  const n = naoAcontecendo(payload);
  assert.equal(n[0].setorTitulo, 'Redação'); assert.equal(n[0].ref, 'mensagem_recebida:r1');
});

// ---- PR 2 (04/09): alarmes no topo do Painel ----
import { alarmesDoPainel } from '../js/painel.js';
test('alarmesDoPainel: alarmes com rótulo do setor, hora curta e texto; vazio → []', () => {
  const a = alarmesDoPainel({ alarmes: [
    { id: 'a2', setor: 'expedicao', hora: '2026-09-04T02:00:00Z', texto: 'envio_falhou: Lilis — deslogado', prova_ref: 'mensagem_fila:f3', motivo: 'envio_falhou' },
    { id: 'a1', setor: 'recepcao', hora: '2026-09-04T01:00:00Z', texto: 'lacuna: possível perda no chat da Lilis', prova_ref: 'chat_varrido:5513', motivo: 'lacuna' },
  ] });
  assert.equal(a.length, 2);
  assert.equal(a[0].setorTitulo, 'Expedição'); assert.equal(a[0].hora, '02:00'); assert.equal(a[0].id, 'a2');
  assert.equal(a[1].texto, 'lacuna: possível perda no chat da Lilis');
  assert.deepEqual(alarmesDoPainel({}), []);
});
test('cartoesDoPainel: setor com alarme aberto fica em atenção mesmo sem travado', () => {
  const p = { setores: { recepcao: { ultima_rodada: '2026-09-03T22:00:00Z', fez: [], travado: [] } }, alarmes: [{ id: 'a1', setor: 'recepcao', hora: '2026-09-04T01:00:00Z', texto: 'lacuna: x', motivo: 'lacuna' }] };
  assert.equal(cartoesDoPainel(p)[0].estado, 'atencao');
});

// Entrega 4: faixa comum das telas de setor
import { faixaDoSetor } from '../js/painel.js';
test('faixaDoSetor: título, quem, rodada em BRT, fez, travado e alarmes do setor', () => {
  const p = { setores: { recepcao: { ultima_rodada: '2026-09-04T01:00:00Z', fez: [{ tipo: 'chat_lido', n: 37 }], travado: ['WhatsApp deslogado (QR) desde 14:40'] } }, alarmes: [{ setor: 'recepcao' }, { setor: 'redacao' }] };
  const f = faixaDoSetor(p, 'recepcao', 'America/Sao_Paulo');
  assert.equal(f.titulo, 'Recepção'); assert.equal(f.quem, 'Coletor + Ouvidor');
  assert.equal(f.rodada, '22:00'); assert.equal(f.fez, '37 chats lidos');
  assert.deepEqual(f.travado, ['WhatsApp deslogado (QR) desde 14:40']); assert.equal(f.alarmes, 1); assert.equal(f.estado, 'atencao');
  assert.equal(faixaDoSetor({}, 'garimpo', 'UTC').estado, 'parado');
});

// Entrega 5 (spec §4): VIP mudo há 5+ dias
import { vipsMudos } from '../js/painel.js';
test('vipsMudos: VIP ativo sem interação há 5+ dias (ou nunca) entra, maior atraso primeiro; não-VIP, inativo e recente ficam fora', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  const cs = [
    { pessoa: { id: 'a', nome_exibicao: 'A', estagio: '3-x', diferenca_max: 1, ultima_interacao: '2026-09-01T12:00:00Z' }, pares: [] },
    { pessoa: { id: 'b', nome_exibicao: 'B', estagio: '3-x', diferenca_max: 1, ultima_interacao: '2026-09-08T12:00:00Z' }, pares: [] },
    { pessoa: { id: 'c', nome_exibicao: 'C', estagio: '3-x', diferenca_max: 0, ultima_interacao: null }, pares: [] },
    { pessoa: { id: 'd', nome_exibicao: 'D', estagio: '4-x', diferenca_max: 1, ultima_interacao: null }, pares: [] },
    { pessoa: { id: 'e', nome_exibicao: 'E', estagio: '1-x', diferenca_max: 1, ultima_interacao: null }, pares: [] },
  ];
  assert.deepEqual(vipsMudos(cs, now), [{ pessoaId: 'd', nome: 'D', dias: null }, { pessoaId: 'a', nome: 'A', dias: 9 }]);
  assert.deepEqual(vipsMudos(cs, now, 10), [{ pessoaId: 'd', nome: 'D', dias: null }]);
});

// ---- 13/09: falha ao abrir no painel (ficha do Radar 2026-09-12-o-recibo-de-pular-guarda-o-nome, Solução 3) ----
// A função `fila` passa a emitir o tipo `falha_abrir` para o recibo de falha ao abrir, só com o tipo (o texto do erro
// carrega nome — decisão do Ivan). Sem rótulo, o tipo aparecia cru ("falha abrir") na linha "fez" e no Diário.
test('rotuloTipo: falha_abrir tem rótulo de gente, singular e plural', () => {
  assert.equal(rotuloTipo('falha_abrir', 1), 'falha ao abrir');
  assert.equal(rotuloTipo('falha_abrir'), 'falhas ao abrir');
});
test('cartoesDoPainel: falha_abrir entra no "fez" com o rótulo, ao lado dos chats lidos', () => {
  const p = { setores: { ...payload.setores, recepcao: { ultima_rodada: '2026-09-13T15:00:00Z', fez: [{ tipo: 'chat_lido', n: 12 }, { tipo: 'falha_abrir', n: 3 }], travado: [] } } };
  assert.equal(cartoesDoPainel(p)[0].fez, '12 chats lidos · 3 falhas ao abrir');
});

// ---- 15/09: fase 1 da régua do rascunho (radar-permutas PR 218, ficha 2026-09-14-rascunho-errado-e-reescrita v13.1, peça 16) ----
// A edge `fila` passa a mandar o item `conversa_bloqueada` (ref bloqueio_conversa:<id>) e `contadores` no painel.
// null nos contadores = "não sei" (a peteca não foi lida), NUNCA zero. Telefone nunca aparece inteiro na tela.
import { contadoresDoPainel, mascararDestino, mascararTelefones, pedidoDeLiberacao } from '../js/painel.js';
test('rotuloTipo: rascunho_barrado, conversa_bloqueada e bloqueio_fechado com rótulo de gente', () => {
  assert.equal(rotuloTipo('rascunho_barrado', 1), 'rascunho barrado');
  assert.equal(rotuloTipo('rascunho_barrado'), 'rascunhos barrados');
  assert.equal(rotuloTipo('conversa_bloqueada'), 'conversas bloqueadas');
  assert.equal(rotuloTipo('bloqueio_fechado', 1), 'conversa liberada');
});
test('mascararDestino: telefone vira •••••••••1234; chat-id da OLX não é telefone e fica', () => {
  assert.equal(mascararDestino('5513977002222'), '•••••••••2222');
  assert.equal(mascararDestino('(13) 97700-2222'), '•••••••••2222');
  assert.equal(mascararDestino('==abc@conference.olxbr'), '==abc@conference.olxbr');
  assert.equal(mascararDestino(''), '');
  assert.equal(mascararDestino(null), '');
});
test('mascararTelefones: número dentro do texto sai mascarado; número curto (valor, hora) fica', () => {
  assert.equal(mascararTelefones('5513977002222 bloqueada: liberar ou escrever'), '•••••••••2222 bloqueada: liberar ou escrever');
  assert.equal(mascararTelefones('ligar (11) 94956-4957 hoje'), 'ligar •••••••••4957 hoje');
  assert.equal(mascararTelefones('Nani sem resposta há 3h: "200 mil"'), 'Nani sem resposta há 3h: "200 mil"');
  assert.equal(mascararTelefones('prazo 2026-09-15 às 10:00'), 'prazo 2026-09-15 às 10:00');
});
test('naoAcontecendo: conversa_bloqueada pode ser liberada e o texto não mostra telefone inteiro', () => {
  const n = naoAcontecendo({ nao_acontecendo: [
    { tipo: 'conversa_bloqueada', texto: '5513977002222 bloqueada: liberar ou escrever', setor: 'redacao', ref: 'bloqueio_conversa:bl1' },
    { tipo: 'cliente_sem_resposta', texto: 'Nani sem resposta há 3h', setor: 'redacao', ref: 'mensagem_recebida:r1' },
  ] });
  assert.equal(n[0].liberavel, true); assert.equal(n[0].texto, '•••••••••2222 bloqueada: liberar ou escrever');
  assert.equal(n[0].ref, 'bloqueio_conversa:bl1');
  assert.equal(n[1].liberavel, false);
});
test('contadoresDoPainel: número vira número; null e ausente viram "não sei", nunca 0', () => {
  const c = contadoresDoPainel({ contadores: { bloqueios_abertos: 2, barradas_repetidas: 0, petecas_excluidas_por_bloqueio: null, petecas_sem_identidade: 3, peteca_sem_conversa: null } });
  const por = Object.fromEntries(c.map((x) => [x.chave, x]));
  assert.deepEqual(c.map((x) => x.chave), ['bloqueios_abertos', 'barradas_repetidas', 'petecas_excluidas_por_bloqueio', 'petecas_sem_identidade', 'peteca_sem_conversa']);
  assert.equal(por.bloqueios_abertos.valor, '2'); assert.equal(por.bloqueios_abertos.sabe, true);
  assert.equal(por.barradas_repetidas.valor, '0'); assert.equal(por.barradas_repetidas.sabe, true);
  assert.equal(por.petecas_excluidas_por_bloqueio.valor, 'não sei'); assert.equal(por.petecas_excluidas_por_bloqueio.sabe, false);
  assert.equal(por.peteca_sem_conversa.valor, 'não sei');
  assert.ok(c.every((x) => x.rotulo && !x.rotulo.includes('—')), 'rótulo em português, sem travessão');
  // edge antiga (sem contadores): tudo "não sei"
  assert.ok(contadoresDoPainel({}).every((x) => x.valor === 'não sei' && x.sabe === false));
});
test('pedidoDeLiberacao: da prova do bloqueio sai {canal, destino}; fechado ou incompleto não libera', () => {
  const ok = pedidoDeLiberacao({ id: 'bl1', canal: 'whatsapp', destino_canonico: '5513977002222', fechado_em: null, motivo: 'rejeitado' });
  assert.deepEqual(ok, { ok: true, canal: 'whatsapp', destino: '5513977002222', destinoMascarado: '•••••••••2222' });
  assert.equal(pedidoDeLiberacao({ canal: 'whatsapp', destino_canonico: '5513977002222', fechado_em: '2026-09-15T10:00:00Z' }).ok, false);
  assert.match(pedidoDeLiberacao({ canal: 'whatsapp', destino_canonico: '5513977002222', fechado_em: '2026-09-15T10:00:00Z' }).erro, /já está liberada/);
  assert.equal(pedidoDeLiberacao(null).ok, false);
  assert.equal(pedidoDeLiberacao({ canal: '', destino_canonico: 'x' }).ok, false);
});
