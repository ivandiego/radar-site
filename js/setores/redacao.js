// Tela Redação (entrega 2, spec §5): rascunhos pendentes agrupados por pessoa,
// com o que ela disse; Aprovar · Editar e aprovar · Rejeitar (motivo → diário).
import { fila } from '../api.js?v=1789348087';
import { esc } from '../logic.js?v=1789348087';
import { gruposDaRedacao } from '../redacao.js?v=1789348087';
import { carregarBarradas, blocoBarradas } from './barradas.js?v=1789348087';

let dados = null, barradas = { lista: [], erro: null };
// 15/09 (fase 1 da régua): as barradas aparecem com o motivo, embaixo dos rascunhos
export async function carregar() { [dados, barradas] = await Promise.all([fila('redacao_listar'), carregarBarradas()]); }
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
          <li data-fid="${esc(r.id)}" class="${r.ehDuplicata ? 'dup' : ''}${r.reescrita ? ' reescrita' : ''}">
            <div class="meta"><small>${r.hora} · ${esc(r.origem)}${r.ehDuplicata ? ' · duplicata' : ''}${r.reescrita ? ' · reescrita' : ''}</small></div>
            ${r.reescrita ? `<div class="rotulo-reescrita">reescrita — motivo original: “${esc(r.reescrita.motivo)}”</div>` : ''}
            ${r.chegouDepois ? `<div class="aviso chegou-depois">⚠ chegou mensagem depois deste texto (${r.chegouDepois.hora}): “${esc(r.chegouDepois.texto)}”</div>` : ''}
            <div class="texto">${esc(r.texto)}</div>
            <div class="editor" hidden><textarea rows="4">${esc(r.texto)}</textarea></div>
            <div class="acoes">
              <button class="aprovar">Aprovar</button>
              <button class="editar">Editar e aprovar</button>
              <button class="aprovar-editado" hidden>Aprovar texto editado</button>
              <button class="rejeitar">Rejeitar</button>
            </div>
          </li>`).join('')}</ul>
      </div>`).join('') : '<p>Nada esperando você. 🎉</p>'}
    ${blocoBarradas(barradas)}`;
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
      // P4 D6: motivo obrigatório. A edge também recusa por 422, mas avisar aqui evita a ida ao servidor.
      const motivo = prompt('Motivo em uma linha (vai pro diário e ensina o Pensador):');
      if (motivo === null) return;
      const t = (motivo || '').trim();
      if (t.length < 3) { alert('Motivo é obrigatório (mínimo 3 caracteres).'); return; }
      try { await fila('rejeitar', { id, motivo: t }); await recarregar(); } catch (e) { alert('Não consegui rejeitar: ' + e.message); }
    });
  });
}
