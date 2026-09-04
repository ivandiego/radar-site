// Tela Redação (entrega 2, spec §5): rascunhos pendentes agrupados por pessoa,
// com o que ela disse; Aprovar · Editar e aprovar · Rejeitar (motivo → diário).
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { gruposDaRedacao } from '../redacao.js';

let dados = null;
export async function carregar() { dados = await fila('redacao_listar'); }
export function render(el) {
  const grupos = gruposDaRedacao(dados || {}, new Date(), 'America/Sao_Paulo');
  const total = grupos.reduce((n, g) => n + g.rascunhos.length, 0);
  el.innerHTML = `
    <div class="faixa-setor"><h2>Redação</h2><span>Pensador</span><span>${total} rascunho${total === 1 ? '' : 's'} esperando você</span></div>
    ${grupos.length ? grupos.map((g) => `
      <div class="grupo-redacao" data-destino="${esc(g.destino)}">
        <div class="cabeca"><b>${esc(g.rotulo)}</b> <small>${esc(g.canal)} · esperando há ${g.esperandoH}h</small></div>
        ${g.recebida ? `<div class="disse">ele(a) disse (${g.recebida.hora}): “${esc(g.recebida.texto)}”</div>` : '<div class="disse">sem mensagem recente dele(a) na caixa</div>'}
        ${g.aviso ? `<div class="aviso">${esc(g.aviso)}</div>` : ''}
        <ul>${g.rascunhos.map((r) => `
          <li data-fid="${esc(r.id)}" class="${r.ehDuplicata ? 'dup' : ''}">
            <div class="meta"><small>${r.hora} · ${esc(r.origem)}${r.ehDuplicata ? ' · duplicata' : ''}</small></div>
            <div class="texto">${esc(r.texto)}</div>
            <div class="editor" hidden><textarea rows="4">${esc(r.texto)}</textarea></div>
            <div class="acoes">
              <button class="aprovar">Aprovar</button>
              <button class="editar">Editar e aprovar</button>
              <button class="aprovar-editado" hidden>Aprovar texto editado</button>
              <button class="rejeitar">Rejeitar</button>
            </div>
          </li>`).join('')}</ul>
      </div>`).join('') : '<p>Nada esperando você. 🎉</p>'}`;
  const recarregar = async () => { await carregar(); render(el); };
  el.querySelectorAll('.grupo-redacao li').forEach((li) => {
    const id = li.dataset.fid;
    li.querySelector('button.aprovar').addEventListener('click', async () => {
      try { await fila('aprovar', { id }); await recarregar(); } catch (e) { alert('Não consegui aprovar: ' + e.message); }
    });
    li.querySelector('button.editar').addEventListener('click', () => {
      li.querySelector('.editor').hidden = false; li.querySelector('button.aprovar-editado').hidden = false;
      li.querySelector('button.editar').hidden = true; li.querySelector('.texto').hidden = true;
    });
    li.querySelector('button.aprovar-editado').addEventListener('click', async () => {
      const texto = li.querySelector('textarea').value.trim();
      if (!texto) { alert('Texto vazio.'); return; }
      try { await fila('aprovar_editado', { id, texto }); await recarregar(); } catch (e) { alert('Não consegui aprovar: ' + e.message); }
    });
    li.querySelector('button.rejeitar').addEventListener('click', async () => {
      const motivo = prompt('Motivo em uma linha (vai pro diário e ensina o Pensador):');
      if (motivo === null) return;
      try { await fila('rejeitar', { id, motivo }); await recarregar(); } catch (e) { alert('Não consegui rejeitar: ' + e.message); }
    });
  });
}
