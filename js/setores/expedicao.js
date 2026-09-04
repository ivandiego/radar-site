// Tela Expedição (entrega 2, spec §5): enviadas com prova; falhas com o erro,
// Tentar de novo · Mandei eu mesmo · Abrir prova.
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { linhasDaExpedicao } from '../redacao.js';

let dados = null;
export async function carregar() { dados = await fila('expedicao_listar'); }
async function abrirProva(id) {
  try {
    const { tabela, item } = await fila('prova', { ref: 'mensagem_fila:' + id });
    document.querySelector('#ia-titulo').textContent = `Prova — ${tabela}`;
    document.querySelector('#ia-texto').value = item ? Object.entries(item).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n') : '(prova não encontrada)';
    document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
    document.querySelector('#ia-dialog').showModal();
  } catch (e) { alert('Não consegui abrir a prova: ' + e.message); }
}
export function render(el) {
  const { enviadas, falhas } = linhasDaExpedicao(dados || {}, 'America/Sao_Paulo');
  el.innerHTML = `
    <div class="faixa-setor"><h2>Expedição</h2><span>Carteiro</span><span>${enviadas.length} enviadas · ${falhas.length} falhas (48h)</span></div>
    <div class="falhas"><h3>Falhas de envio</h3>
      ${falhas.length ? `<ul>${falhas.map((f) => `
        <li data-fid="${esc(f.id)}"><b>${esc(f.rotulo)}</b> <small>${esc(f.canal)} · ${f.hora}</small>
          <div class="texto">${esc(f.texto)}</div><div class="erro">erro: ${esc(f.erro)}</div>
          <div class="acoes"><button class="tentar">Tentar de novo</button><button class="manual">Mandei eu mesmo</button></div>
        </li>`).join('')}</ul>` : '<p>nenhuma falha</p>'}
    </div>
    <div class="enviadas"><h3>Enviadas</h3>
      ${enviadas.length ? `<ul>${enviadas.map((e) => `
        <li data-fid="${esc(e.id)}"><b>${esc(e.rotulo)}</b> <small>${esc(e.canal)} · ${e.hora}</small>
          <div class="texto">${esc(e.texto)}</div><div class="prova"><small>prova: ${esc(e.prova)}</small> <button class="abrir-prova">Abrir prova</button></div>
        </li>`).join('')}</ul>` : '<p>nada enviado nas últimas 48h</p>'}
    </div>`;
  const recarregar = async () => { await carregar(); render(el); };
  el.querySelectorAll('.falhas li').forEach((li) => {
    const id = li.dataset.fid;
    li.querySelector('button.tentar').addEventListener('click', async () => { try { await fila('tentar_de_novo', { id }); await recarregar(); } catch (e) { alert(e.message); } });
    li.querySelector('button.manual').addEventListener('click', async () => { try { await fila('mandei_eu_mesmo', { id }); await recarregar(); } catch (e) { alert(e.message); } });
  });
  el.querySelectorAll('.enviadas button.abrir-prova').forEach((b) => b.addEventListener('click', () => abrirProva(b.closest('li').dataset.fid)));
}
