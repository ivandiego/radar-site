// 15/09 (fase 1 da régua do rascunho, radar-permutas PR 218, peça 8): "Liberar conversa" num diálogo da página.
// Sem prompt()/confirm() nativos (travam a automação de navegador). O {canal, destino} sai da linha do bloqueio
// (prova bloqueio_conversa:<id>) e o destino aparece sempre mascarado.
import { fila } from '../api.js?v=1789348087';
import { esc } from '../logic.js?v=1789348087';
import { pedidoDeLiberacao } from '../painel.js?v=1789348087';
import { toast } from '../ui.js?v=1789348087';

const $ = (s) => document.querySelector(s);
const CANAL = { whatsapp: 'WhatsApp', olx: 'OLX', olx_anuncio: 'OLX' };
export async function abrirLiberar(ref, depois = null) {
  let item = null;
  try { item = (await fila('prova', { ref })).item; } catch (e) { toast('Não consegui abrir a conversa: ' + e.message, true); return; }
  const p = pedidoDeLiberacao(item);
  const dlg = $('#liberar-dialog');
  $('#liberar-texto').innerHTML = p.ok
    ? `Liberar a conversa de ${esc(CANAL[p.canal] || p.canal)} com <b>${esc(p.destinoMascarado)}</b>? Os robôs voltam a ler essa conversa e podem escrever para ela de novo.`
    : esc(p.erro);
  $('#liberar-erro').hidden = true;
  const conf = $('#liberar-confirmar');
  conf.hidden = !p.ok; conf.disabled = false;
  const fim = async (msg) => { dlg.close(); toast(msg); if (depois) await depois(); };
  conf.onclick = async () => {
    conf.disabled = true;
    try { await fila('liberar_conversa', { canal: p.canal, destino: p.destino }); await fim('Conversa liberada ✔'); }
    catch (e) {
      if (e.status === 404) { await fim('Essa conversa já estava liberada.'); return; }
      $('#liberar-erro').textContent = 'Não consegui liberar: ' + e.message; $('#liberar-erro').hidden = false; conf.disabled = false;
    }
  };
  $('#liberar-cancelar').onclick = () => dlg.close();
  dlg.showModal();
}
