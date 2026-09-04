import { sessao, login, logout, fetchCarteira, registrarNoPar, fila, sb } from './api.js?v=1788490515';
import { diasDesde, bolaDe, alvosVivos, paresVivosDe, alertasDe, filaDoDia, metaAlvosDe, esc, aplicarInteracoes } from './logic.js?v=1788490515';
import { FUNCTIONS_URL } from './config.js?v=1788490515';
import * as painel from './setores/painel.js?v=1788490515';
import * as diario from './setores/diario.js?v=1788490515';

const $ = (s) => document.querySelector(s);
let carteiras = [];

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3500);
}

function fmtK(v) { return 'R$ ' + Math.round(v / 1000) + 'k'; }
function hojeBR() { return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }

function chipAlvos(n, meta = 3) {
  const cls = n === 0 ? 'alvos-0' : n >= meta ? 'alvos-3' : 'alvos-1';
  return `<span class="chip ${cls}">${n}/${meta} alvo${n === 1 ? '' : 's'}</span>`;
}

function renderAlertas() {
  // Só alerta o que exige ação: VIPs de verdade (adiciona dinheiro), máx 5.
  const vipIds = new Set(carteiras.filter((c) => (c.pessoa.diferenca_max || 0) > 0).map((c) => c.pessoa.id));
  const pessoas = carteiras.map((c) => c.pessoa);
  const alertas = alertasDe(pessoas, carteiras, new Date())
    .filter((a) => vipIds.has(a.pessoaId))
    .filter((a) => ['peteca', 'divida', 'dono_mudo', 'canal_risco'].includes(a.tipo))
    .sort((a, b) => (a.tipo === 'peteca' ? -1 : 0) - (b.tipo === 'peteca' ? -1 : 0))
    .slice(0, 6);
  $('#alertas').innerHTML = alertas.map((a) =>
    `<div class="alerta ${a.tipo}" data-pessoa="${a.pessoaId}">${esc(a.msg)}</div>`).join('') ||
    '<div class="alerta" style="border-color:var(--verde)">Nenhuma régua vencida nos VIPs</div>';
  document.querySelectorAll('.alerta[data-pessoa]').forEach((el) =>
    el.addEventListener('click', () => {
      gavetaAberta = el.dataset.pessoa;
      mostrarAba('vips');
      renderTabela();
      const tr = document.querySelector(`tr[data-pessoa="${el.dataset.pessoa}"]`);
      if (tr) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
}

let ultimoRascunho = null; // {parId, texto}
let pendFila = 0, novasInbox = 0;
function atualizarBadge() {
  const b = document.querySelector('#badge-hoje');
  if (!b) return;
  const n = pendFila + novasInbox;
  b.hidden = !n;
  b.textContent = n;
}

function renderFilaEnvio(itens) {
  const cores = { pendente_aprovacao: 'var(--amarelo)', aprovada: 'var(--roxo)', digitada: 'var(--ambar)', enviada: 'var(--verde)', rejeitada: 'var(--tx2)', falhou: 'var(--verm)' };
  const rotulos = { digitada: '✏️ no Whats — só apertar ENVIAR lá' };
  $('#fila-envio-lista').innerHTML = itens.length ? itens.map((i) =>
    `<div class="fila-item" data-fid="${i.id}">
      <span style="color:${cores[i.estado]};font-size:12px;font-weight:700">${rotulos[i.estado] || i.estado.replace('_', ' ')}</span>
      <span>${esc(i.destino_rotulo || i.destino)} · ${i.canal}</span>
      <span class="bola">${esc((i.texto || '').slice(0, 40))}…</span>
      ${i.estado === 'pendente_aprovacao' ? '<button data-f="aprovar">✔</button><button data-f="rejeitar">✕</button>' : ''}
      ${i.canal === 'whatsapp' ? '<button data-f="abrir" title="Abrir no WhatsApp com a mensagem digitada">📲</button><button data-f="copiar" title="Copiar texto">⧉</button>' : ''}
      ${i.canal === 'whatsapp' && ['pendente_aprovacao', 'aprovada', 'digitada'].includes(i.estado) ? '<button data-f="enviei" title="Marcar como enviada">✓ enviei</button>' : ''}
    </div>`).join('') : '<div class="fila-item" style="color:var(--tx2)">vazia</div>';
  pendFila = itens.filter((i) => i.estado === 'pendente_aprovacao').length;
  document.querySelector('#fila-envio h2').innerHTML = `Fila de envio ${pendFila ? '<b>(' + pendFila + ' pra aprovar)</b>' : ''}`;
  atualizarBadge();
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
  h2.innerHTML = `Caixa de entrada ${novas.length ? '<b>(' + novas.length + ' nova' + (novas.length > 1 ? 's' : '') + ')</b>' : ''}`;
  novasInbox = novas.length;
  atualizarBadge();
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

async function carregarSaude() {
  const el = document.querySelector('#saude');
  if (!el) return;
  try {
    const s = await fila('saude');
    const agora = Date.now();
    const min = (iso) => Math.round((agora - new Date(iso).getTime()) / 60000);
    const hb = new Map((s.heartbeats || []).map((h) => [h.chave, h]));
    const pill = (nome, h, limiteMin) => {
      if (!h) return `<span class="pill ruim">${nome}: <b>nunca rodou</b></span>`;
      const m = min(h.atualizado_em);
      const ruim = m > limiteMin;
      return `<span class="pill ${ruim ? 'ruim' : 'ok'}" title="${esc(h.detalhe || '')}">${nome}: <b>há ${m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60) + 'm' : m + 'min'}</b></span>`;
    };
    const abertas = (s.ordens_abertas || []).length;
    const travadas = (s.ordens_abertas || []).filter((o) => o.estado === 'executando' && min(o.claimed_em || o.criado_em) > 30).length;
    el.innerHTML =
      pill('📮 Carteiro', hb.get('carteiro'), 20) +
      pill('👂 Ouvidor', hb.get('ouvidor'), 40) +
      pill('⏰ Relógios', hb.get('relogios'), 75) +
      pill('🔍 Fiscal', hb.get('fiscal'), 780) +
      `<span class="pill ${travadas ? 'ruim' : ''}">Ordens na fila: <b>${abertas}</b>${travadas ? ` (${travadas} travada${travadas > 1 ? 's' : ''})` : ''}</span>` +
      `<span class="pill ${s.fila_falhou ? 'ruim' : ''}">Envios falhados: <b>${s.fila_falhou}</b></span>` +
      `<span class="pill">Caixa: <b>${s.inbox_novas} nova${s.inbox_novas === 1 ? '' : 's'}</b></span>`;
  } catch (e) { el.innerHTML = '<span class="pill ruim">monitor indisponível</span>'; }
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
    const dicaInt = pessoa.interacao ? `última palavra: ${pessoa.interacao.ultima_palavra === 'nos' ? 'nossa' : 'dele(a)'}${pessoa.interacao.texto ? ' — ' + pessoa.interacao.texto : ''}` : 'campo do site (sem registro na caixa)';
    const aberta = gavetaAberta === pessoa.id;
    const linha = `<tr class="vip-row ${aberta ? 'aberta' : ''} ${pessoa.promessa_pendente ? 'problema' : ''}" data-pessoa="${pessoa.id}">
      <td class="nome-cel">${aberta ? '▾ ' : '▸ '}${esc(pessoa.nome_exibicao)}${/^https:\/\/(www\.|sp\.)?olx\.com\.br\//.test(pessoa.link_thread_olx_privado || '') ? ` <a href="${esc(pessoa.link_thread_olx_privado)}" target="_blank" rel="noopener" title="Anúncio do cliente na OLX">↗</a>` : ''}</td>
      <td class="num">${pessoa.valor_do_que_tem ? fmtK(pessoa.valor_do_que_tem) : '—'}</td>
      <td class="num ok">${pessoa.diferenca_max ? '+' + fmtK(pessoa.diferenca_max) : '—'}</td>
      <td class="num ${clsAlvos}">${alvos}/${meta}</td>
      <td class="num ok">${resp}</td>
      <td class="num ${mudos ? 'warn' : ''}">${mudos}</td>
      <td class="num ${clsInt}" title="${esc(dicaInt)}">${dInt === null ? '—' : dInt + 'd'}${pessoa.interacao ? (pessoa.interacao.ultima_palavra === 'nos' ? ' <small>nós</small>' : ' <small>dele(a)</small>') : ''}</td>
      <td class="num">${dResp === null ? '—' : dResp + 'd'}</td>
      <td>${bola}</td>
      <td class="com">${fmtK(comissao)}</td>
      <td>${(() => { const tel = pessoa.telefone || pessoa.contato_privado; if (!tel) return '<span class="bad">sem tel</span>'; const d = String(tel).replace(/\D/g, '').replace(/^55/, ''); return esc(tel) + (d.length >= 10 ? ` <a class="zap" href="https://wa.me/55${d}" target="_blank" rel="noopener" title="Abrir WhatsApp do cliente">📲</a>` : ''); })()}</td>
      <td>${/morto|sem[_ ]canal/i.test(pessoa.canal || '') ? '<span class="bad">☠</span>' : esc(pessoa.canal || '—')}</td>
    </tr>`;
    const c2 = carteiras.find((x) => x.pessoa.id === pessoa.id);
    return linha + (aberta ? `<tr class="gaveta"><td colspan="12">${gavetaHtml(c2)}</td></tr>` : '');
  }).join('');
  const seta = (c) => ordem.col === c ? (ordem.asc ? ' ▲' : ' ▼') : '';
  $('#tabela-vips').innerHTML = `<thead><tr>
    <th data-o="cliente">Cliente${seta('cliente')}</th><th data-o="tem">Tem${seta('tem')}</th><th data-o="adiciona">Adiciona${seta('adiciona')}</th><th data-o="alvos">Alvos${seta('alvos')}</th><th data-o="resp">Resp.${seta('resp')}</th><th>Mudos</th>
    <th data-o="int">Últ. int.${seta('int')}</th><th>Últ. resp. dele</th><th>Bola</th><th data-o="comissao">Comissão${seta('comissao')}</th><th>Tel</th><th>Canal</th>
  </tr></thead><tbody>${linhas}</tbody>`;
  document.querySelectorAll('#tabela-vips th[data-o]').forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const c = th.dataset.o;
      ordem = { col: c, asc: ordem.col === c ? !ordem.asc : false };
      renderTabela();
    });
  });
  document.querySelectorAll('#tabela-vips a').forEach((a) => a.addEventListener('click', (ev) => ev.stopPropagation()));
  document.querySelectorAll('#tabela-vips tr.vip-row').forEach((tr) =>
    tr.addEventListener('click', () => {
      gavetaAberta = gavetaAberta === tr.dataset.pessoa ? null : tr.dataset.pessoa;
      renderTabela();
    }));
  // botões da gaveta
  document.querySelectorAll('tr.gaveta button[data-acao]').forEach((b) =>
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      acaoNoPar(b.closest('tr[data-par]').dataset.par, b.dataset.acao);
    }));
  document.querySelectorAll('tr.gaveta .editar-btn').forEach((b) =>
    b.addEventListener('click', (ev) => { ev.stopPropagation(); abrirEdicao(b.dataset.e); }));
  document.querySelectorAll('tr.gaveta .garimpar-btn').forEach((btn) =>
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const c = carteiras.find((x) => x.pessoa.id === btn.dataset.g);
      if (!c) return;
      const p = c.pessoa;
      try {
        const r = await fila('garimpo_criar', {
          pessoa_id: p.id, pessoa_nome: p.nome_exibicao, meta: metaAlvosDe(p),
          criterios: `Busca: ${p.o_que_busca || '?'}. Tem: ${p.o_que_tem_texto || '?'} (${p.valor_do_que_tem || '?'}). Adiciona: ${p.diferenca_max || '?'}. ${JSON.stringify(p.criterios || []).slice(0, 400)}`,
        });
        toast(r.duplicada ? 'Já existe ordem aberta pra este VIP' : 'Ordem de garimpo criada ✔ — o robô executa');
        await carregarGarimpo();
      } catch (e) { toast(e.message, true); }
    }));
}

