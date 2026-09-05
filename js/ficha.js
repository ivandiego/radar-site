// Carteira (entrega 5, spec §2/§5): view-model PURO da tabela de VIPs e da ficha. Sem DOM.
// Testado em tests/ficha.test.mjs. Os carimbos no bloqueio seguem o formato que os robôs leem.
import { pessoaAtiva, paresVivosDe, alvosVivos, metaAlvosDe, comissaoDe, bolaDe, diasDesde, alertasDe } from './logic.js';
const OLX = /^https:\/\/(www\.|sp\.)?olx\.com\.br\//;
const fmtHora = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');
const linkOlx = (u) => (OLX.test(u || '') ? u : null);
const canalMorto = (p) => /morto|sem[_ ]canal/i.test(p.canal || '');
const VALOR = {
  cliente: (l) => l.nome.toLowerCase(), tem: (l) => l.tem || 0, adiciona: (l) => l.adiciona || 0, alvos: (l) => l.alvos,
  resp: (l) => l.respondidos, int: (l) => (l.diasInt ?? 999), comissao: (l) => l.comissao,
};
export function linhasDaTabela(carteiras, { soVips = true, col = null, asc = false } = {}, now = new Date()) {
  const linhas = (carteiras || []).filter((c) => pessoaAtiva(c.pessoa) && (!soVips || (c.pessoa.diferenca_max || 0) > 0)).map((c) => {
    const p = c.pessoa; const vivos = paresVivosDe(c); const respondidos = vivos.filter((x) => x.par.dono_respondeu).length;
    const alvos = alvosVivos(c, now); const meta = metaAlvosDe(p); const diasInt = diasDesde(p.ultima_interacao, now);
    const it = p.interacao;
    return {
      id: p.id, nome: p.nome_exibicao || '', linkOlx: linkOlx(p.link_thread_olx_privado), tem: p.valor_do_que_tem || 0, adiciona: p.diferenca_max || 0,
      alvos, meta, clsAlvos: alvos === 0 ? 'bad' : alvos >= meta ? 'ok' : 'warn', respondidos, mudos: vivos.length - respondidos,
      diasInt, ultimaPalavra: it ? (it.ultima_palavra === 'nos' ? 'nossa' : 'dele(a)') : null,
      dicaInt: it ? `última palavra: ${it.ultima_palavra === 'nos' ? 'nossa' : 'dele(a)'}${it.texto ? ' — ' + it.texto : ''}` : 'campo do site (sem registro na caixa)',
      bola: bolaDe(p.gargalo), comissao: comissaoDe(c, now), canal: p.canal || '', canalMorto: canalMorto(p), problema: !!p.promessa_pendente,
    };
  });
  const f = VALOR[col];
  return f ? linhas.sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * (asc ? 1 : -1)) : linhas.sort((a, b) => b.comissao - a.comissao);
}
const ETAPAS = ['contactado', 'valor', 'fotos', 'aceite', 'visita_ok'];
function negocioDe(ck, par) {
  if (!ck) return null;
  const nC = ck.cliente.size, nD = ck.dono.size; const atras = nC <= nD ? 'cliente' : 'dono'; const n = Math.min(nC, nD);
  const feitos = ck[atras]; const falta = ETAPAS.find((e) => !feitos.has(e)) || null;
  const bola = par.dono_respondeu && falta && ['valor', 'fotos', 'aceite'].includes(falta) && atras === 'dono' ? 'nós (completar a ponta)' : par.dono_respondeu ? 'nós' : 'dono';
  return { n, falta, atras, bola };
}
export function fichaDe(carteira, checklist, now = new Date()) {
  const p = carteira.pessoa; const ck = checklist || new Map();
  // F4.5.8: alvo cujo anúncio foi excluído na OLX (marcado pela auditoria) não é vivo — vai pra lista própria
  const excluidos = (carteira.pares || []).filter((x) => !x.par.descartado_motivo && x.imovel && x.imovel.status_inventario === 'anuncio_excluido').map(({ par }) => ({ parId: par.id, apelido: par.apelido || 'par' }));
  const vivos = (carteira.pares || []).filter((x) => !x.par.descartado_motivo && !(x.imovel && x.imovel.status_inventario === 'anuncio_excluido')).sort((a, b) => (b.par.dono_respondeu ? 1 : 0) - (a.par.dono_respondeu ? 1 : 0));
  const alvos = vivos.map(({ par, imovel }) => {
    const nota = par.notas || par.bloqueio || ''; const dias = diasDesde(par.updated_at, now);
    const estado = par.dono_respondeu ? 'respondeu' : (dias ?? 99) >= 2 ? 'mudo' : 'aguardando';
    const c = ck.get(par.id) || null;
    return {
      parId: par.id, apelido: par.apelido || 'par', linkOlx: linkOlx(imovel && imovel.link_fonte_privado), valor: (imovel && imovel.valor) || null,
      estado, estadoTexto: estado === 'respondeu' ? 'respondeu' : estado === 'mudo' ? `mudo há ${dias}d` : 'aguardando',
      canalResposta: par.dono_respondeu ? (/whats/i.test(nota) ? 'Whats' : /olx|thread|chat da olx/i.test(nota) ? 'OLX' : '') : '',
      dias, telAnunciante: (imovel && imovel.telefone_anunciante) || '', pontas: { cliente: c ? [...c.cliente] : [], dono: c ? [...c.dono] : [] },
      negocio: negocioDe(c, par), historico: (par.bloqueio || '').slice(0, 900),
    };
  });
  const descartados = (carteira.pares || []).filter((x) => x.par.descartado_motivo).map(({ par }) => ({ parId: par.id, apelido: par.apelido || 'par', motivo: par.descartado_motivo }));
  return {
    pessoa: { id: p.id, nome: p.nome_exibicao || '', classificacao: p.classificacao || 'indefinido', tem: p.o_que_tem_texto || '', valorTem: p.valor_do_que_tem || 0, busca: p.o_que_busca || '', adiciona: p.diferenca_max || 0, telefone: p.telefone || p.contato_privado || '', canal: p.canal || '', canalMorto: canalMorto(p), linkOlx: linkOlx(p.link_thread_olx_privado), gargalo: p.gargalo || '', proximoPasso: p.proximo_passo || '', meta: metaAlvosDe(p), alvos: alvosVivos(carteira, now), comissao: comissaoDe(carteira, now) },
    alvos, descartados, excluidos,
  };
}
export function reguasDe(carteira, now = new Date()) {
  return alertasDe([carteira.pessoa], [carteira], now).filter((a) => ['peteca', 'divida', 'dono_mudo', 'canal_risco'].includes(a.tipo)).sort((a, b) => (a.tipo === 'peteca' ? -1 : 0) - (b.tipo === 'peteca' ? -1 : 0));
}
export function conversaOrdenada(r, tz = 'UTC') {
  const tudo = [
    ...((r && r.entrada) || []).map((m) => ({ t: m.criado_em, quem: 'ele(a)', texto: m.texto || '' })),
    ...((r && r.saida) || []).map((m) => ({ t: m.enviado_em || m.criado_em, quem: m.estado === 'enviada' ? 'nós' : 'nós (na fila)', texto: m.texto || '' })),
  ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 4);
  return tudo.map((m) => ({ quando: fmtHora(m.t, tz), quem: m.quem, texto: m.texto.slice(0, 90) }));
}
export function patchDaAcao(acao, texto, atual, hoje) {
  const antes = atual && atual.bloqueio ? ' | ' + atual.bloqueio : '';
  if (acao === 'respondeu') return { dono_respondeu: true, bloqueio: `[RESPONDEU ${hoje} via site] ${texto}${antes}` };
  if (acao === 'escolheu') return { bloqueio: `[CLIENTE ESCOLHEU ${hoje} via site] ${texto}${antes}` };
  if (acao === 'morto') return { descartado_motivo: `${texto} (site, ${hoje})` };
  return { bloqueio: `[NOTA ${hoje} via site] ${texto}${antes}` };
}
export function patchPessoa(c, editando, hoje, agoraIso) {
  const num = (v) => (v === '' || v == null ? null : +v);
  const base = { nome_exibicao: c.nome, classificacao: c.classificacao, o_que_tem_texto: c.o_que_tem_texto, valor_do_que_tem: num(c.valor_do_que_tem), o_que_busca: c.o_que_busca || null, diferenca_max: num(c.diferenca_max), telefone: c.telefone || null, link_thread_olx_privado: c.link || null, atualizado_via: 'site' };
  if (editando) return base;
  return { ...base, estagio: '3-RESPONDEU', gargalo: 'aguardando novo imóvel', proximo_passo: `${hoje}: cadastrado pelo site — qualificar o que faltar e garimpar alvos.`, ultima_interacao: agoraIso };
}
