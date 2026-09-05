// Tela Carteira (entrega 5, spec §2/§5): tabela de VIPs limpa (#carteira) + ficha por VIP (#carteira/<id>).
// Ações do dono moram aqui: Nova pessoa · Editar ficha · Nota · Dono respondeu · Descartar par · Responder · Garimpar alvos.
import { sb, fila, fetchCarteira, registrarNoPar } from '../api.js';
import { esc, aplicarInteracoes, payloadGarimpo, canalDoDestino } from '../logic.js';
import { linhasDaTabela, reguasDe, fichaDe, conversaOrdenada, patchDaAcao, patchPessoa } from '../ficha.js';
import { toast, abrirDialogo, invocar } from '../ui.js';

const TZ = 'America/Sao_Paulo';
const $ = (s) => document.querySelector(s);
let carteiras = [], pessoaId = null, soVips = true, ordem = { col: null, asc: false };
const fmtK = (v) => 'R$ ' + Math.round(v / 1000) + 'k';
const hojeBR = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function configurar(arg) { pessoaId = arg || null; }
export async function carregar() {
  carteiras = await fetchCarteira();
  try {
    const tels = carteiras.flatMap((c) => [c.pessoa.telefone, c.pessoa.contato_privado]).filter(Boolean);
    if (tels.length) aplicarInteracoes(carteiras, (await fila('interacoes', { telefones: tels })).por_telefone || {});
  } catch (e) { console.warn('interacoes indisponivel:', e.message); }
}

// ---------- tabela ----------
function renderTabela(el) {
  const linhas = linhasDaTabela(carteiras, { soVips, ...ordem }, new Date());
  const reguas = carteiras.flatMap((c) => reguasDe(c, new Date())).slice(0, 6);
  const seta = (c) => (ordem.col === c ? (ordem.asc ? ' ▲' : ' ▼') : '');
  const th = (c, t) => `<th data-o="${c}">${t}${seta(c)}</th>`;
  el.innerHTML = `
    <div class="faixa-setor"><h2>Carteira</h2><span>dono</span><span>${linhas.length} ${soVips ? 'VIPs' : 'pessoas ativas'}</span><label><input type="checkbox" class="todos" ${soVips ? '' : 'checked'}> Mostrar todos</label></div>
    <div class="reguas">${reguas.length ? reguas.map((a) => `<div class="alerta ${esc(a.tipo)}" data-pessoa="${esc(a.pessoaId)}">${esc(a.msg)}</div>`).join('') : '<div class="alerta ok">Nenhuma régua vencida nos VIPs</div>'}</div>
    <div class="rolagem"><table class="vips"><thead><tr>${th('cliente', 'Cliente')}${th('tem', 'Tem')}${th('adiciona', 'Adiciona')}${th('alvos', 'Alvos')}${th('resp', 'Resp.')}<th>Mudos</th>${th('int', 'Últ. interação')}<th>Bola</th>${th('comissao', 'Comissão')}<th>Canal</th><th></th></tr></thead>
    <tbody>${linhas.map((l) => `<tr class="vip-row ${l.problema ? 'problema' : ''}" data-pessoa="${esc(l.id)}">
      <td class="nome-cel">${esc(l.nome)}${l.linkOlx ? ` <a href="${esc(l.linkOlx)}" target="_blank" rel="noopener">↗</a>` : ''}</td>
      <td class="num">${l.tem ? fmtK(l.tem) : '—'}</td><td class="num ok">${l.adiciona ? '+' + fmtK(l.adiciona) : '—'}</td>
      <td class="num ${l.clsAlvos}">${l.alvos}/${l.meta}</td><td class="num ok">${l.respondidos}</td><td class="num ${l.mudos ? 'warn' : ''}">${l.mudos}</td>
      <td class="num ${l.diasInt === null ? '' : l.diasInt >= 2 ? 'bad' : l.diasInt >= 1 ? 'warn' : 'ok'}" title="${esc(l.dicaInt)}">${l.diasInt === null ? '—' : l.diasInt + 'd'}${l.ultimaPalavra ? ` <small>${l.ultimaPalavra}</small>` : ''}</td>
      <td>${esc(l.bola)}</td><td class="com">${fmtK(l.comissao)}</td><td>${l.canalMorto ? '<span class="bad">☠ ' + esc(l.canal) + '</span>' : esc(l.canal || '—')}</td>
      <td><button class="abrir-ficha">Abrir ficha</button></td></tr>`).join('') || '<tr><td colspan="11">nenhuma pessoa ativa</td></tr>'}</tbody></table></div>`;
  el.querySelectorAll('th[data-o]').forEach((h) => h.addEventListener('click', () => { const c = h.dataset.o; ordem = { col: c, asc: ordem.col === c ? !ordem.asc : false }; renderTabela(el); }));
  el.querySelector('input.todos').addEventListener('change', (ev) => { soVips = !ev.target.checked; renderTabela(el); });
  el.querySelectorAll('tr.vip-row').forEach((tr) => tr.addEventListener('click', () => { location.hash = '#carteira/' + tr.dataset.pessoa; }));
  el.querySelectorAll('.reguas .alerta[data-pessoa]').forEach((a) => a.addEventListener('click', () => { location.hash = '#carteira/' + a.dataset.pessoa; }));
  el.querySelectorAll('table.vips a').forEach((a) => a.addEventListener('click', (ev) => ev.stopPropagation()));
}

