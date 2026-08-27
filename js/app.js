import { sessao, login, logout, fetchCarteira, registrarNoPar, fila } from './api.js?v=1787852564';
import { diasDesde, bolaDe, alvosVivos, paresVivosDe, alertasDe, filaDoDia, metaAlvosDe } from './logic.js?v=1787852564';
import { FUNCTIONS_URL } from './config.js?v=1787852564';

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

function chipAlvos(n, meta = 3) {
  const cls = n === 0 ? 'alvos-0' : n >= meta ? 'alvos-3' : 'alvos-1';
  return `<span class="chip ${cls}">${n}/${meta} alvo${n === 1 ? '' : 's'}</span>`;
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

let ultimoRascunho = null; // {parId, texto}

function renderFilaEnvio(itens) {
  const cores = { pendente_aprovacao: 'var(--amarelo)', aprovada: 'var(--roxo)', enviada: 'var(--verde)', rejeitada: 'var(--tx2)', falhou: 'var(--verm)' };
  $('#fila-envio-lista').innerHTML = itens.length ? itens.map((i) =>
    `<div class="fila-item" data-fid="${i.id}">
      <span style="color:${cores[i.estado]};font-size:12px;font-weight:700">${i.estado.replace('_', ' ')}</span>
      <span>${esc(i.destino_rotulo || i.destino)} · ${i.canal}</span>
      <span class="bola">${esc((i.texto || '').slice(0, 40))}…</span>
      ${i.estado === 'pendente_aprovacao' ? '<button data-f="aprovar">✔</button><button data-f="rejeitar">✕</button>' : ''}
      ${i.canal === 'whatsapp' ? '<button data-f="abrir" title="Abrir no WhatsApp com a mensagem digitada">📲</button><button data-f="copiar" title="Copiar texto">⧉</button>' : ''}
      ${i.canal === 'whatsapp' && ['pendente_aprovacao', 'aprovada'].includes(i.estado) ? '<button data-f="enviei" title="Marcar como enviada">✓ enviei</button>' : ''}
    </div>`).join('') : '<div class="fila-item" style="color:var(--tx2)">vazia</div>';
  document.querySelectorAll('#fila-envio-lista button').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-fid]').dataset.fid;
      const item = itens.find((x) => x.id === id);
      if (btn.dataset.f === 'copiar') { await navigator.clipboard.writeText(item.texto); toast('Copiado ✔'); return; }
      if (btn.dataset.f === 'abrir') {
        const num = String(item.destino).replace(/\D/g, '');
        window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(item.texto), '_blank');
        return;
      }
      try {
        if (btn.dataset.f === 'enviei') {
          if (item.estado === 'pendente_aprovacao') await fila('aprovar', { id });
          await fila('marcar', { id, estado: 'enviada', prova_envio: 'enviado manualmente pelo Ivan via wa.me' });
        } else {
          await fila(btn.dataset.f, { id });
        }
        toast('OK ✔'); await carregarFilaEnvio();
      } catch (e) { toast(e.message, true); }
    }));
}

async function carregarFilaEnvio() {
  try { renderFilaEnvio((await fila('listar')).itens || []); }
  catch (e) { $('#fila-envio-lista').innerHTML = '<div class="fila-item" style="color:var(--tx2)">' + esc(e.message) + '</div>'; }
}

// ---- Caixa de entrada ----
let inboxRespondendo = null; // item da inbox sendo respondido via dialog IA

function contextoDaInbox(item) {
  // tenta achar o par pelo destino (list-id) ou pelo nome do remetente no apelido
  for (const c of carteiras) {
    for (const { par, imovel } of c.pares) {
      const olxId = imovel && imovel.olx_id;
      if ((olxId && String(item.destino) === String(olxId)) ||
          (par.apelido || '').toLowerCase().includes((item.remetente || '§').toLowerCase())) {
        return contextoDoPar(par.id) + `\n\nMENSAGEM RECEBIDA AGORA de ${item.remetente}: "${item.texto}"`;
      }
    }
  }
  return `Mensagem recebida no chat da OLX de ${item.remetente}` +
    (item.anuncio ? ` (anúncio: ${item.anuncio})` : '') + `: "${item.texto}"\n` +
    'ATENÇÃO: não há ficha de cliente ligada a esta conversa. NÃO invente dados de cliente ou imóvel — responda só com o que está na mensagem, e se faltar informação, faça UMA pergunta objetiva.';
}

