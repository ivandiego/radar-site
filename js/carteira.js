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
