// PR 7 (F5.2, C22): registrarNoPar tem que ser otimista — se um robô gravou
// o bloqueio entre o read e o update, NÃO pode engolir a nota dele.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarNoPar } from '../js/registro.js';

// sb falso: 'par' com bloqueio que MUDA por baixo entre a leitura e a escrita
function sbFalso({ mudaNoMeio }) {
  const linha = { id: 'p1', bloqueio: 'nota A', dono_respondeu: false, descartado_motivo: null };
  const chamadas = [];
  const q = (tabela) => {
    const st = { filtros: [] };
    const b = {
      select: () => b, single: () => { st.single = true; return b; },
      eq: (c, v) => { st.filtros.push([c, v]); return b; },
      is: (c, v) => { st.filtros.push([c, v]); return b; },
      update: (patch) => { st.patch = patch; return b; },
      then: (res) => {
        if (st.patch) {
          chamadas.push({ filtros: st.filtros, patch: st.patch });
          const bate = st.filtros.every(([c, v]) => linha[c] === v);
          if (bate) Object.assign(linha, st.patch);
          return res({ data: bate ? [{ ...linha }] : [], error: null });
        }
        const foto = { ...linha };
        if (mudaNoMeio && chamadas.length === 0) linha.bloqueio = 'nota B (robô)';
        return res({ data: st.single ? foto : [foto], error: null });
      },
    };
    return b;
  };
  return { from: q, linha, chamadas };
}

test('sem concorrência: grava em cima do bloqueio lido', async () => {
  const sb = sbFalso({ mudaNoMeio: false });
  await registrarNoPar('p1', (a) => ({ bloqueio: a.bloqueio + ' | nota C' }), sb);
  assert.equal(sb.linha.bloqueio, 'nota A | nota C');
});
test('C22: robô gravou no meio → relê e preserva a nota do robô (nunca engole)', async () => {
  const sb = sbFalso({ mudaNoMeio: true });
  await registrarNoPar('p1', (a) => ({ bloqueio: a.bloqueio + ' | nota C' }), sb);
  assert.equal(sb.linha.bloqueio, 'nota B (robô) | nota C');
  assert.ok(sb.chamadas.length >= 2, 'precisa ter tentado de novo');
});