// ---------- ficha ----------
let checklist = null, conversa = [];
async function carregarFicha(c) {
  const ids = (c.pares || []).filter((x) => !x.par.descartado_motivo).map((x) => x.par.id);
  checklist = new Map();
  try {
    if (ids.length) {
      const r = await fila('checklist_listar', { par_ids: ids });
      for (const id of ids) checklist.set(id, { cliente: new Set(), dono: new Set() });
      for (const i of r.itens || []) { const ck = checklist.get(i.par_id); if (ck && ck[i.lado]) ck[i.lado].add(i.etapa); }
    }
  } catch (e) { checklist = null; }
  try {
    const p = c.pessoa;
    conversa = conversaOrdenada(await fila('conversa_recente', { termo: (p.nome_exibicao || '').split('(')[0].trim(), telefone: p.telefone || p.contato_privado || '' }), TZ);
  } catch (e) { conversa = []; }
}
const ETAPAS = ['contactado', 'valor', 'fotos', 'aceite', 'visita_ok'];
const ROTULO = { contactado: 'contato', valor: 'valor', fotos: 'fotos', aceite: 'ACEITE', visita_ok: 'visita' };
const pontasHtml = (pontas) => ['cliente', 'dono'].map((lado) => `<div class="ponta"><b>${lado}</b> ${ETAPAS.map((e) => `<i class="${pontas[lado].includes(e) ? 'ck' : 'nk'}" title="${ROTULO[e]}">${pontas[lado].includes(e) ? '●' : '○'}</i>`).join('')}</div>`).join('');
const negocioHtml = (n) => (n ? `<div class="negocio"><b>Negócio ${n.n}/5</b> ${n.falta ? `· falta <b>${ROTULO[n.falta]}</b> do ${n.atras}` : '· pronto pra visita'} · bola: ${esc(n.bola)}</div>` : '');
function contextoDoPar(c, a) {
  const p = c.pessoa;
  return `CLIENTE: ${p.nome_exibicao} (${p.classificacao || '?'}). Tem: ${p.o_que_tem_texto || '?'} (valor ${p.valor_do_que_tem || '?'}). Busca: ${p.o_que_busca || '?'}. Completa até: ${p.diferenca_max || '?'}.\nPAR: ${a.apelido}. Dono respondeu: ${a.estado === 'respondeu' ? 'sim' : 'não'}.\nALVO: valor anúncio ${a.valor || '?'}.\nHISTÓRICO DO PAR: ${a.historico}`;
}
async function renderFicha(el) {
  const c = carteiras.find((x) => x.pessoa.id === pessoaId);
  if (!c) { el.innerHTML = '<p class="erro">pessoa não encontrada</p><a class="voltar" href="#carteira">Voltar à tabela</a>'; return; }
  el.innerHTML = '<p>carregando ficha…</p>';
  await carregarFicha(c);
  const f = fichaDe(c, checklist, new Date()); const p = f.pessoa; const reguas = reguasDe(c, new Date());
  el.innerHTML = `<div class="ficha">
    <div class="faixa-setor"><a class="voltar" href="#carteira">← Voltar à tabela</a><h2>${esc(p.nome)}</h2><span>${esc(p.classificacao)}</span><span>${p.alvos}/${p.meta} alvos</span><span>comissão ${fmtK(p.comissao)}</span></div>
    <div class="acoes-setor"><button class="editar">Editar ficha</button><button class="garimpar">Garimpar alvos</button></div>
    <div class="dados"><div><b>Tem:</b> ${esc(p.tem)} ${p.valorTem ? '(' + fmtK(p.valorTem) + ')' : ''}</div><div><b>Busca:</b> ${esc(p.busca) || '—'}</div><div><b>Adiciona:</b> ${p.adiciona ? '+' + fmtK(p.adiciona) : '—'}</div>
      <div><b>Telefone:</b> ${esc(p.telefone) || '<span class="bad">sem tel</span>'}</div><div><b>Canal:</b> ${p.canalMorto ? '<span class="bad">☠ ' + esc(p.canal) + '</span>' : esc(p.canal) || '—'} ${p.linkOlx ? `<a href="${esc(p.linkOlx)}" target="_blank" rel="noopener">anúncio ↗</a>` : ''}</div>
      <div><b>Gargalo:</b> ${esc(p.gargalo) || '—'}</div><div><b>Próximo passo:</b> ${esc(p.proximoPasso) || '—'}</div></div>
    <div class="reguas">${reguas.map((a) => `<div class="alerta ${esc(a.tipo)}">${esc(a.msg)}</div>`).join('')}</div>
    <div class="conversa-recente">${conversa.length ? '<b>Conversa recente:</b>' + conversa.map((m) => `<div class="msg-linha"><span class="quando">${m.quando}</span> ${esc(m.quem)}: ${esc(m.texto)}</div>`).join('') : ''}</div>
    <h3>Alvos (${f.alvos.length})</h3>
    <div class="rolagem"><table class="alvos"><thead><tr><th>Alvo</th><th>Valor</th><th>Estado</th><th>Pontas</th><th>Parado</th><th>Tel anunciante</th><th>Ações</th></tr></thead><tbody>
      ${f.alvos.map((a) => `<tr data-par="${esc(a.parId)}"><td>${a.linkOlx ? `<a href="${esc(a.linkOlx)}" target="_blank" rel="noopener">${esc(a.apelido)} ↗</a>` : esc(a.apelido)}</td><td class="num">${a.valor ? fmtK(a.valor) : '—'}</td>
        <td><span class="est-${a.estado}">${esc(a.estadoTexto)}${a.canalResposta ? ' (' + a.canalResposta + ')' : ''}</span></td><td><span class="pontas">${pontasHtml(a.pontas)}</span>${negocioHtml(a.negocio)}</td>
        <td class="num">${a.dias ?? '?'}d</td><td>${esc(a.telAnunciante) || '—'}</td>
        <td><button data-acao="ia-redigir">Responder</button><button data-acao="respondeu">Dono respondeu</button><button data-acao="nota">Nota</button><button data-acao="morto">Descartar par</button></td></tr>`).join('') || '<tr><td colspan="7">nenhum alvo ativo</td></tr>'}
    </tbody></table></div>
    ${f.descartados.length ? `<details class="descartados"><summary>Descartados (${f.descartados.length})</summary><ul>${f.descartados.map((d) => `<li><b>${esc(d.apelido)}</b> — ${esc(d.motivo)}</li>`).join('')}</ul></details>` : ''}
  </div>`;
  const recarregar = async () => { await carregar(); await renderFicha(el); };
  el.querySelectorAll('table.alvos button[data-acao]').forEach((b) => b.addEventListener('click', async () => {
    const parId = b.closest('tr').dataset.par; const acao = b.dataset.acao; const alvo = f.alvos.find((x) => x.parId === parId);
    if (acao === 'ia-redigir') return responder(c, alvo);
    const texto = prompt({ respondeu: 'O que o dono respondeu?', nota: 'Nota:', morto: 'Motivo do descarte:' }[acao]);
    if (texto === null || !texto.trim()) return;
    try { await registrarNoPar(parId, (atual) => patchDaAcao(acao, texto, atual, hojeBR())); toast('Registrado ✔'); await recarregar(); } catch (e) { toast('Erro ao gravar: ' + (e.message || e), true); }
  }));
  el.querySelector('button.garimpar').addEventListener('click', async () => {
    try { const r = await fila('garimpo_criar', payloadGarimpo(c.pessoa)); alert(r.duplicada ? 'Já existe ordem aberta pra este VIP' : 'Ordem de garimpo criada. O Relógios executa na próxima rodada.'); } catch (e) { toast(e.message, true); }
  });
  el.querySelector('button.editar').addEventListener('click', () => abrirEdicao(c.pessoa));
}
let rascunho = null; // {c, alvo}
async function responder(c, alvo) {
  const tipo = prompt('Tipo: sondagem / resposta / cobranca', 'resposta');
  if (!tipo) return;
  toast('Redigindo…');
  try {
    const { texto } = await invocar('redigir', { tipo: tipo.trim(), contexto: contextoDoPar(c, alvo) });
    rascunho = { c, alvo };
    abrirDialogo('Rascunho (' + tipo + ') — revise antes de mandar pra Redação', texto, null, true);
  } catch (e) { toast(e.message, true); }
}
// chamado pelo app.js no clique de "+ Fila" do diálogo
export async function enfileirarRascunho(texto) {
  if (!rascunho) return;
  const { c, alvo } = rascunho; const p = c.pessoa;
  if (p.canal && /morto|sem[_ ]canal/i.test(p.canal) && !confirm('O canal deste cliente está marcado como "' + p.canal + '". Enfileirar mesmo assim?')) return;
  const olxId = (alvo.linkOlx || '').match(/-(\d{9,10})$/); const canal = prompt('Canal: olx ou whatsapp', olxId ? 'olx' : 'whatsapp');
  if (!canal) return;
  const destino = prompt('Destino (' + (canal === 'olx' ? 'list-id do anúncio' : 'telefone') + '):', canal === 'olx' ? (olxId ? olxId[1] : '') : (p.telefone || p.contato_privado || ''));
  if (!destino) return;
  try { await fila('criar', { canal: canalDoDestino(canal, destino), destino, destino_rotulo: alvo.apelido || p.nome_exibicao, par_id: alvo.parId, texto, origem: 'ia' }); $('#ia-dialog').close(); toast('Na fila ✔ — aprove na Redação'); rascunho = null; } catch (e) { toast(e.message, true); }
}