function estadoDoPar(par) {
  if (par.dono_respondeu) {
    const nota = (par.notas || par.bloqueio || '');
    const canal = /whats/i.test(nota) ? 'Whats' : /olx|thread|chat da olx/i.test(nota) ? 'OLX' : '';
    return `<span class="est-ok" title="${esc(nota).slice(0, 200)}">✅ respondeu${canal ? ' (' + canal + ')' : ''}</span>`;
  }
  const d = diasDesde(par.updated_at) ?? 99;
  if (d >= 2) return `<span class="est-mudo">mudo há ${d}d</span>`;
  return '<span class="est-espera">⏳ aguardando</span>';
}

// ---- Checklist de pontas (par_checklist via edge fn) ----
let checklistCache = {}; // parId -> {cliente:Set(etapas), dono:Set(etapas)} | 'loading'
const ETAPAS = ['contactado', 'valor', 'fotos', 'aceite', 'visita_ok'];
const ETAPA_ROTULO = { contactado: 'contato', valor: 'valor', fotos: 'fotos', aceite: 'ACEITE', visita_ok: 'visita' };

function chipsPontas(parId) {
  const ck = checklistCache[parId];
  if (!ck || ck === 'loading') return '<span class="pontas" style="color:var(--tx2)">…</span>';
  const linha = (lado) => {
    const feitos = ck[lado] || new Set();
    const marcas = ETAPAS.map((e) =>
      `<i class="${feitos.has(e) ? 'ck' : 'nk'}" title="${ETAPA_ROTULO[e]}${feitos.has(e) ? ' ✓' : ' pendente'}">${feitos.has(e) ? '●' : '○'}</i>`).join('');
    const pendentes = ETAPAS.filter((e) => !feitos.has(e)).map((e) => ETAPA_ROTULO[e]);
    return `<div class="ponta" title="${lado}: pendente ${pendentes.join(', ') || 'nada'}"><b>${lado}</b> ${marcas}</div>`;
  };
  return `<span class="pontas">${linha('cliente')}${linha('dono')}</span>`;
}

