import { sessao, login, logout, fetchCarteira, registrarNoPar } from './api.js';
import { diasDesde, bolaDe, alvosVivos, paresVivosDe, alertasDe, filaDoDia } from './logic.js';

const $ = (s) => document.querySelector(s);
let carteiras = [];

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3500);
}

function fmtK(v) { return 'R$ ' + Math.round(v / 1000) + 'k'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function hojeBR() { return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }

function chipAlvos(n) {
  const cls = n === 0 ? 'alvos-0' : n >= 3 ? 'alvos-3' : 'alvos-1';
  return `<span class="chip ${cls}">${n} alvo${n === 1 ? '' : 's'}</span>`;
}

function renderAlertas() {
  const pessoas = carteiras.map((c) => c.pessoa);
  const alertas = alertasDe(pessoas, carteiras, new Date());
  $('#alertas').innerHTML = alertas.map((a) =>
    `<div class="alerta ${a.tipo}" data-pessoa="${a.pessoaId}">${esc(a.msg)}</div>`).join('') ||
    '<div class="alerta" style="border-color:var(--verde)">Nenhuma régua vencida 🎉</div>';
  document.querySelectorAll('.alerta[data-pessoa]').forEach((el) =>
    el.addEventListener('click', () => {
      const card = document.getElementById('card-' + el.dataset.pessoa);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
}

function renderFila() {
  const fila = filaDoDia(carteiras);
  $('#fila-lista').innerHTML = fila.slice(0, 12).map((f) =>
    `<div class="fila-item"><span class="com">${fmtK(f.comissao)}</span>
     <span>${esc(f.pessoa.nome_exibicao)}</span>
     <span class="bola">bola: ${f.bola} · ${f.alvos} alvos</span></div>`).join('');
}

function renderCards() {
  const orden = filaDoDia(carteiras);
  const porId = new Map(carteiras.map((c) => [c.pessoa.id, c]));
  $('#cards').innerHTML = '<h2>Clientes ativos</h2>' + orden.map(({ pessoa }) => {
    const c = porId.get(pessoa.id);
    const vivos = paresVivosDe(c);
    const dias = diasDesde(pessoa.ultima_interacao);
    const paresHtml = vivos.map(({ par, imovel }) => {
      const href = imovel && /^https:\/\/(www\.)?olx\.com\.br\//.test(imovel.link_fonte_privado || '') ? imovel.link_fonte_privado : null;
      const link = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">anúncio ↗</a>` : '';
      const st = par.dono_respondeu ? '✅ dono respondeu' : '⏳ dono não respondeu';
      return `<div class="par" data-par="${par.id}">
        <span class="ap">${esc(par.apelido || 'par')}<span class="st">${st} · at. há ${diasDesde(par.updated_at) ?? '?'}d</span></span>
        ${link}
        <div class="acoes">
          <button data-acao="respondeu">Respondeu</button>
          <button data-acao="escolheu">Escolheu</button>
          <button data-acao="nota">Nota</button>
          <button data-acao="morto">Morto</button>
        </div></div>`;
    }).join('');
    return `<div class="card" id="card-${pessoa.id}">
      <div class="topo"><span class="nome">${esc(pessoa.nome_exibicao)}</span>
        ${chipAlvos(alvosVivos(c))}</div>
      <div class="meta">
        <span>${esc(pessoa.classificacao || '')} · ${esc(pessoa.estagio || '')}</span>
        <span>bola: <b>${bolaDe(pessoa.gargalo)}</b></span>
        <span>últ. interação: ${dias === null ? '?' : 'há ' + dias + 'd'}</span>
        ${pessoa.telefone || pessoa.contato_privado ? '' : '<span style="color:var(--lar)">sem tel.</span>'}
      </div>
      ${pessoa.proximo_passo ? `<div class="proximo">${esc(pessoa.proximo_passo.slice(0, 220))}</div>` : ''}
      ${paresHtml}
    </div>`;
  }).join('');

  document.querySelectorAll('.par button').forEach((btn) =>
    btn.addEventListener('click', () => acaoNoPar(btn.closest('.par').dataset.par, btn.dataset.acao)));
}

async function acaoNoPar(parId, acao) {
  const rot = { respondeu: 'O que o dono respondeu?', escolheu: 'O que o cliente escolheu/disse?', nota: 'Nota:', morto: 'Motivo do descarte:' }[acao];
  const texto = prompt(rot);
  if (texto === null || !texto.trim()) return;
  try {
    await registrarNoPar(parId, (atual) => {
      const antes = atual.bloqueio ? ' | ' + atual.bloqueio : '';
      if (acao === 'respondeu') return { dono_respondeu: true, bloqueio: `[RESPONDEU ${hojeBR()} via site] ${texto}${antes}` };
      if (acao === 'escolheu') return { bloqueio: `[CLIENTE ESCOLHEU ${hojeBR()} via site] ${texto}${antes}` };
      if (acao === 'morto') return { descartado_motivo: `${texto} (site, ${hojeBR()})` };
      return { bloqueio: `[NOTA ${hojeBR()} via site] ${texto}${antes}` };
    });
    toast('Registrado ✔');
    await carregar();
  } catch (e) {
    toast('Erro ao gravar: ' + (e.message || e), true);
  }
}

async function carregar() {
  $('#atualizado').textContent = 'carregando…';
  try {
    carteiras = await fetchCarteira();
    renderAlertas(); renderFila(); renderCards();
    $('#atualizado').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    toast('Erro ao carregar: ' + (e.message || e), true);
    $('#atualizado').textContent = 'erro';
  }
}

async function boot() {
  const s = await sessao();
  $('#login').hidden = !!s;
  $('#painel').hidden = !s;
  if (s) carregar();
}

$('#form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('#login-erro').hidden = true;
  try {
    await login($('#email').value.trim(), $('#senha').value);
    await boot();
  } catch (e) {
    $('#login-erro').textContent = 'Login falhou: ' + (e.message || e);
    $('#login-erro').hidden = false;
  }
});
$('#recarregar').addEventListener('click', carregar);
$('#sair').addEventListener('click', async () => { await logout(); location.reload(); });

boot();
