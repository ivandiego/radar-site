// Registro no par — lógica pura, sem supabase importado (testável em node:
// tests/api.test.mjs). O cliente entra por parâmetro.
function lanca(r) {
  if (r.error) throw r.error;
  return r.data;
}

// C22 (revisão 03/09): read→update sem verificação otimista tinha lost update —
// robô gravando no mesmo par entre a leitura e a escrita tinha a nota engolida,
// exatamente o que a função jurava evitar. Agora o update só vale se o
// bloqueio ainda é o que foi lido; senão relê e tenta de novo (3x).
export async function registrarNoPar(parId, monta, cliente, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    const atual = lanca(await cliente.from('par').select('id,bloqueio,dono_respondeu,descartado_motivo').eq('id', parId).single());
    const patch = monta(atual);
    patch.atualizado_via = 'site';
    let q = cliente.from('par').update(patch).eq('id', parId);
    q = atual.bloqueio == null ? q.is('bloqueio', null) : q.eq('bloqueio', atual.bloqueio);
    const data = lanca(await q.select());
    if (data && data.length) return data;
  }
  throw new Error('o par mudou por baixo 3 vezes seguidas — recarregue e tente de novo');
}