// Linha do NEGÓCIO: a etapa do par é a da ponta mais atrasada; diz o que
// falta, de quem, e há quanto tempo o par está parado.
function avancoDoNegocio(parId, par) {
  const ck = checklistCache[parId];
  if (!ck || ck === 'loading') return '';
  const nCliente = (ck.cliente || new Set()).size;
  const nDono = (ck.dono || new Set()).size;
  const atras = nCliente <= nDono ? 'cliente' : 'dono';
  const n = Math.min(nCliente, nDono);
  const feitos = ck[atras] || new Set();
  const falta = ETAPAS.find((e) => !feitos.has(e));
  const dias = diasDesde(par.updated_at) ?? '?';
  const bola = par.dono_respondeu && falta && ['valor', 'fotos', 'aceite'].includes(falta) && atras === 'dono'
    ? 'nós (completar a ponta)' : par.dono_respondeu ? 'nós' : 'dono';
  const cor = n >= 4 ? 'var(--verde)' : n >= 2 ? 'var(--ambar)' : 'var(--tx2)';
  return `<div class="negocio"><b style="color:${cor}">Negócio ${n}/5</b>
    ${falta ? `· falta <b>${ETAPA_ROTULO[falta]}</b> do ${atras}` : '· pronto pra visita'}
    · bola: ${bola} · parado ${dias}d</div>`;
}

