// Lógica pura do Radar — sem DOM, sem rede. Testada em tests/logic.test.mjs.
// Réguas e mapa de bola vêm do playbook (repo radar-permutas, spec 2026-08-26).

const DIA_MS = 24 * 60 * 60 * 1000;

// Escape pra HTML E atributos (C1, revisão 03/09): a versão antiga via DOM não
// escapava aspas — texto de chat de lead dentro de title="..." quebrava/injetava.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function diasDesde(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DIA_MS);
}

function horasDesde(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 36e5;
}

export function parVivo(par, imovel) {
  if (!par) return false;
  if (par.descartado_motivo) return false;
  const txt = `${par.apelido || ''} ${par.bloqueio || ''}`;
  if (txt.includes('[DUPLICADO]')) return false;
  if (imovel && imovel.status_inventario === 'morto') return false;
  return true;
}

// Mapa gargalo → dono da bola (máquina de estados do playbook).
export function bolaDe(gargalo) {
  const g = (gargalo || '').toLowerCase();
  if (!g) return 'indefinida';
  if (g.startsWith('esperando cliente')) return 'cliente';
  if (g.startsWith('aguardando novo im')) return 'nós';
  if (g.startsWith('aguardando infos')) return 'nós';
  if (g.startsWith('dívida') || g.startsWith('divida')) return 'nós';
  if (g.startsWith('ivan')) return 'Ivan';
  return 'indefinida';
}

export function paresVivosDe(carteira) {
  return (carteira.pares || []).filter((x) => parVivo(x.par, x.imovel));
}

// Alvo VIVO para contagem/regua dos 3: par vivo E (dono respondeu OU mexido <96h).
// Par parado ha 96h+ sem resposta esta morto pela regua, mesmo sem descarte manual.
export function alvoVivo(par, imovel, now = new Date()) {
  if (!parVivo(par, imovel)) return false;
  if (par.dono_respondeu) return true;
  const t = par.updated_at ? new Date(par.updated_at).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  return (now.getTime() - t) / 36e5 < 96;
}

export function alvosVivosDe(carteira, now = new Date()) {
  return (carteira.pares || []).filter((x) => alvoVivo(x.par, x.imovel, now));
}

export function alvosVivos(carteira, now = new Date()) {
  return alvosVivosDe(carteira, now).length;
}

// Régua de alvos por VIP: padrão 3, configurável na ficha com a tag
// "meta_alvos: N" (em criterios ou o_que_busca). Decisão do Ivan, 27/08.
export function metaAlvosDe(pessoa) {
  const txt = `${(pessoa && pessoa.criterios) || ''} ${(pessoa && pessoa.o_que_busca) || ''}`;
  const m = txt.match(/meta[_ ]alvos\s*[:=]\s*(\d{1,2})/i);
  return m ? Math.max(1, parseInt(m[1], 10)) : 3;
}

export function comissaoDe(carteira, now = new Date()) {
  const vivos = alvosVivosDe(carteira, now);
  const valores = vivos.map((x) => (x.imovel && x.imovel.valor) || 0).filter((v) => v > 0);
  const base = valores.length ? Math.max(...valores) : (carteira.pessoa.valor_do_que_tem || 0);
  return Math.round(base * 0.06);
}

const ESTAGIO_ATIVO = /^[2-6]/;

export function pessoaAtiva(pessoa) {
  return ESTAGIO_ATIVO.test(pessoa.estagio || '');
}

// Réguas — sempre sobre campos com data automática, nunca sobre texto livre.
export function alertasDe(pessoas, carteiras, now = new Date()) {
  const alertas = [];
  const porPessoa = new Map(carteiras.map((c) => [c.pessoa.id, c]));
  for (const p of pessoas) {
    if (!pessoaAtiva(p)) continue;
    if (p.promessa_pendente) {
      alertas.push({ tipo: 'divida', pessoaId: p.id, msg: `Dívida nossa com ${p.nome_exibicao}` });
    }
    const hCliente = horasDesde(p.ultima_interacao, now);
    if (hCliente !== null && hCliente >= 48) {
      alertas.push({ tipo: 'cliente_parado', pessoaId: p.id, msg: `${p.nome_exibicao} sem interação há ${Math.floor(hCliente / 24)}d` });
    }
    const estagioNum = parseInt(p.estagio, 10);
    if (estagioNum >= 4 && !p.telefone && !p.contato_privado) {
      alertas.push({ tipo: 'canal_risco', pessoaId: p.id, msg: `${p.nome_exibicao} em negociação SEM telefone reserva` });
    }
    const carteira = porPessoa.get(p.id);
    if (carteira) {
      for (const { par, imovel } of paresVivosDe(carteira)) {
        const h = horasDesde(par.updated_at, now);
        if (!par.dono_respondeu && h !== null && h >= 48) {
          alertas.push({ tipo: 'dono_mudo', pessoaId: p.id, parId: par.id, msg: `Dono mudo há ${Math.floor(h / 24)}d: ${par.apelido || 'par'}` });
        }
        // PETECA (Ivan, 27/08): dono RESPONDEU e nós paramos >24h — pior vazamento do funil.
        if (par.dono_respondeu && h !== null && h >= 24) {
          alertas.push({ tipo: 'peteca', pessoaId: p.id, parId: par.id, msg: `🏐 PETECA NO CHÃO: ${par.apelido || 'par'} respondeu e está sem nosso retorno há ${Math.floor(h / 24)}d` });
        }
      }
    }
  }
  return alertas;
}

export function filaDoDia(carteiras) {
  return carteiras
    .filter((c) => pessoaAtiva(c.pessoa))
    .map((c) => ({
      pessoa: c.pessoa,
      comissao: comissaoDe(c),
      bola: bolaDe(c.pessoa.gargalo),
      alvos: alvosVivos(c),
      respondidos: alvosVivosDe(c).filter((x) => x.par.dono_respondeu).length,
    }))
    .sort((a, b) => b.comissao - a.comissao);
}
