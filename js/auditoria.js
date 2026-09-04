// Auditoria (entrega 3, spec §3): view-model PURO. Sem DOM. tests/auditoria.test.mjs.
const chave8 = (t) => { const d = String(t ?? '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-8) : null; };
const fmt = (iso, tz) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '') : '—');

// árvore da negociação: o VIP no topo e cada alvo (telefone do anunciante) embaixo
export function arvoreDoVip(carteira) {
  const p = carteira.pessoa || {};
  const telVip = p.telefone || p.contato_privado || null;
  const out = [{ papel: 'VIP', rotulo: p.nome_exibicao || '?', telefone: telVip, chave: chave8(telVip) }];
  for (const { par, imovel } of carteira.pares || []) {
    if (!par || par.descartado_motivo) continue;
    if (imovel && imovel.status_inventario === 'morto') continue;
    const tel = (imovel && imovel.telefone_anunciante) || null;
    out.push({ papel: 'alvo', rotulo: par.apelido || (imovel && imovel.titulo) || 'alvo', telefone: tel, chave: chave8(tel) });
  }
  return out;
}

export function montarAuditoria(arvore, porTelefone = {}, tz = 'UTC') {
  const conversas = arvore.map((n) => {
    if (!n.chave) return { ...n, selo: 'sem_telefone', motivos: ['sem telefone na ficha'], linhas: [] };
    const a = (porTelefone[n.chave] || {}).auditoria;
    if (!a) return { ...n, selo: 'nao_varrida', motivos: ['sem dados na caixa/recibo'], linhas: [] };
    return { ...n, selo: a.selo, motivos: a.motivos || [], linhas: (a.linhas || []).map((l) => ({ ...l, hora_canal: fmt(l.hora_canal, tz), hora_registro: fmt(l.hora_registro, tz) })) };
  });
  const c = (s) => conversas.filter((x) => x.selo === s).length;
  return { resumo: { total: conversas.length, auditadas: c('auditada'), divergentes: c('divergente'), nao_varridas: c('nao_varrida'), sem_telefone: c('sem_telefone') }, conversas };
}

// check-in por amostragem: n chaves aleatórias (Fisher–Yates com aleatório injetável)
export function amostra(chaves, n, aleatorio = Math.random) {
  const a = [...new Set(chaves.filter(Boolean))];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(aleatorio() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
