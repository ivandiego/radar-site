import { sessao, login, logout, fetchCarteira, registrarNoPar } from './api.js';
import { diasDesde, bolaDe, alvosVivos, paresVivosDe, alertasDe, filaDoDia } from './logic.js';
import { FUNCTIONS_URL } from './config.js';

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
          <button data-acao="ia-redigir">✍️ IA</button>
          <button data-acao="ia-classificar">🧠 Classificar</button>
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

// ---- IA (Edge Functions) ----
function contextoDoPar(parId) {
  for (const c of carteiras) {
    for (const { par, imovel } of c.pares) {
      if (par.id === parId) {
        return `CLIENTE: ${c.pessoa.nome_exibicao} (${c.pessoa.classificacao || '?'}). ` +
          `Tem: ${c.pessoa.o_que_tem_texto || '?'} (valor ${c.pessoa.valor_do_que_tem || '?'}). ` +
          `Busca: ${c.pessoa.o_que_busca || '?'}. Completa até: ${c.pessoa.diferenca_max || '?'}.\n` +
          `PAR: ${par.apelido || ''}. Dono respondeu: ${par.dono_respondeu ? 'sim' : 'não'}.\n` +
          `ALVO: ${imovel ? `${imovel.titulo} — ${imovel.bairro || ''}, ${imovel.cidade || ''}, valor anúncio ${imovel.valor}` : 'sem imóvel ligado'}.\n` +
          `HISTÓRICO DO PAR: ${(par.bloqueio || '').slice(0, 900)}`;
      }
    }
  }
  return '';
}

function abrirDialogo(titulo, texto, aplicar = null) {
  const d = $('#ia-dialog');
  $('#ia-titulo').textContent = titulo;
  $('#ia-texto').value = texto;
  const btn = $('#ia-aplicar');
  btn.hidden = !aplicar;
  btn.onclick = aplicar || null;
  d.showModal();
}

async function invocar(fn, body) {
  const s = await sessao();
  if (!s) throw new Error('sessão expirada, entre de novo');
  const r = await fetch(`${FUNCTIONS_URL}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.erro) throw new Error(data.erro || 'IA indisponível (' + r.status + ')');
  return data;
}

async function iaRedigir(parId) {
  const tipo = prompt('Tipo: sondagem / resposta / cobranca', 'resposta');
  if (!tipo) return;
  toast('Redigindo…');
  try {
    const { texto } = await invocar('redigir', { tipo: tipo.trim(), contexto: contextoDoPar(parId) });
    abrirDialogo('Rascunho (' + tipo + ') — revise antes de usar', texto);
  } catch (e) { toast(e.message, true); }
}

async function iaClassificar(parId) {
  const texto = prompt('Cola aqui o que o lead respondeu:');
  if (!texto || !texto.trim()) return;
  toast('Classificando…');
  try {
    const r = await invocar('classificar', { texto, contexto: contextoDoPar(parId) });
    const desc = `${r.resumo}\n\nveredito: ${r.veredito}` +
      (r.telefone_detectado ? `\ntelefone: ${r.telefone_detectado}` : '') +
      `\npróximo passo: ${r.proximo_passo}`;
    abrirDialogo('Leitura da IA — aplicar grava no par', desc, async () => {
      try {
        await registrarNoPar(parId, (atual) => {
          const antes = atual.bloqueio ? ' | ' + atual.bloqueio : '';
          const patch = { bloqueio: `${r.nota_bloqueio}${antes}` };
          if (r.dono_respondeu) patch.dono_respondeu = true;
          if (r.descartar) patch.descartado_motivo = `${r.motivo_descarte || r.resumo} (IA/site, ${hojeBR()})`;
          return patch;
        });
        $('#ia-dialog').close();
        toast('Registrado ✔');
        await carregar();
      } catch (e) { toast('Erro ao gravar: ' + e.message, true); }
    });
  } catch (e) { toast(e.message, true); }
}

async function resumoDia() {
  toast('Montando resumo…');
  try {
    const dump = filaDoDia(carteiras).map((f) => {
      const c = carteiras.find((x) => x.pessoa.id === f.pessoa.id);
      return `${f.pessoa.nome_exibicao} | comissao ${f.comissao} | bola ${f.bola} | alvos ${f.alvos} | ` +
        `ult.interacao ha ${diasDesde(f.pessoa.ultima_interacao) ?? '?'}d | divida ${f.pessoa.promessa_pendente ? 'SIM' : 'nao'} | ` +
        `tel ${f.pessoa.telefone || f.pessoa.contato_privado ? 'sim' : 'NAO'} | ${(f.pessoa.proximo_passo || '').slice(0, 150)}`;
    }).join('\n');
    const { texto } = await invocar('resumo-dia', { dados: dump });
    abrirDialogo('Resumo do dia', texto);
  } catch (e) { toast(e.message, true); }
}

async function acaoNoPar(parId, acao) {
  if (acao === 'ia-redigir') return iaRedigir(parId);
  if (acao === 'ia-classificar') return iaClassificar(parId);
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
$('#resumo-dia').addEventListener('click', resumoDia);
$('#ia-fechar').addEventListener('click', () => $('#ia-dialog').close());
$('#ia-copiar').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#ia-texto').value);
  toast('Copiado ✔');
});

boot();
