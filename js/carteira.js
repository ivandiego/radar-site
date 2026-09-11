// Montagem da carteira (pessoa → pares → imóvel do par) — função PURA,
// extraída do api.js (F6, revisão 03/09) pra ter teste: tests/carteira.test.mjs.
export function montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis) {
  const imovelPorId = new Map((imoveis || []).map((i) => [i.id, i]));
  const imovelDoPar = new Map();
  for (const l of ladosDosPares || []) if (!imovelDoPar.has(l.par_id)) imovelDoPar.set(l.par_id, imovelPorId.get(l.imovel_id) || null);
  const parPorId = new Map((pares || []).map((p) => [p.id, p]));
  const paresDaPessoa = new Map();
  for (const l of lados || []) {
    if (!l.pessoa_id || !parPorId.has(l.par_id)) continue;
    if (!paresDaPessoa.has(l.pessoa_id)) paresDaPessoa.set(l.pessoa_id, new Map());
    paresDaPessoa.get(l.pessoa_id).set(l.par_id, { par: parPorId.get(l.par_id), imovel: imovelDoPar.get(l.par_id) || null });
  }
  return (pessoas || []).map((pessoa) => ({ pessoa, pares: [...(paresDaPessoa.get(pessoa.id) || new Map()).values()] }));
}

// F4.20 (spec §2 item 7): no Responder, o Ivan escolhe quais mensagens da pessoa a resposta cobre. Os ids escolhidos
// vão em responde_ids: a caixa vira em_rascunho e, no envio, respondida. Nenhuma escolhida = não mexe na caixa.
const fmtCurto = (iso, tz) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).replace(',', '');
export function perguntaDasMensagens(msgs, tz = 'America/Sao_Paulo') {
  return 'Quais mensagens dela(e) este texto responde? (números separados por vírgula, "todas" ou "nenhuma")\n'
    + msgs.map((m, i) => `${i + 1}) ${fmtCurto(m.criado_em, tz)} “${String(m.texto || '').slice(0, 80)}”`).join('\n');
}
export function idsDaEscolha(msgs, resposta) {
  if (resposta === null || resposta === undefined) return null;
  const r = String(resposta).trim().toLowerCase();
  if (r === '' || r === 'nenhuma') return { ok: true, ids: [] };
  if (r === 'todas') return { ok: true, ids: msgs.map((m) => m.id) };
  const nums = r.split(/[\s,;]+/).filter(Boolean);
  if (nums.some((n) => !/^\d+$/.test(n) || Number(n) < 1 || Number(n) > msgs.length)) return { ok: false, erro: `escolha inválida: "${resposta}" (use 1 a ${msgs.length}, "todas" ou "nenhuma")` };
  return { ok: true, ids: [...new Set(nums.map((n) => msgs[Number(n) - 1].id))] };
}
