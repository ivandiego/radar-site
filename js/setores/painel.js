// Tela Painel (entrega 1): cartões por setor com evidências + "não está acontecendo".
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { cartoesDoPainel, naoAcontecendo } from '../painel.js';

let dados = null;
export async function carregar() { dados = await fila('painel'); }
export function render(el) {
  const cartoes = cartoesDoPainel(dados || { setores: {} }, 'America/Sao_Paulo');
  const nao = naoAcontecendo(dados || {});
  el.innerHTML = `
    <div class="faixa-setor"><h2>Painel</h2><span>o que os robôs fizeram nas últimas 24h, com prova</span></div>
    <div class="cartoes">${cartoes.map((c) => `
      <div class="cartao-setor ${c.estado}" data-setor="${c.setor}">
        <b>${esc(c.titulo)}</b> <small>${esc(c.quem)}</small>
        <div>${c.rodada ? `trabalhou às <b>${c.rodada}</b> · ` : ''}${esc(c.fez)}</div>
        ${c.travado.map((t) => `<div class="travado">travado: ${esc(t)}</div>`).join('')}
        <a class="ver-diario" href="#diario/${c.setor}">Ver o diário</a>
      </div>`).join('')}
    </div>
    <div class="nao-acontecendo"><h3>O que NÃO está acontecendo</h3>
      ${nao.length ? `<ul>${nao.map((n) => `<li>${esc(n.texto)} — <a href="#diario/${n.setor}">${esc(n.setorTitulo)}</a></li>`).join('')}</ul>` : '<p>nada pendente</p>'}
    </div>`;
}
