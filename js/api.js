import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, PUBLISHABLE_KEY } from './config.js';

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
  const imoveis = imvIds.length ? lanca(await sb.from('imovel').select('id,olx_id,titulo,bairro,cidade,valor,status_inventario,link_fonte_privado').in('id', imvIds)) : [];

  const imovelPorId = new Map(imoveis.map((i) => [i.id, i]));
  const imovelDoPar = new Map();
  for (const l of ladosDosPares) if (!imovelDoPar.has(l.par_id)) imovelDoPar.set(l.par_id, imovelPorId.get(l.imovel_id) || null);
  const parPorId = new Map(pares.map((p) => [p.id, p]));
  const paresDaPessoa = new Map();
  for (const l of lados) {
    if (!l.pessoa_id || !parPorId.has(l.par_id)) continue;
    if (!paresDaPessoa.has(l.pessoa_id)) paresDaPessoa.set(l.pessoa_id, new Map());
    paresDaPessoa.get(l.pessoa_id).set(l.par_id, { par: parPorId.get(l.par_id), imovel: imovelDoPar.get(l.par_id) || null });
  }
  return pessoas.map((pessoa) => ({ pessoa, pares: [...(paresDaPessoa.get(pessoa.id) || new Map()).values()] }));
}

// Registro rápido: sempre por id, sempre lendo o bloqueio atual antes de
// escrever (nunca sobrescrever texto que não foi lido), sempre atualizado_via.
export async function registrarNoPar(parId, monta) {
  const atual = lanca(await sb.from('par').select('id,bloqueio,dono_respondeu,descartado_motivo').eq('id', parId).single());
  const patch = monta(atual);
  patch.atualizado_via = 'site';
  return lanca(await sb.from('par').update(patch).eq('id', parId).select());
}
