// Tela Garimpo (entrega 4, spec §2/§5): régua de meta (VIPs abaixo da meta → Garimpar alvos),
// ordens (Cancelar ordem), alvos novos com prova.
import { fila, fetchCarteira } from '../api.js';
import { esc, payloadGarimpo } from '../logic.js';
import { faixaDoSetor } from '../painel.js';
import { ordensDoGarimpo, reguaDeMeta, alvosNovos } from '../garimpo.js';
import { faixa, abrirProva } from './faixa.js';

let ordens = null, diario = null, painel = null, carteiras = [];
export async function carregar() {
  [ordens, diario, painel, carteiras] = await Promise.all([fila('garimpo_listar'), fila('diario_listar', { setor: 'garimpo', horas: 48 }), fila('painel'), fetchCarteira()]);
}
export function render(el) {
  const f = faixaDoSetor(painel || {}, 'garimpo', 'America/Sao_Paulo');
  const regua = reguaDeMeta(carteiras, new Date());
  const os = ordensDoGarimpo((ordens || {}).itens, 'America/Sao_Paulo');
  const novos = alvosNovos((diario || {}).itens, 'America/Sao_Paulo');
  el.innerHTML = `${faixa(f, 'garimpo')}
    <div class="regua-bloco"><h3>Régua de meta — VIPs abaixo da meta</h3>${regua.length ? `<ul class="regua">${regua.map((r) => `
      <li data-pid="${esc(r.pessoa.id)}"><b>${esc(r.pessoa.nome_exibicao || '')}</b> <span>${r.vivos}/${r.meta} alvos vivos</span> <button class="garimpar">Garimpar alvos</button></li>`).join('')}</ul>` : '<p>todos os VIPs ativos estão na meta</p>'}</div>
    <div class="ordens-bloco"><h3>Ordens</h3>${os.length ? `<ul class="ordens">${os.map((o) => `
      <li data-gid="${esc(o.id)}"><b>${esc(o.estado)}</b> ${esc(o.pessoa_nome)} <small>meta ${esc(String(o.meta ?? ''))} · ${o.hora}</small> <span class="resultado">${esc(o.resultado)}</span>${o.cancelavel ? ' <button class="cancelar">Cancelar ordem</button>' : ''}</li>`).join('')}</ul>` : '<p>nenhuma ordem</p>'}</div>
    <div class="novos-bloco"><h3>Alvos novos (48h)</h3>${novos.length ? `<ul class="novos">${novos.map((n) => `<li data-ref="${esc(n.prova_ref || '')}"><b>${n.hora}</b> ${esc(n.quem)} — ${esc(n.texto)} ${n.prova_ref ? '<button class="abrir-prova">Abrir prova</button>' : ''}</li>`).join('')}</ul>` : '<p>nenhum alvo novo nas últimas 48h</p>'}</div>`;
  const recarregar = async () => { await carregar(); render(el); };
  el.querySelectorAll('ul.regua button.garimpar').forEach((b) => b.addEventListener('click', async () => {
    const c = carteiras.find((x) => x.pessoa.id === b.closest('li').dataset.pid);
    if (!c) return;
    try { const r = await fila('garimpo_criar', payloadGarimpo(c.pessoa)); alert(r.duplicada ? 'Já existe ordem aberta pra este VIP' : 'Ordem de garimpo criada. O Relógios executa na próxima rodada.'); await recarregar(); } catch (e) { alert(e.message); }
  }));
  el.querySelectorAll('ul.ordens button.cancelar').forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('li').dataset.gid;
    if (!confirm('Cancelar esta ordem de garimpo?')) return;
    try { await fila('garimpo_marcar', { id, estado: 'cancelada', resultado: 'cancelada pelo dono no site' }); await recarregar(); } catch (e) { alert(e.message); }
  }));
  el.querySelectorAll('ul.novos button.abrir-prova').forEach((b) => b.addEventListener('click', () => abrirProva(b.closest('li').dataset.ref)));
}
