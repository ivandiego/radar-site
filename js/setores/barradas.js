// 15/09 (fase 1 da régua do rascunho, radar-permutas PR 218, peças 2 e 16): o que a régua barrou, com o motivo, sem esconder.
// Mostrado na Redação e na Expedição. Fonte: diário da Redação (rascunho_barrado) + prova da linha (erro = REGUA:<códigos>).
import { fila } from '../api.js?v=1789348087';
import { esc } from '../logic.js?v=1789348087';
import { barradasDoDiario, motivoDaRegua } from '../redacao.js?v=1789348087';

const MAX_MOTIVOS = 30;
export async function carregarBarradas() {
  try {
    const lista = barradasDoDiario((await fila('diario_listar', { setor: 'redacao', horas: 48 })).itens || [], 'America/Sao_Paulo');
    await Promise.all(lista.slice(0, MAX_MOTIVOS).map(async (b) => {
      if (!b.prova_ref) return;
      try { const { item } = await fila('prova', { ref: b.prova_ref }); b.motivo = motivoDaRegua(item && item.erro) || 'motivo não registrado'; }
      catch (e) { b.motivo = 'não consegui ler o motivo: ' + e.message; }
    }));
    return { lista, erro: null };
  } catch (e) { return { lista: [], erro: e.message }; }
}
export function blocoBarradas(r) {
  const cab = '<h3>Barradas pela régua (48h)</h3>';
  if (r.erro) return `<div class="barradas">${cab}<p class="erro">não consegui ler as barradas: ${esc(r.erro)}</p></div>`;
  return `<div class="barradas">${cab}<p class="explica">A régua segurou estes textos: eles não saem. Se precisar, escreva de novo.</p>
    ${r.lista.length ? `<ul>${r.lista.map((b) => `
      <li data-fid="${esc(b.id)}"><b>${esc(b.quem)}</b> <small>${b.hora} · barrada</small>
        <div class="texto">${esc(b.texto)}</div><div class="motivo">motivo: ${esc(b.motivo || 'motivo não lido')}</div>
      </li>`).join('')}</ul>` : '<p>nenhuma barrada nas últimas 48h</p>'}
  </div>`;
}
