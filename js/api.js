import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, PUBLISHABLE_KEY, FUNCTIONS_URL } from './config.js?v=1788618296';
import { registrarNoPar as registrarNoParCom } from './registro.js?v=1788618296';
import { montarCarteira } from './carteira.js?v=1788618296';

export const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

export async function sessao() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function login(email, senha) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data.session;
}

export async function logout() {
  await sb.auth.signOut();
}

function lanca(r) {
  if (r.error) throw r.error;
  return r.data;
}

// Carteira completa: pessoas ativas + seus pares + imóvel de cada par.
export async function fetchCarteira() {
  const pessoas = lanca(await sb.from('pessoa').select('*')
    .in('estagio', ['2-CONTATADO', '3-RESPONDEU', '4-PERFIL-COLETADO', '5-NEGOCIACAO', '6-VISITA']));
  const ids = pessoas.map((p) => p.id);
  const lados = ids.length ? lanca(await sb.from('par_lado').select('par_id,pessoa_id,imovel_id').or(
    `pessoa_id.in.(${ids.join(',')})`)) : [];
  const parIds = [...new Set(lados.filter((l) => l.pessoa_id).map((l) => l.par_id))];
  const pares = parIds.length ? lanca(await sb.from('par').select('*').in('id', parIds)) : [];
  const ladosDosPares = parIds.length ? lanca(await sb.from('par_lado').select('par_id,imovel_id').in('par_id', parIds).not('imovel_id', 'is', null)) : [];
  const imvIds = [...new Set(ladosDosPares.map((l) => l.imovel_id))];
  const imoveis = imvIds.length ? lanca(await sb.from('imovel').select('id,olx_id,titulo,bairro,cidade,valor,status_inventario,link_fonte_privado,telefone_anunciante').in('id', imvIds)) : [];

  return montarCarteira(pessoas, lados, pares, ladosDosPares, imoveis); // F6: pura, testada
}

// Registro rápido: sempre por id, lendo o bloqueio atual antes de escrever e
// com verificação otimista (C22) — lógica pura em registro.js, testada.
export function registrarNoPar(parId, monta, cliente = sb) {
  return registrarNoParCom(parId, monta, cliente);
}

// Fila de envio (mora no projeto irmão; auth = login do Radar)
export async function fila(acao, payload = {}) {
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('sessão expirada');
  const r = await fetch(`${FUNCTIONS_URL}/fila`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token },
    body: JSON.stringify({ acao, ...payload }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) throw new Error(d.erro || 'fila indisponível (' + r.status + ')');
  return d;
}