function renderInbox(itens) {
  const novas = itens.filter((i) => i.estado === 'nova');
  const lista = novas.length ? novas : itens.slice(0, 3);
  $('#inbox-lista').innerHTML = lista.length ? lista.map((i) =>
    `<div class="inbox-item ${i.estado !== 'nova' ? 'lida' : ''}" data-iid="${i.id}">
      <span class="de">${esc(i.remetente)}</span>
      ${i.anuncio ? `<span class="quando">${esc(i.anuncio.slice(0, 50))}</span>` : ''}
      <span class="quando">${esc(i.hora_olx || '')}${i.estado !== 'nova' ? ' · ' + i.estado : ''}</span>
      <div class="msg">${esc(i.texto.slice(0, 300))}</div>
      ${i.estado === 'nova' ? `<div class="acoes">
        <button class="responder" data-i="responder">✍️ Responder</button>
        <button data-i="ignorar">Ignorar</button>
      </div>` : ''}
    </div>`).join('') : '<div class="fila-item" style="color:var(--tx2)">nada novo</div>';
  const h2 = document.querySelector('#inbox h2');
  h2.textContent = `Caixa de entrada${novas.length ? ' (' + novas.length + ' nova' + (novas.length > 1 ? 's' : '') + ')' : ''}`;
  document.querySelectorAll('#inbox-lista button').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-iid]').dataset.iid;
      const item = itens.find((x) => x.id === id);
      if (btn.dataset.i === 'ignorar') {
        try { await fila('inbox_marcar', { id, estado: 'ignorada' }); toast('OK ✔'); await carregarInbox(); }
        catch (e) { toast(e.message, true); }
        return;
      }
      // responder: IA redige, dialog abre com "+ Fila" sem prompts
      toast('Redigindo…');
      try {
        const { texto } = await invocar('redigir', { tipo: 'resposta', contexto: contextoDaInbox(item) });
        inboxRespondendo = item;
        ultimoRascunho = null;
        abrirDialogo('Resposta pra ' + item.remetente + ' — revise e mande pra fila', texto);
        $('#ia-fila').hidden = false;
      } catch (e) { toast(e.message, true); }
    }));
}

async function carregarInbox() {
  try { renderInbox((await fila('inbox_listar')).itens || []); }
  catch (e) { $('#inbox-lista').innerHTML = '<div class="fila-item" style="color:var(--tx2)">' + esc(e.message) + '</div>'; }
}

let tabelaSoVips = true;
let ordem = { col: null, asc: false };

function valorColuna(f, col) {
  const p = f.pessoa;
  const c = carteiras.find((x) => x.pessoa.id === p.id);
  switch (col) {
    case 'cliente': return (p.nome_exibicao || '').toLowerCase();
    case 'tem': return p.valor_do_que_tem || 0;
    case 'adiciona': return p.diferenca_max || 0;
    case 'alvos': return f.alvos;
    case 'resp': return f.respondidos || 0;
    case 'int': return diasDesde(p.ultima_interacao) ?? 999;
    case 'comissao': return f.comissao;
    default: return 0;
  }
}

