// Tela Auditoria (entrega 3, spec §3): escolhe um VIP; o site prova, conversa a
// conversa (VIP + alvos), que o registro bate com o canal. Conferir agora manda
// o coletor reler esses chats primeiro; Amostra de 5 é o check-in aleatório.
import { fila, fetchCarteira } from '../api.js';
import { esc } from '../logic.js';
import { arvoreDoVip, montarAuditoria, amostra } from '../auditoria.js';

let carteiras = [], escolhido = null, resultado = null;
export async function carregar() {
  carteiras = (await fetchCarteira()).filter((c) => (c.pessoa.diferenca_max || 0) > 0);
}
async function auditar(id) {
  escolhido = carteiras.find((c) => c.pessoa.id === id) || null;
  resultado = null;
  if (!escolhido) return;
  const arvore = arvoreDoVip(escolhido);
  const telefones = arvore.map((n) => n.telefone).filter(Boolean);
  const r = telefones.length ? await fila('auditoria_vip', { telefones }) : { por_telefone: {} };
  resultado = montarAuditoria(arvore, r.por_telefone || {}, 'America/Sao_Paulo');
}
const SELO = { auditada: '✅ auditada', divergente: '⚠️ divergente', nao_varrida: '⏳ não varrida', sem_telefone: '— sem telefone' };
export function render(el) {
  const r = resultado;
  el.innerHTML = `
    <div class="faixa-setor"><h2>Auditoria</h2><span>você</span><span>o site prova que o registro bate com o canal</span></div>
    <p><label>VIP: <select class="vip"><option value="">escolha…</option>${carteiras.map((c) => `<option value="${esc(c.pessoa.id)}" ${escolhido && escolhido.pessoa.id === c.pessoa.id ? 'selected' : ''}>${esc(c.pessoa.nome_exibicao)}</option>`).join('')}</select></label>
       <button class="conferir" ${escolhido ? '' : 'disabled'}>Conferir agora</button>
       <button class="amostra">Amostra de 5</button>
       <span class="aviso-aud"></span></p>
    ${r ? `<div class="resumo-aud"><b>${r.resumo.total} conversas</b>: ${r.resumo.auditadas} auditada${r.resumo.auditadas === 1 ? '' : 's'}, ${r.resumo.divergentes} divergente${r.resumo.divergentes === 1 ? '' : 's'}, ${r.resumo.nao_varridas} não varrida${r.resumo.nao_varridas === 1 ? '' : 's'}${r.resumo.sem_telefone ? `, ${r.resumo.sem_telefone} sem telefone` : ''}</div>
    ${r.conversas.map((c) => `
      <div class="conversa-aud ${c.selo}">
        <div class="cabeca"><b>${esc(c.papel)} · ${esc(c.rotulo)}</b> <span class="selo">${SELO[c.selo] || c.selo}</span>${c.telefone ? ` <small>${esc(c.telefone)}</small>` : ''}</div>
        ${c.motivos.length ? `<ul class="motivos">${c.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
        ${c.linhas.length ? `<table class="aud"><tr><th>mensagem</th><th>hora no canal</th><th>hora registrada</th><th>prova</th></tr>${c.linhas.map((l) => `
          <tr class="${l.ok ? '' : 'ruim'}"><td>${esc(l.quem)}: ${esc(l.texto)}</td><td>${esc(l.hora_canal)}</td><td>${esc(l.hora_registro)}</td>
          <td>${l.prova ? (l.prova.includes(':') && /^[a-z_]+:/.test(l.prova) ? `<button class="abrir-prova" data-ref="${esc(l.prova)}">Abrir prova</button>` : esc(l.prova)) : '—'}${l.motivo ? ` <small class="motivo">${esc(l.motivo)}</small>` : ''}</td></tr>`).join('')}</table>` : ''}
      </div>`).join('')}` : (escolhido ? '<p>carregando…</p>' : '')}`;
  el.querySelector('select.vip').addEventListener('change', async (ev) => { el.querySelector('.aviso-aud').textContent = 'auditando…'; await auditar(ev.target.value); render(el); });
  el.querySelector('button.conferir').addEventListener('click', async () => {
    const tels = arvoreDoVip(escolhido).map((n) => n.telefone).filter(Boolean);
    try { await fila('conferir_vip', { telefones: tels, motivo: 'vip' }); el.querySelector('.aviso-aud').textContent = 'conferência pedida — o coletor relê esses chats na próxima rodada (≤5 min); recarregue depois.'; }
    catch (e) { el.querySelector('.aviso-aud').textContent = 'não deu: ' + e.message; }
  });
  el.querySelector('button.amostra').addEventListener('click', async () => {
    const todos = carteiras.flatMap((c) => arvoreDoVip(c).map((n) => n.telefone)).filter(Boolean);
    const tels = amostra(todos, 5);
    try { await fila('conferir_vip', { telefones: tels, motivo: 'amostra' }); el.querySelector('.aviso-aud').textContent = `amostra de ${tels.length} chats pedida — o coletor relê na próxima rodada; depois audite os VIPs deles.`; }
    catch (e) { el.querySelector('.aviso-aud').textContent = 'não deu: ' + e.message; }
  });
  el.querySelectorAll('button.abrir-prova').forEach((b) => b.addEventListener('click', async () => {
    try {
      const { tabela, item } = await fila('prova', { ref: b.dataset.ref });
      document.querySelector('#ia-titulo').textContent = `Prova — ${tabela}`;
      document.querySelector('#ia-texto').value = item ? Object.entries(item).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n') : '(prova não encontrada)';
      document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
      document.querySelector('#ia-dialog').showModal();
    } catch (e) { alert('Não consegui abrir a prova: ' + e.message); }
  }));
}
