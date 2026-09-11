// UI comum (entrega 5): toast, diálogo de texto e chamada das edge functions de IA.
import { sessao } from './api.js?v=1789161785';
import { FUNCTIONS_URL } from './config.js?v=1789161785';
const $ = (s) => document.querySelector(s);
export function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3500);
}
// 11/09: "+ Fila" chama quem abriu o diálogo (Carteira ou Recepção). mostrarFila = função → é ela que enfileira.
let enfileirarDoDialogo = null;
export function aoEnfileirar() { return enfileirarDoDialogo; }
export function abrirDialogo(titulo, texto, aplicar = null, mostrarFila = false) {
  enfileirarDoDialogo = typeof mostrarFila === 'function' ? mostrarFila : null;
  $('#ia-fila').hidden = !mostrarFila;
  $('#ia-titulo').textContent = titulo;
  $('#ia-texto').value = texto;
  const btn = $('#ia-aplicar');
  btn.hidden = !aplicar;
  btn.onclick = aplicar || null;
  $('#ia-dialog').showModal();
}
export async function invocar(fn, body) {
  const s = await sessao();
  if (!s) throw new Error('sessão expirada, entre de novo');
  const r = await fetch(`${FUNCTIONS_URL}/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.erro) throw new Error(data.erro || 'IA indisponível (' + r.status + ')');
  return data;
}
