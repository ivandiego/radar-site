// Tela Fiscalização (entrega 4, spec §2/§5): violações por gravidade, cada uma com o setor
// que resolve, Abrir prova e Resolvida; resolvidas nas últimas 24h.
import { fila } from '../api.js';
import { esc } from '../logic.js';
import { faixaDoSetor } from '../painel.js';
import { violacoesAgrupadas, vipsDaAuditoria } from '../fiscalizacao.js';
import { faixa, abrirProva } from './faixa.js';

let dados = null, painel = null, aud = null;
export async function carregar() { [dados, painel, aud] = await Promise.all([fila('fiscalizacao_listar'), fila('painel'), fila('auditoria_listar').catch(() => null)]); }
const li = (v, aberta) => `<li class="viol ${esc(v.gravidade)}" data-vid="${esc(v.id)}" data-ref="${esc(v.referencia)}"><b>${esc(v.rotulo)}</b> <small>${v.hora}</small><div class="texto">${esc(v.descricao)}</div>
  <div class="acoes">${v.setor ? `<a href="#${esc(v.setor)}">Resolver na ${esc(v.setorTitulo)}</a>` : ''}${v.temProva ? '<button class="abrir-prova">Abrir prova</button>' : ''}${aberta ? '<button class="resolvida">Resolvida</button>' : ''}</div></li>`;
export function render(el) {
  const f = faixaDoSetor(painel || {}, 'fiscalizacao', 'America/Sao_Paulo');
  const v = violacoesAgrupadas(dados || {}, 'America/Sao_Paulo');
  const bloco = (grav, titulo) => `<div class="viol-bloco ${grav}"><h3>${titulo} (${v.abertas[grav].length})</h3>${v.abertas[grav].length ? `<ul>${v.abertas[grav].map((x) => li(x, true)).join('')}</ul>` : '<p>nenhuma</p>'}</div>`;
  // F4.5.9: VIPs hoje — um veredito por VIP, vindo da auditoria mecânica (robô, sem LLM)
  const a = vipsDaAuditoria(aud || {}, 'America/Sao_Paulo');
  const vipLi = (v) => `<li class="vip-aud ${esc(v.veredito)}" data-pessoa="${esc(v.pessoaId)}"><b>${esc(v.nome)}</b> <small>${esc(v.rotulo)} · ${v.alvos} alvo(s)${v.alvosExcluidos ? `, ${v.alvosExcluidos} excluído(s)` : ''}</small>
    ${v.motivos.length ? `<ul class="motivos">${v.motivos.map((m) => `<li class="${esc(m.gravidade)}">${esc(m.texto)}</li>`).join('')}</ul>` : ''}
    <div class="acoes"><small>${esc(v.canalUltima)}</small> <a href="#carteira/${esc(v.pessoaId)}">Abrir na Carteira</a> <a href="#auditoria">Conferir conversas</a></div></li>`;
  const blocoVips = a.rodada
    ? `<div class="viol-bloco vips-hoje"><h3>VIPs hoje <small>(auditoria de ${esc(a.rodada)})</small></h3><p class="resumo-vips">${a.resumo.vermelhos} vermelhos · ${a.resumo.amarelos} amarelos · ${a.resumo.verdes} verdes</p><ul>${a.vips.map(vipLi).join('')}</ul></div>`
    : '<div class="viol-bloco vips-hoje"><h3>VIPs hoje</h3><p>a auditoria mecânica ainda não rodou (06:00 e após cada instalação)</p></div>';
  el.innerHTML = `${faixa(f, 'fiscalizacao')}${blocoVips}
    <div class="acoes-setor"><span class="resumo-fis">${v.total} violações abertas · ${v.resolvidas.length} resolvidas (24h)</span></div>
    ${bloco('alta', 'Gravidade alta')}${bloco('media', 'Gravidade média')}${bloco('baixa', 'Gravidade baixa')}
    <div class="viol-bloco resolvidas"><h3>Resolvidas (24h)</h3>${v.resolvidas.length ? `<ul>${v.resolvidas.map((x) => li(x, false)).join('')}</ul>` : '<p>nenhuma nas últimas 24h</p>'}</div>`;
  const recarregar = async () => { await carregar(); render(el); };
  el.querySelectorAll('button.resolvida').forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('li').dataset.vid;
    try { await fila('violacao_resolver', { id }); await recarregar(); } catch (e) { alert(e.message); }
  }));
  el.querySelectorAll('button.abrir-prova').forEach((b) => b.addEventListener('click', () => abrirProva(b.closest('li').dataset.ref)));
}
