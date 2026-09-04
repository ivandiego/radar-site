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
test('vazio: sem grupos, sem linhas', () => {
  assert.deepEqual(gruposDaRedacao({}), []);
  assert.deepEqual(linhasDaExpedicao({}), { enviadas: [], falhas: [] });
});
