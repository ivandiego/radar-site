// Tela Recepção (entrega 4, spec §5): o que chegou (WA/OLX), áudios, quem falou por último;
// Varrer agora · Escanear QR · Ignorar · Ver o diário.
import { fila } from '../api.js?v=1789161785';
import { esc } from '../logic.js?v=1789161785';
import { faixaDoSetor } from '../painel.js?v=1789161785';
import { chegadasDaRecepcao, contextoDaConversa, pedidoDeResposta } from '../recepcao.js?v=1789161785';
import { perguntaDasMensagens, idsDaEscolha } from '../carteira.js?v=1789161785';
import { conversaOrdenada } from '../ficha.js?v=1789161785';
import { toast, abrirDialogo, invocar } from '../ui.js?v=1789161785';
import { faixa } from './faixa.js?v=1789161785';

let dados = null, painel = null;
export async function carregar() { [dados, painel] = await Promise.all([fila('recepcao_listar'), fila('painel')]); }
const QR = `1. No Mac do robô, traga pra frente a janela do Chrome do robô (perfil "chrome-robo", porta 9222).
2. Na aba web.whatsapp.com, escaneie o QR com o WhatsApp do celular (Dispositivos conectados → Conectar um dispositivo).
3. Quando a lista de conversas aparecer, volte aqui e clique em Varrer agora.`;
export function render(el) {
  const f = faixaDoSetor(painel || {}, 'recepcao', 'America/Sao_Paulo');
  const { itens, resumo, ordens } = chegadasDaRecepcao(dados || {}, 'America/Sao_Paulo');
  const deslogado = f.travado.some((t) => /deslogado/i.test(t));
  el.innerHTML = `
    ${faixa(f, 'recepcao')}
    <div class="acoes-setor"><button class="varrer">Varrer agora</button><button class="qr ${deslogado ? 'urgente' : ''}">Escanear QR</button>
      <span class="resumo-rec">${resumo.novas} novas · ${resumo.audios} áudios · ${resumo.whatsapp} WhatsApp · ${resumo.olx} OLX (48h)</span></div>
    <div class="ordens-rec"><h3>Varreduras pedidas</h3>${ordens.length ? `<ul>${ordens.map((o) => `<li><b>${esc(o.rotulo)}</b> ${esc(o.estado)} · ${o.hora} <small>${esc(o.resultado)}</small></li>`).join('')}</ul>` : '<p>nenhuma</p>'}</div>
    <div class="chegadas"><h3>O que chegou</h3>
      ${itens.length ? `<table class="chegadas"><tr><th>quem</th><th>canal</th><th>mensagem</th><th>hora no canal</th><th>registrada</th><th>última palavra</th><th></th></tr>${itens.map((i) => `
        <tr data-mid="${esc(i.id)}" class="${esc(i.estado)}"><td><b>${esc(i.remetente)}</b>${i.anuncio ? `<br><small>${esc(i.anuncio.slice(0, 50))}</small>` : ''}</td><td>${esc(i.canal)}</td>
          <td>${i.ehAudio ? '🎧 ' : ''}${esc(i.texto.slice(0, 200))}</td><td>${i.hora_canal}</td><td>${i.hora_registro}</td><td>${i.ultimaPalavra}</td>
          <td>${i.estado === 'nova' ? '<button class="responder">Responder</button><button class="ignorar">Ignorar</button>' : i.estado === 'em_rascunho' ? esc(i.estado) + ' <button class="responder">Responder</button>' : esc(i.estado)}</td></tr>`).join('')}</table>` : '<p>nada chegou nas últimas 48h</p>'}
    </div>`;
  const recarregar = async () => { await carregar(); render(el); };
  el.querySelector('button.varrer').addEventListener('click', async () => {
    try { const r = await fila('varredura_criar'); alert(r.duplicada ? 'Já tem varredura na fila' : 'Varredura pedida. O Ouvidor pega em até 5 min.'); await recarregar(); } catch (e) { alert(e.message); }
  });
  el.querySelector('button.qr').addEventListener('click', () => {
    document.querySelector('#ia-titulo').textContent = 'Escanear QR do WhatsApp';
    document.querySelector('#ia-texto').value = QR;
    document.querySelector('#ia-fila').hidden = true; document.querySelector('#ia-aplicar').hidden = true;
    document.querySelector('#ia-dialog').showModal();
  });
  el.querySelectorAll('button.responder').forEach((b) => b.addEventListener('click', () => responder(itens.find((x) => x.id === b.closest('tr').dataset.mid))));
  el.querySelectorAll('button.ignorar').forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('tr').dataset.mid;
    try { await fila('inbox_marcar', { id, estado: 'ignorada' }); await recarregar(); } catch (e) { alert(e.message); }
  }));
}

// Responder na Recepção (11/09): rascunho pra conversa sem par na Carteira. Vai pra Redação (✔ do Ivan), nunca sai direto.
async function responder(item) {
  if (!item) return;
  toast('Redigindo…');
  try {
    const cx = await fila('caixa_da_conversa', { canal: item.canal, destino: item.destino });
    const abertas = cx.mensagens || [];
    const hist = item.canal === 'whatsapp' ? conversaOrdenada(await fila('conversa_recente', { telefone: item.destino }), 'America/Sao_Paulo') : [];
    const { texto } = await invocar('redigir', { tipo: 'resposta', contexto: contextoDaConversa(item, abertas, hist) });
    abrirDialogo('Rascunho para ' + item.remetente + ' — revise antes de mandar pra Redação', texto, null, (t) => enfileirar(item, abertas, t));
  } catch (e) { toast('Não consegui redigir: ' + e.message, true); }
}
async function enfileirar(item, abertas, texto) {
  let ids = [];
  if (abertas.length) {
    let escolha = idsDaEscolha(abertas, prompt(perguntaDasMensagens(abertas), 'todas'));
    while (escolha && !escolha.ok) escolha = idsDaEscolha(abertas, prompt(escolha.erro + '\n\n' + perguntaDasMensagens(abertas), 'todas'));
    if (!escolha) return;
    ids = escolha.ids;
  }
  const pedido = pedidoDeResposta(item, texto, ids);
  if (!pedido) { toast('Texto vazio.', true); return; }
  try { await fila('criar', pedido); document.querySelector('#ia-dialog').close(); toast('Na fila ✔ — aprove na Redação'); } catch (e) { toast(e.message, true); }
}
