// Tela Diário de um setor (entrega 1): ações uma a uma, hora, texto real, Abrir prova.
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { ROTULOS_SETOR, rotuloTipo } from '../painel.js';

let setor = 'recepcao', itens = [];
export function configurar(s) { setor = s; }
export async function carregar() { itens = (await fila('diario_listar', { setor })).itens || []; }
const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
export function render(el) {
  const r = ROTULOS_SETOR[setor] || { titulo: setor, quem: '' };
  el.innerHTML = `
    <div class="faixa-setor"><h2>${esc(r.titulo)}</h2><span>${esc(r.quem)}</span><span>${itens.length} ações nas últimas 48h</span></div>
    <table class="diario">${itens.map((i) => `
      <tr class="linha" data-ref="${esc(i.prova_ref || '')}">
        <td class="hora">${hora(i.hora)}</td>
        <td>${esc(rotuloTipo(i.tipo, 1))}</td>
        <td>${esc(i.quem || '')}</td>
        <td>${esc(i.texto || '')}</td>
        <td>${i.prova_ref ? '<button class="abrir-prova">Abrir prova</button>' : ''}</td>
      </tr>`).join('') || '<tr><td>nada registrado</td></tr>'}
    </table>`;
  el.querySelectorAll('button.abrir-prova').forEach((b) => b.addEventListener('click', async () => {
    const ref = b.closest('tr').dataset.ref;
    try {
      const { tabela, item } = await fila('prova', { ref });
      const texto = item ? Object.entries(item).filter(([k]) => !['id', 'dedupe'].includes(k)).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n') : '(prova não encontrada)';
      document.querySelector('#ia-titulo').textContent = `Prova — ${tabela}`;
      document.querySelector('#ia-texto').value = texto;
      document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
      document.querySelector('#ia-dialog').showModal();
    } catch (e) { alert('Não consegui abrir a prova: ' + e.message); }
  }));
}
