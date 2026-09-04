// Tela Painel (entrega 1): cartões por setor com evidências + "não está acontecendo".
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { cartoesDoPainel, naoAcontecendo, alarmesDoPainel } from '../painel.js';

let dados = null;
export async function carregar() { dados = await fila('painel'); }
export function render(el) {
  const cartoes = cartoesDoPainel(dados || { setores: {} }, 'America/Sao_Paulo');
  const nao = naoAcontecendo(dados || {});
  const alarmes = alarmesDoPainel(dados || {}, 'America/Sao_Paulo');
  el.innerHTML = `
    <div class="faixa-setor"><h2>Painel</h2><span>o que os robôs fizeram nas últimas 24h, com prova</span></div>
    ${alarmes.length ? `<div class="alarmes"><h3>🔴 Alarmes abertos (${alarmes.length})</h3><ul>${alarmes.map((a) => `
      <li data-alarme="${esc(a.id)}" data-ref="${esc(a.prova_ref || '')}"><b>${a.hora}</b> ${esc(a.setorTitulo)} — ${esc(a.texto)}
        ${a.prova_ref ? '<button class="abrir-prova">Abrir prova</button>' : ''}<button class="resolver">Resolvido</button></li>`).join('')}</ul></div>` : ''}
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
  el.querySelectorAll('.alarmes button.resolver').forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('li').dataset.alarme;
    try { await fila('alarme_resolver', { id }); await carregar(); render(el); } catch (e) { alert('Não consegui resolver: ' + e.message); }
  }));
  el.querySelectorAll('.alarmes button.abrir-prova').forEach((b) => b.addEventListener('click', async () => {
    const ref = b.closest('li').dataset.ref;
    try {
      const { tabela, item } = await fila('prova', { ref });
      document.querySelector('#ia-titulo').textContent = `Prova — ${tabela}`;
      document.querySelector('#ia-texto').value = item ? Object.entries(item).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n') : '(prova não encontrada)';
      document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
      document.querySelector('#ia-dialog').showModal();
    } catch (e) { alert('Não consegui abrir a prova: ' + e.message); }
  }));
}