async function carregarChecklist(parIds) {
  const faltam = parIds.filter((id) => !checklistCache[id]);
  if (!faltam.length) return;
  faltam.forEach((id) => { checklistCache[id] = 'loading'; });
  try {
    const r = await fila('checklist_listar', { par_ids: faltam });
    faltam.forEach((id) => { checklistCache[id] = { cliente: new Set(), dono: new Set() }; });
    (r.itens || []).forEach((i) => { checklistCache[i.par_id][i.lado]?.add(i.etapa); });
    renderTabela();
  } catch (e) { faltam.forEach((id) => { delete checklistCache[id]; }); }
}

async function carregarConversa(pessoa) {
  const el = document.getElementById('conversa-' + pessoa.id);
  if (!el) return;
  try {
    const termo = (pessoa.nome_exibicao || '').split('(')[0].trim();
    const r = await fila('conversa_recente', { termo, telefone: pessoa.telefone || pessoa.contato_privado || '' });
    const fmt = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tudo = [
      ...(r.entrada || []).map((m) => ({ t: m.criado_em, quem: '⬅️ ele(a)', txt: m.texto })),
      ...(r.saida || []).map((m) => ({ t: m.enviado_em || m.criado_em, quem: m.estado === 'enviada' ? '➡️ nós' : '➡️ nós (na fila)', txt: m.texto })),
    ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 4);
    el.innerHTML = tudo.length ? '<b>Conversa recente:</b>' + tudo.map((m) =>
      `<div class="msg-linha"><span class="quando">${fmt(m.t)}</span> ${m.quem}: ${esc((m.txt || '').slice(0, 90))}</div>`).join('') : '';
  } catch (e) { el.innerHTML = ''; }
}

