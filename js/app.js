// app.js (entrega 5): sessão, cabeçalho, diálogos comuns e roteamento por setor.
// Toda tela mora em js/setores/<setor>.js ({configurar?, carregar, render}); a lógica pura em módulos testados.
import { sessao, login, logout, fetchCarteira } from './api.js?v=1788530695';
import { diasDesde, filaDoDia, esc } from './logic.js?v=1788530695';
import { toast, abrirDialogo, invocar } from './ui.js?v=1788530695';
import * as painel from './setores/painel.js?v=1788530695';
import * as diario from './setores/diario.js?v=1788530695';
import * as redacao from './setores/redacao.js?v=1788530695';
import * as expedicao from './setores/expedicao.js?v=1788530695';
import * as auditoria from './setores/auditoria.js?v=1788530695';
import * as recepcao from './setores/recepcao.js?v=1788530695';
import * as cobranca from './setores/cobranca.js?v=1788530695';
import * as garimpo from './setores/garimpo.js?v=1788530695';
import * as fiscalizacao from './setores/fiscalizacao.js?v=1788530695';
import * as carteira from './setores/carteira.js?v=1788530695';

const $ = (s) => document.querySelector(s);

async function resumoDia() {
  toast('Montando resumo…');
  try {
    const carteiras = await fetchCarteira();
    const dump = filaDoDia(carteiras).map((f) =>
      `${f.pessoa.nome_exibicao} | comissao ${f.comissao} | bola ${f.bola} | alvos ${f.alvos} | ` +
      `ult.interacao ha ${diasDesde(f.pessoa.ultima_interacao) ?? '?'}d | divida ${f.pessoa.promessa_pendente ? 'SIM' : 'nao'} | ` +
      `tel ${f.pessoa.telefone || f.pessoa.contato_privado ? 'sim' : 'NAO'} | ${(f.pessoa.proximo_passo || '').slice(0, 150)}`).join('\n');
    const { texto } = await invocar('resumo-dia', { dados: dump });
    abrirDialogo('Resumo do dia', texto);
  } catch (e) { toast(e.message, true); }
}

// Roteamento por setor (hash): #painel (padrão), #diario/<setor>, #carteira, #carteira/<pessoaId>, …
const SETORES_TELA = { painel, recepcao, redacao, expedicao, cobranca, garimpo, fiscalizacao, auditoria, carteira };
async function rotear() {
  const hash = location.hash || '#painel';
  const [rota, arg] = hash.slice(1).split('/');
  document.querySelectorAll('#setores a').forEach((a) => { const h = a.getAttribute('href'); a.classList.toggle('ativa', hash === h || hash.startsWith(h + '/')); });
  const el = $('#setor');
  const mod = rota === 'diario' ? diario : (SETORES_TELA[rota] || painel);
  if (typeof mod.configurar === 'function') mod.configurar(rota === 'diario' ? (arg || 'recepcao') : arg);
  el.innerHTML = '<p>carregando…</p>';
  $('#atualizado').textContent = 'carregando…';
  try { await mod.carregar(); await mod.render(el); $('#atualizado').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { el.innerHTML = `<p class="erro">${esc(e.message)}</p>`; $('#atualizado').textContent = 'erro'; }
}
window.addEventListener('hashchange', rotear);

async function boot() {
  const s = await sessao();
  $('#login').hidden = !!s;
  $('#painel').hidden = !s;
  if (s) rotear();
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
$('#recarregar').addEventListener('click', rotear);
$('#sair').addEventListener('click', async () => { await logout(); location.reload(); });
$('#resumo-dia').addEventListener('click', resumoDia);
$('#varrer-agora').addEventListener('click', () => { location.hash = '#recepcao'; }); // a ação mora na Recepção
$('#novo-cliente').addEventListener('click', () => carteira.abrirNovo());
$('#ia-fechar').addEventListener('click', () => { $('#ia-dialog').close(); });
$('#ia-fila').addEventListener('click', () => carteira.enfileirarRascunho($('#ia-texto').value));
$('#ia-copiar').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#ia-texto').value);
  toast('Copiado ✔');
});

boot();
