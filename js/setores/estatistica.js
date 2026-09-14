// Tela Estatística (F4.10, 07/09): números das abordagens calculados por script a cada rodada da auditoria
// (estatistica_rodada). Taxa de resposta por canal, tempo até responder, sondagens com uma mensagem só, resposta por
// frase de abertura, quem está esperando resposta nossa, e a série por rodada. Sem LLM.
import { fila } from '../api.js?v=1789348087';
import { esc } from '../logic.js?v=1789348087';
import { resumoDe, linhasAbertura, bolaConosco, serieTexto } from '../estatistica.js?v=1789348087';

let dados = null;
export async function carregar() { dados = await fila('estatistica_ultima').catch(() => null); }
const TZ = 'America/Sao_Paulo';
const cartao = (titulo, c) => `<div class="est-cartao"><h3>${titulo}</h3><ul>
  <li><b>${c.respondidas} de ${c.abordagens}</b> abordagens nossas respondidas (${c.taxa})</li>
  <li>tempo até a 1ª resposta: <b>${c.mediana}</b> (mediana); dentro de 24 h: ${c.dentro24}</li>
  <li>uma mensagem só, sem cobrança: <b>${c.umaMsg}</b>; mudos: ${c.mudos}</li>
  <li>iniciadas por eles: <b>${c.iniciadas}</b>; respondemos ${c.respondidasPorNos}</li>
  <li>esperando resposta nossa agora: <b class="${c.bola ? 'alerta' : ''}">${c.bola}</b></li></ul></div>`;
export function render(el) {
  const r = resumoDe(dados && dados.ultima && dados.ultima.dados, TZ);
  if (!r) { el.innerHTML = '<h2>Estatística</h2><p class="vazio">Sem estatística ainda: ela é calculada ao fim de cada rodada da auditoria.</p>'; return; }
  const ab = linhasAbertura(dados.ultima.dados.olx);
  const bola = bolaConosco(dados.ultima.dados, TZ);
  const serie = serieTexto(dados.serie || [], TZ);
  el.innerHTML = `<h2>Estatística <small>calculada em ${esc(r.quando)} · ${r.conversas} conversas lidas</small></h2>
    <div class="est-grade">${cartao('OLX (sondagens de anúncio)', r.olx)}${cartao('WhatsApp', r.whatsapp)}</div>
    <div class="viol-bloco est-abertura"><h3>Resposta por frase de abertura (OLX)</h3>
      ${ab.length ? `<table class="est-tabela"><thead><tr><th>abertura</th><th>respondidas</th></tr></thead><tbody>${ab.map((a) => `<tr class="${a.melhor ? 'melhor' : ''}"><td>${esc(a.abertura)}</td><td>${esc(a.texto)}${a.melhor ? ' <small>melhor</small>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="vazio">sem abordagens datadas</p>'}</div>
    <div class="viol-bloco est-bola"><h3>Esperando resposta nossa (${bola.length})</h3>
      ${bola.length ? `<table class="est-tabela bola"><thead><tr><th>dias</th><th>quem</th><th>canal</th><th>última mensagem</th><th></th></tr></thead><tbody>${bola.map((b) => `<tr class="${b.nunca ? 'nunca' : ''}" data-destino="${esc(b.destino)}"><td>${b.dias}</td><td>${esc(b.quem)}${b.nunca ? ' <small>nunca respondida</small>' : ''}</td><td>${esc(b.canal)}</td><td>${esc(b.ultima)} <small>${esc(b.quando)}</small></td><td><a href="${esc(b.href)}">Responder</a></td></tr>`).join('')}</tbody></table>` : '<p class="vazio">ninguém esperando</p>'}</div>
    <div class="viol-bloco est-serie"><h3>Por rodada</h3>${serie.length ? `<table class="est-tabela"><thead><tr><th>rodada</th><th>taxa OLX</th><th>abordagens</th><th>esperando nós</th></tr></thead><tbody>${serie.map((s) => `<tr><td>${esc(s.quando)}</td><td>${esc(s.taxa)}</td><td>${s.abordagens}</td><td>${s.bola}</td></tr>`).join('')}</tbody></table>` : ''}</div>`;
}
