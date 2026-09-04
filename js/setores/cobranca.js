// Tela Cobrança (entrega 4, spec §5): promessas nossas/deles (vencidas primeiro);
// Cumprida · Renegociar (prazo novo) · Lembrar agora (rotina) · petecas cobradas com prova.
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { faixaDoSetor } from '../painel.js';
import { blocosDaCobranca } from '../cobranca.js';
import { faixa, abrirProva } from './faixa.js';

let dados = null, painel = null;
export async function carregar() { [dados, painel] = await Promise.all([fila('cobranca_listar'), fila('painel')]); }
const item = (c, botoes) => `<li data-cid="${esc(c.id)}" class="${c.vencida ? 'vencida' : ''}"><b>${esc(c.rotulo)}</b> ${esc(c.o_que)} <small>prazo ${c.prazo}${c.vencida ? ` · vencida há ${c.atrasoH}h` : ''}</small><div class="acoes">${botoes}</div></li>`;
export function render(el) {
  const f = faixaDoSetor(painel || {}, 'cobranca', 'America/Sao_Paulo');
  const b = blocosDaCobranca(dados || {}, new Date(), 'America/Sao_Paulo');
  el.innerHTML = `${faixa(f, 'cobranca')}
    <div class="acoes-setor"><span class="resumo-cob">${b.resumo.nossasVencidas} promessas nossas vencidas · ${b.resumo.delesVencidas} deles vencidas</span></div>
    <div class="promessas nossas"><h3>Promessas nossas</h3>${b.nossas.length ? `<ul>${b.nossas.map((c) => item(c, '<button class="cumprida">Cumprida</button><button class="renegociar">Renegociar</button>')).join('')}</ul>` : '<p>nenhuma promessa nossa aberta</p>'}</div>
    <div class="promessas deles"><h3>Promessas deles</h3>${b.deles.length ? `<ul>${b.deles.map((c) => item(c, '<button class="cumprida">Cumprida</button><button class="lembrar">Lembrar agora</button>')).join('')}</ul>` : '<p>nenhuma promessa deles aberta</p>'}</div>
    <div class="petecas"><h3>Petecas cobradas (24h)</h3>${b.petecas.length ? `<ul>${b.petecas.map((p) => `<li data-ref="${esc(p.prova_ref || '')}"><b>${p.hora}</b> ${esc(p.quem)} — ${esc(p.texto)} ${p.prova_ref ? '<button class="abrir-prova">Abrir prova</button>' : ''}</li>`).join('')}</ul>` : '<p>nenhuma cobrança nas últimas 24h</p>'}</div>`;
  const recarregar = async () => { await carregar(); render(el); };
  const acao = async (fn) => { try { await fn(); await recarregar(); } catch (e) { alert(e.message); } };
  el.querySelectorAll('.promessas li').forEach((li) => {
    const id = li.dataset.cid;
    li.querySelector('button.cumprida').addEventListener('click', () => acao(() => fila('agenda_cumprir', { id })));
    const ren = li.querySelector('button.renegociar');
    if (ren) ren.addEventListener('click', () => { const novo = prompt('Novo prazo (AAAA-MM-DD):'); if (novo) acao(() => fila('agenda_renegociar', { id, novo_prazo: novo })); });
    const lem = li.querySelector('button.lembrar');
    if (lem) lem.addEventListener('click', () => { if (confirm('Enfileirar o lembrete de rotina agora? O prazo anda +24h.')) acao(() => fila('agenda_lembrar', { id })); });
  });
  el.querySelectorAll('.petecas button.abrir-prova').forEach((b2) => b2.addEventListener('click', () => abrirProva(b2.closest('li').dataset.ref)));
}