function renderTabela() {
  // VIP de verdade = sabemos quanto ele ADICIONA (definicao do Ivan, 26/08)
  let base = filaDoDia(carteiras).filter(({ pessoa }) =>
    !tabelaSoVips || (pessoa.diferenca_max || 0) > 0);
  if (ordem.col) {
    base = [...base].sort((a, b) => {
      const va = valorColuna(a, ordem.col), vb = valorColuna(b, ordem.col);
      return (va > vb ? 1 : va < vb ? -1 : 0) * (ordem.asc ? 1 : -1);
    });
  }
  const linhas = base.map(({ pessoa, comissao, bola, alvos }) => {
    const c = carteiras.find((x) => x.pessoa.id === pessoa.id);
    const vivos = paresVivosDe(c);
    const resp = vivos.filter((x) => x.par.dono_respondeu).length;
    const mudos = vivos.length - resp;
    const dInt = diasDesde(pessoa.ultima_interacao);
    const dResp = diasDesde(pessoa.ultima_resposta_em);
    const meta = metaAlvosDe(pessoa);
    const clsAlvos = alvos === 0 ? 'bad' : alvos >= meta ? 'ok' : 'warn';
    const clsInt = dInt === null ? '' : dInt >= 2 ? 'bad' : dInt >= 1 ? 'warn' : 'ok';
    const linksAlvos = vivos.slice(0, 4).map(({ imovel }, i) => {
      const h = imovel && /^https:\/\/(www\.)?olx\.com\.br\//.test(imovel.link_fonte_privado || '') ? imovel.link_fonte_privado : null;
      return h ? `<a href="${esc(h)}" target="_blank" rel="noopener" title="${esc(imovel.titulo || '')}">${i + 1}↗</a>` : '';
    }).filter(Boolean).join(' ');
    return `<tr data-pessoa="${pessoa.id}">
      <td class="nome-cel">${esc(pessoa.nome_exibicao)}</td>
      <td class="num">${pessoa.valor_do_que_tem ? fmtK(pessoa.valor_do_que_tem) : '—'}</td>
      <td class="num ok">${pessoa.diferenca_max ? '+' + fmtK(pessoa.diferenca_max) : '—'}</td>
      <td class="num ${clsAlvos}">${alvos}/${meta}</td>
      <td class="num ok">${resp}</td>
      <td class="num ${mudos ? 'warn' : ''}">${mudos}</td>
      <td class="num ${clsInt}">${dInt === null ? '—' : dInt + 'd'}</td>
      <td class="num">${dResp === null ? '—' : dResp + 'd'}</td>
      <td>${bola}</td>
      <td class="num">${fmtK(comissao)}</td>
      <td>${pessoa.telefone || pessoa.contato_privado ? esc(pessoa.telefone || pessoa.contato_privado) : '<span class="bad">sem tel</span>'}</td>
      <td>${/morto|sem[_ ]canal/i.test(pessoa.canal || '') ? '<span class="bad">☠ ' + esc(pessoa.canal) + '</span>' : esc(pessoa.canal || '—')}</td>
      <td>${linksAlvos || '—'}</td>
      <td><button class="editar-btn" data-e="${pessoa.id}" style="background:#232636;color:var(--tx);border:1px solid var(--linha);border-radius:8px;padding:5px 9px">✎</button></td>
    </tr>`;
  }).join('');
  const seta = (c) => ordem.col === c ? (ordem.asc ? ' ▲' : ' ▼') : '';
  $('#tabela-vips').innerHTML = `<thead><tr>
    <th data-o="cliente">Cliente${seta('cliente')}</th><th data-o="tem">Tem${seta('tem')}</th><th data-o="adiciona">Adiciona${seta('adiciona')}</th><th data-o="alvos">Alvos${seta('alvos')}</th><th data-o="resp">Resp.${seta('resp')}</th><th>Mudos</th>
    <th data-o="int">Últ. int.${seta('int')}</th><th>Últ. resp. dele</th><th>Bola</th><th data-o="comissao">Comissão${seta('comissao')}</th><th>Tel</th><th>Canal</th><th>Anúncios</th><th>✎</th>
  </tr></thead><tbody>${linhas}</tbody>`;
  document.querySelectorAll('#tabela-vips th[data-o]').forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const c = th.dataset.o;
      ordem = { col: c, asc: ordem.col === c ? !ordem.asc : false };
      renderTabela();
    });
  });
  const h2 = document.querySelector('#tabela h2');
  h2.innerHTML = `VIPs — visão tabela (${base.length}) <button id="tabela-filtro" style="margin-left:8px;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--linha);background:#232636;color:var(--tx)">${tabelaSoVips ? 'mostrar todos' : 'só VIPs'}</button>`;
  document.querySelector('#tabela-filtro').addEventListener('click', () => { tabelaSoVips = !tabelaSoVips; renderTabela(); });
  document.querySelectorAll('#tabela-vips a').forEach((a) => a.addEventListener('click', (ev) => ev.stopPropagation()));
  document.querySelectorAll('#tabela-vips .editar-btn').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirEdicao(b.dataset.e);
  }));
  document.querySelectorAll('#tabela-vips tr[data-pessoa]').forEach((tr) =>
    tr.addEventListener('click', () => {
      $('#tabela').hidden = true; $('#cards').hidden = false;
      const card = document.getElementById('card-' + tr.dataset.pessoa);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
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
      const telAn = imovel && imovel.telefone_anunciante ? ` · 📱 ${esc(imovel.telefone_anunciante)}` : '';
      return `<div class="par" data-par="${par.id}">
        <span class="ap">${esc(par.apelido || 'par')}<span class="st">${st} · at. há ${diasDesde(par.updated_at) ?? '?'}d${telAn}</span></span>
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
        ${chipAlvos(alvosVivos(c), metaAlvosDe(pessoa))}</div>
      <div class="meta">
        <span>${esc(pessoa.classificacao || '')} · ${esc(pessoa.estagio || '')}</span>
        <span>bola: <b>${bolaDe(pessoa.gargalo)}</b></span>
        <span>últ. interação: ${dias === null ? '?' : 'há ' + dias + 'd'}</span>
        ${pessoa.telefone || pessoa.contato_privado ? '<span>📱 ' + esc(pessoa.telefone || pessoa.contato_privado) + '</span>' : '<span style="color:var(--lar)">sem tel.</span>'}
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
  $('#ia-fila').hidden = true;
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
    ultimoRascunho = { parId, texto };
    abrirDialogo('Rascunho (' + tipo + ') — revise antes de usar', texto);
    $('#ia-fila').hidden = false;
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
    renderAlertas(); renderFila(); renderCards(); renderTabela(); carregarFilaEnvio(); carregarInbox();
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
let editandoId = null;

function abrirEdicao(pessoaId) {
  const c = carteiras.find((x) => x.pessoa.id === pessoaId);
  if (!c) return;
  const p = c.pessoa;
  editandoId = pessoaId;
  const f = $('#novo-form');
  f.nome.value = p.nome_exibicao || '';
  f.classificacao.value = p.classificacao || 'indefinido';
  f.o_que_tem_texto.value = p.o_que_tem_texto || '';
  f.valor_do_que_tem.value = p.valor_do_que_tem || '';
  f.o_que_busca.value = p.o_que_busca || '';
  f.diferenca_max.value = p.diferenca_max || '';
  f.telefone.value = p.telefone || '';
  f.link.value = p.link_thread_olx_privado || '';
  document.querySelector('#novo-dialog h3').textContent = 'Editar: ' + p.nome_exibicao;
  $('#novo-dialog').showModal();
}

$('#novo-cliente').addEventListener('click', () => {
  editandoId = null;
  $('#novo-form').reset();
  document.querySelector('#novo-dialog h3').textContent = 'Novo cliente';
  $('#novo-dialog').showModal();
});
$('#novo-fechar').addEventListener('click', () => $('#novo-dialog').close());
$('#novo-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const hoje = hojeBR();
  try {
    const { sb } = await import('./api.js');
    if (editandoId) {
      const { error: e2 } = await sb.from('pessoa').update({
        nome_exibicao: f.get('nome'),
        classificacao: f.get('classificacao'),
        o_que_tem_texto: f.get('o_que_tem_texto'),
        valor_do_que_tem: f.get('valor_do_que_tem') ? +f.get('valor_do_que_tem') : null,
        o_que_busca: f.get('o_que_busca') || null,
        diferenca_max: f.get('diferenca_max') ? +f.get('diferenca_max') : null,
        telefone: f.get('telefone') || null,
        link_thread_olx_privado: f.get('link') || null,
        atualizado_via: 'site',
      }).eq('id', editandoId);
      if (e2) throw e2;
      $('#novo-dialog').close(); ev.target.reset(); editandoId = null;
      toast('Ficha atualizada ✔');
      await carregar();
      return;
    }
    const { data, error } = await sb.from('pessoa').insert([{
      nome_exibicao: f.get('nome'),
      classificacao: f.get('classificacao'),
      o_que_tem_texto: f.get('o_que_tem_texto'),
      valor_do_que_tem: f.get('valor_do_que_tem') ? +f.get('valor_do_que_tem') : null,
      o_que_busca: f.get('o_que_busca') || null,
      diferenca_max: f.get('diferenca_max') ? +f.get('diferenca_max') : null,
      telefone: f.get('telefone') || null,
      link_thread_olx_privado: f.get('link') || null,
      estagio: '3-RESPONDEU',
      gargalo: 'aguardando novo imóvel',
      proximo_passo: hoje + ': cadastrado pelo site — qualificar o que faltar e garimpar alvos.',
      atualizado_via: 'site',
      ultima_interacao: new Date().toISOString(),
    }]).select('id');
    if (error) throw error;
    $('#novo-dialog').close(); ev.target.reset();
    toast('Cliente cadastrado ✔');
    await carregar();
  } catch (e) { toast('Erro: ' + (e.message || e), true); }
});
$('#ver-tabela').addEventListener('click', () => {
  const t = $('#tabela');
  t.hidden = !t.hidden;
  $('#cards').hidden = !t.hidden;
});
$('#ia-fechar').addEventListener('click', () => { inboxRespondendo = null; $('#ia-dialog').close(); });
$('#ia-fila').addEventListener('click', async () => {
  // resposta vinda da Caixa de entrada: destino já conhecido, sem prompts
  if (inboxRespondendo) {
    const item = inboxRespondendo;
    try {
      await fila('criar', {
        canal: item.canal || 'olx', destino: item.destino,
        destino_rotulo: item.remetente + (item.anuncio ? ' (' + item.anuncio.slice(0, 40) + ')' : ''),
        texto: $('#ia-texto').value, origem: 'inbox',
      });
      await fila('inbox_marcar', { id: item.id, estado: 'respondida' });
      inboxRespondendo = null;
      $('#ia-dialog').close(); toast('Na fila ✔ (pendente de aprovação)');
      await carregarFilaEnvio(); await carregarInbox();
    } catch (e) { toast(e.message, true); }
    return;
  }
  if (!ultimoRascunho) return;
  const c = carteiras.flatMap((x) => x.pares.map((p) => ({ pessoa: x.pessoa, ...p })))
    .find((x) => x.par.id === ultimoRascunho.parId);
  if (c && /morto|sem[_ ]canal/i.test(c.pessoa.canal || '')) {
    if (!confirm('⚠️ O canal deste cliente está marcado como "' + c.pessoa.canal + '". Enfileirar mesmo assim?')) return;
  }
  const olxId = c && c.imovel && (c.imovel.link_fonte_privado || '').match(/-(\d{9,10})$/) ? c.imovel.link_fonte_privado.match(/-(\d{9,10})$/)[1] : (c && c.imovel && c.imovel.olx_id);
  const canal = prompt('Canal: olx ou whatsapp', olxId ? 'olx' : 'whatsapp');
  if (!canal) return;
  let destino = canal === 'olx' ? (olxId || '') : ((c && (c.pessoa.telefone || c.pessoa.contato_privado)) || '');
  destino = prompt('Destino (' + (canal === 'olx' ? 'list-id do anúncio' : 'telefone') + '):', destino);
  if (!destino) return;
  try {
    await fila('criar', { canal, destino, destino_rotulo: c ? (c.par.apelido || c.pessoa.nome_exibicao) : '', par_id: ultimoRascunho.parId, texto: $('#ia-texto').value, origem: 'ia' });
    $('#ia-dialog').close(); toast('Na fila ✔ (pendente de aprovação)'); await carregarFilaEnvio();
  } catch (e) { toast(e.message, true); }
});
$('#ia-copiar').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#ia-texto').value);
  toast('Copiado ✔');
});

boot();
