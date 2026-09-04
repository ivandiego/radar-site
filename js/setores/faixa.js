// Faixa comum das telas de setor (entrega 4, spec §2): quem trabalha · última rodada · o que fez · travado.
import { esc } from '../logic.js';
import { fila } from '../api.js';
export function faixa(f, setor) {
  return `<div class="faixa-setor ${f.estado}"><h2>${esc(f.titulo)}</h2><span>${esc(f.quem)}</span><span>${f.rodada ? `última rodada às <b>${f.rodada}</b>` : 'sem rodada nas últimas 24h'}</span><span>${esc(f.fez)}</span>${f.travado.map((t) => `<span class="travado">travado: ${esc(t)}</span>`).join('')}<a class="ver-diario" href="#diario/${setor}">Ver o diário</a></div>`;
}
// Abre a prova de uma referência tabela:chave no diálogo comum do site.
export async function abrirProva(ref) {
  try {
    const { tabela, item } = await fila('prova', { ref });
    document.querySelector('#ia-titulo').textContent = `Prova — ${tabela}`;
    document.querySelector('#ia-texto').value = item ? Object.entries(item).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n') : '(prova não encontrada)';
    document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
    document.querySelector('#ia-dialog').showModal();
  } catch (e) { alert('Não consegui abrir a prova: ' + e.message); }
}