// ---------- Nova pessoa / Editar ficha ----------
let editandoId = null, formLigado = false;
function ligarForm() {
  if (formLigado) return; formLigado = true;
  $('#novo-fechar').addEventListener('click', () => $('#novo-dialog').close());
  $('#novo-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const campos = Object.fromEntries(['nome', 'classificacao', 'o_que_tem_texto', 'valor_do_que_tem', 'o_que_busca', 'diferenca_max', 'telefone', 'link'].map((k) => [k, fd.get(k) || '']));
    const patch = patchPessoa(campos, !!editandoId, hojeBR(), new Date().toISOString());
    try {
      const r = editandoId ? await sb.from('pessoa').update(patch).eq('id', editandoId) : await sb.from('pessoa').insert([patch]).select('id');
      if (r.error) throw r.error;
      $('#novo-dialog').close(); ev.target.reset(); toast(editandoId ? 'Ficha atualizada ✔' : 'Cliente cadastrado ✔'); editandoId = null;
      await carregar(); const el = $('#setor'); if (!el.hidden) render(el);
    } catch (e) { toast('Erro: ' + (e.message || e), true); }
  });
}
export function abrirNovo() {
  ligarForm(); editandoId = null; $('#novo-form').reset(); $('#novo-dialog h3').textContent = 'Nova pessoa'; $('#novo-dialog').showModal();
}
export function abrirEdicao(p) {
  ligarForm(); editandoId = p.id; const f = $('#novo-form');
  f.nome.value = p.nome_exibicao || ''; f.classificacao.value = p.classificacao || 'indefinido'; f.o_que_tem_texto.value = p.o_que_tem_texto || ''; f.valor_do_que_tem.value = p.valor_do_que_tem || '';
  f.o_que_busca.value = p.o_que_busca || ''; f.diferenca_max.value = p.diferenca_max || ''; f.telefone.value = p.telefone || ''; f.link.value = p.link_thread_olx_privado || '';
  $('#novo-dialog h3').textContent = 'Editar: ' + (p.nome_exibicao || ''); $('#novo-dialog').showModal();
}

export function render(el) {
  ligarForm();
  if (pessoaId) return renderFicha(el);
  renderTabela(el);
}