function gavetaHtml(c) {
  const pares = (c.pares || []).filter((x) => !x.par.descartado_motivo)
    .sort((a, b) => (b.par.dono_respondeu ? 1 : 0) - (a.par.dono_respondeu ? 1 : 0));
  const linhas = pares.map(({ par, imovel }) => {
    const href = imovel && /^https:\/\/(www\.|sp\.)?olx\.com\.br\//.test(imovel.link_fonte_privado || '') ? imovel.link_fonte_privado : null;
    const nome = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(par.apelido || 'par')} ↗</a>` : esc(par.apelido || 'par');
    const data = par.updated_at ? new Date(par.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
    return `<tr data-par="${par.id}">
      <td>${nome}</td>
      <td class="num">${imovel && imovel.valor ? fmtK(imovel.valor) : '—'}</td>
      <td>${estadoDoPar(par)}</td>
      <td>${chipsPontas(par.id)}${avancoDoNegocio(par.id, par)}</td>
      <td class="num">${data} · ${diasDesde(par.updated_at) ?? '?'}d</td>
      <td>${imovel && imovel.telefone_anunciante ? esc(imovel.telefone_anunciante) + (String(imovel.telefone_anunciante).replace(/\D/g, '').length >= 10 ? ` <a class="zap" href="https://wa.me/55${String(imovel.telefone_anunciante).replace(/\D/g, '').replace(/^55/, '')}" target="_blank" rel="noopener" title="Abrir conversa no WhatsApp">📲</a>` : '') : '—'}</td>
      <td>
        <button data-acao="ia-redigir">✍️ Responder</button>
        <button data-acao="respondeu">Respondeu</button>
        <button data-acao="nota">Nota</button>
        <button data-acao="morto">Morto</button>
      </td>
    </tr>`;
  }).join('');
  setTimeout(() => carregarChecklist(pares.map(({ par }) => par.id)), 0);
  setTimeout(() => carregarConversa(c.pessoa), 0);
  return `<div class="gaveta-titulo">Alvos de ${esc(c.pessoa.nome_exibicao)} — ${pares.length} ativos</div>
    <div class="conversa-recente" id="conversa-${c.pessoa.id}"></div>
    <table class="alvos"><thead><tr><th>Alvo</th><th>Valor</th><th>Estado</th><th>Pontas</th><th>Últ. contato</th><th>Tel anunciante</th><th>Ações</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="7" style="color:var(--tx2)">nenhum alvo ativo</td></tr>'}</tbody></table>
    <div class="gaveta-acoes">
      <button class="garimpar-btn" data-g="${c.pessoa.id}">🎯 Garimpar novos alvos</button>
      <button class="editar-btn" data-e="${c.pessoa.id}">✎ Editar ficha</button>
    </div>`;
}

async function carregarGarimpo() {
  try {
    const [g, v] = await Promise.all([fila('garimpo_listar'), fila('varredura_listar')]);
    const linha = (icone, nome, i) =>
      `<div class="fila-item"><span style="color:${i.estado === 'concluida' ? 'var(--verde)' : 'var(--amarelo)'};font-size:12px;font-weight:700">${i.estado}</span>
       <span>${icone} ${esc(nome)}</span>
       <span class="bola">${esc((i.resultado || '').slice(0, 60))}</span></div>`;
    const gi = (g.itens || []).filter((i) => ['pendente', 'executando'].includes(i.estado) || i.estado === 'concluida')
      .slice(0, 4).map((i) => linha('🎯', `${i.pessoa_nome} (meta ${i.meta})`, i));
    const vi = (v.itens || []).slice(0, 2).map((i) => linha('📡', 'Varredura OLX + WhatsApp', i));
    const el = document.querySelector('#garimpo-lista');
    if (!el) return;
    el.innerHTML = [...vi, ...gi].join('') || '<div class="fila-item" style="color:var(--tx2)">nenhuma ordem</div>';
  } catch (e) { /* seção opcional */ }
}

async function carregarAgenda() {
  const el = document.querySelector('#agenda-lista');
  if (!el) return;
  try {
    const r = await fila('agenda_listar');
    const itens = r.itens || [];
    const agora = Date.now();
    el.innerHTML = itens.length ? itens.map((c) => {
      const vencido = new Date(c.prazo) < agora;
      const quando = new Date(c.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `<div class="fila-item" data-cid="${c.id}" style="border-left:3px solid ${vencido ? 'var(--verm)' : 'var(--ambar)'}">
        <span style="font-size:12px;font-weight:700;color:${c.quem_deve === 'nos' ? 'var(--ambar)' : 'var(--tx2)'}">${c.quem_deve === 'nos' ? 'NÓS devemos' : 'ELES devem'}${vencido ? ' · VENCIDO' : ' · ' + quando}</span>
        <span>${esc(c.rotulo || c.destino)}</span>
        <span class="bola">${esc((c.o_que || '').slice(0, 60))}</span>
        <button data-c="cumprir" title="Marcar como cumprido">✓ feito</button>
      </div>`;
    }).join('') : '<div class="fila-item" style="color:var(--verde)">agenda em dia ✓</div>';
    const h2 = document.querySelector('#agenda h2');
    const vencidos = itens.filter((c) => new Date(c.prazo) < agora).length;
    if (h2) h2.innerHTML = `📅 Agenda ${vencidos ? '<b>(' + vencidos + ' vencido' + (vencidos > 1 ? 's' : '') + ')</b>' : ''}`;
    el.querySelectorAll('button[data-c]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try { await fila('agenda_cumprir', { id: btn.closest('[data-cid]').dataset.cid }); toast('OK ✔'); await carregarAgenda(); }
        catch (e) { toast(e.message, true); }
      }));
  } catch (e) { el.innerHTML = '<div class="fila-item" style="color:var(--tx2)">' + esc(e.message) + '</div>'; }
}

async function carregarFiscalizacao() {
  const el = document.querySelector('#fiscalizacao-lista');
  if (!el) return;
  try {
    const r = await fila('violacao_listar');
    const itens = r.itens || [];
    const cor = { alta: 'var(--verm)', media: 'var(--ambar)', baixa: 'var(--tx2)' };
    el.innerHTML = itens.length ? itens.map((v) =>
      `<div class="fila-item" data-vid="${v.id}" style="border-left:3px solid ${cor[v.gravidade]}">
        <span style="color:${cor[v.gravidade]};font-size:12px;font-weight:700">${v.tipo.replace(/_/g, ' ')}</span>
        <span>${esc(v.descricao)}</span>
        <button data-v="resolver" title="Marcar como resolvida">✓ resolvi</button>
      </div>`).join('') : '<div class="fila-item" style="color:var(--verde)">nenhuma violação aberta ✓</div>';
    const h2 = document.querySelector('#fiscalizacao h2');
    if (h2) h2.innerHTML = `🔍 Fiscalização ${itens.length ? '<b>(' + itens.length + ' aberta' + (itens.length > 1 ? 's' : '') + ')</b>' : ''}`;
    el.querySelectorAll('button[data-v]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try { await fila('violacao_resolver', { id: btn.closest('[data-vid]').dataset.vid }); toast('OK ✔'); await carregarFiscalizacao(); }
        catch (e) { toast(e.message, true); }
      }));
  } catch (e) { el.innerHTML = '<div class="fila-item" style="color:var(--tx2)">' + esc(e.message) + '</div>'; }
}

document.querySelector('#varrer-agora').addEventListener('click', async () => {
  try {
    const r = await fila('varredura_criar');
    toast(r.duplicada ? 'Já tem varredura na fila' : 'Varredura pedida ✔ — o vigia pega em até 15 min');
    await carregarGarimpo();
  } catch (e) { toast(e.message, true); }
});

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
    // F9: frescura vem da CAIXA (fonte da verdade da conversa), não do campo espelhado
    try {
      const tels = carteiras.flatMap((c) => [c.pessoa.telefone, c.pessoa.contato_privado]).filter(Boolean);
      if (tels.length) aplicarInteracoes(carteiras, (await fila('interacoes', { telefones: tels })).por_telefone || {});
    } catch (e) { console.warn('interacoes indisponivel:', e.message); }
    renderAlertas(); renderTabela(); carregarFilaEnvio(); carregarInbox(); carregarGarimpo(); carregarAgenda(); carregarFiscalizacao(); carregarSaude();
    mostrarAba(abaAtual);
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
  if (s) { carregar(); rotear(); }
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
// ---- Abas: VIPs (tabela-mãe) x Hoje (ação) ----
let abaAtual = 'vips';
let gavetaAberta = null; // pessoa.id com a gaveta de alvos aberta
function mostrarAba(nome) {
  abaAtual = nome;
  const hoje = nome === 'hoje';
  for (const sel of ['#alertas', '#inbox', '#fila-envio', '#agenda', '#fiscalizacao', '#garimpo']) {
    const el = document.querySelector(sel); if (el) el.hidden = !hoje;
  }
  $('#tabela').hidden = hoje;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
}
// Entrega 1: roteamento por setor (hash). #carteira = conteúdo anterior, intacto.
const SETORES_TELA = { painel };
async function rotear() {
  const hash = location.hash || '#painel';
  const [rota, arg] = hash.slice(1).split('/');
  document.querySelectorAll('#setores a').forEach((a) => a.classList.toggle('ativa', a.getAttribute('href') === hash));
  const el = document.querySelector('#setor'); const legado = document.querySelector('#carteira-legado');
  if (rota === 'carteira') { el.hidden = true; legado.hidden = false; mostrarAba(abaAtual); return; }
  legado.hidden = true; el.hidden = false;
  const mod = rota === 'diario' ? diario : (SETORES_TELA[rota] || painel);
  if (rota === 'diario') diario.configurar(arg || 'recepcao');
  el.innerHTML = '<p>carregando…</p>';
  try { await mod.carregar(); mod.render(el); } catch (e) { el.innerHTML = `<p class="erro">${esc(e.message)}</p>`; }
}
window.addEventListener('hashchange', rotear);
document.querySelectorAll('#abas button').forEach((b) =>
  b.addEventListener('click', () => mostrarAba(b.dataset.aba)));
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
