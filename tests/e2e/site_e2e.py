#!/usr/bin/env python3
# E2E REAL do painel (PR 3 da revisão F5.2, lição SCRUM-220 do picoclaw):
# integração HTTP/unit não pega SyntaxError JS, CSS quebrado nem evento não
# bound. Este teste abre o site num Chromium headless de verdade, com o
# supabase-js STUBADO no nível do módulo (esm.sh interceptado) e a edge
# function /fila respondida com fixtures — rede externa zero.
#
# Cobre: boot com sessão → painel; tabela VIPs renderiza; aba Hoje; fila de
# envio com pendente; clique no ✔ dispara acao=aprovar; zero pageerror.
import json
import threading
import functools
import http.server
import sys
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]

FIX = {
    "pessoa": [{
        "id": "m1", "nome_exibicao": "Mesach — casa Suzano", "estagio": "3-RESPONDEU",
        "classificacao": "vip", "valor_do_que_tem": 350000, "diferenca_max": 100000,
        "gargalo": "esperando cliente ver fotos", "ultima_interacao": None,
        "criterios": "", "o_que_busca": "casa maior", "promessa_pendente": False,
    }],
    "par_lado": [
        {"par_id": "p1", "pessoa_id": "m1", "imovel_id": None},
        {"par_id": "p1", "pessoa_id": None, "imovel_id": "i1"},
    ],
    "par": [{
        "id": "p1", "apelido": "casa Boa Vista 500", "dono_respondeu": True,
        "updated_at": "2100-01-01T00:00:00Z", "bloqueio": "", "descartado_motivo": None,
    }],
    "imovel": [{
        "id": "i1", "olx_id": "111", "titulo": "Casa Boa Vista", "bairro": "Boa Vista",
        "cidade": "Suzano", "valor": 500000, "status_inventario": "ativo",
        "link_fonte_privado": None, "telefone_anunciante": None,
    }],
}

STUB_SUPABASE = """
const FIX = %s;
function builder(tabela) {
  const b = { _rows: (FIX[tabela] || []).slice(), _single: false };
  for (const m of ['select','in','or','not','eq','is','order','limit','update','insert','upsert','delete'])
    b[m] = () => b;
  b.single = () => { b._single = true; return b; };
  b.then = (res) => res({ data: b._single ? (b._rows[0] || null) : b._rows, error: null });
  return b;
}
export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-e2e', user: { email: 'e2e@welici' } } } }),
      signInWithPassword: async () => ({ data: { session: {} }, error: null }),
      signOut: async () => ({}),
    },
    from: builder,
  };
}
""" % json.dumps(FIX)

FILA = {
    "listar": {"itens": [{
        "id": "f1", "canal": "whatsapp", "destino": "5513999990001",
        "destino_rotulo": "Dona da Boa Vista", "texto": "Oi! Consigo te mandar as fotos hoje.",
        "estado": "pendente_aprovacao", "criado_em": "2026-09-03T10:00:00Z",
    }]},
    "inbox_listar": {"itens": []},
    "agenda_listar": {"itens": []},
    "violacao_listar": {"itens": []},
    "garimpo_listar": {"itens": []},
    "saude": {"heartbeats": [{"chave": "carteiro", "atualizado_em": "2100-01-01T00:00:00Z", "detalhe": "ok"}], "ordens_abertas": []},
    "aprovar": {"item": {"id": "f1", "estado": "aprovada"}},
}


def main():
    from playwright.sync_api import sync_playwright

    Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(RAIZ))
    Handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"

    erros, acoes_fila = [], []
    with sync_playwright() as pw:
        page = pw.chromium.launch().new_page()
        page.on("pageerror", lambda e: erros.append(f"pageerror: {e}"))
        page.on("console", lambda m: m.type == "error" and "net::" not in m.text and erros.append(f"console: {m.text}"))

        page.route("**://esm.sh/**", lambda r: r.fulfill(content_type="application/javascript", body=STUB_SUPABASE))
        page.route("**://fonts.g**", lambda r: r.abort())

        def fila_stub(route):
            acao = json.loads(route.request.post_data or "{}").get("acao")
            acoes_fila.append(acao)
            route.fulfill(content_type="application/json", body=json.dumps(FILA.get(acao, {"itens": []})))
        page.route("**/functions/v1/fila", fila_stub)

        page.goto(base + "/index.html")
        page.wait_for_selector("#painel:not([hidden])", timeout=8000)

        ok = lambda cond, msg: print(f"ok {msg}") if cond else (erros.append(f"ASSERT: {msg}"), print(f"FALHA {msg}"))

        ok(page.is_hidden("#login"), "sessao fake pula o login")
        page.wait_for_selector("#tabela-vips tr.vip-row", timeout=5000)
        ok("Mesach" in page.inner_text("#tabela-vips"), "tabela VIPs renderiza a pessoa")
        ok("1/3" in page.inner_text("#tabela-vips"), "chip de alvos calculado (1/3)")
        ok("Carteiro" in page.inner_text("#saude"), "painel de saude renderiza heartbeat")

        page.click('#abas button[data-aba="hoje"]')
        page.wait_for_selector("#fila-envio:not([hidden])")
        ok("Dona da Boa Vista" in page.inner_text("#fila-envio-lista"), "fila de envio mostra o pendente")
        ok("1" == page.inner_text("#badge-hoje").strip(), "badge Hoje conta o pendente")

        page.click('#fila-envio-lista button[data-f="aprovar"]')
        page.wait_for_timeout(600)
        ok("aprovar" in acoes_fila, "clique no ✔ dispara acao=aprovar na edge fn")

        page.click('#abas button[data-aba="vips"]')
        page.click("#tabela-vips tr.vip-row")
        page.wait_for_timeout(300)
        ok("casa Boa Vista 500" in page.inner_text("#tabela-vips"), "gaveta abre com o alvo do par")

        # fix 03/09: ação que GRAVA no par (registrarNoPar → registro.js). Um import
        # esquecido no api.js virou ReferenceError em produção e nenhum gate viu:
        # node --check não pega identificador indefinido, e o E2E só lia.
        page.once("dialog", lambda d: d.accept("nota de teste e2e"))
        page.click('#tabela-vips button[data-acao="nota"]')
        page.wait_for_timeout(800)
        ok(page.inner_text("#toast").strip() == "Registrado ✔",
           f"botão Nota grava no par (toast={page.inner_text('#toast').strip()!r})")

    srv.shutdown()
    if erros:
        print("\nE2E VERMELHO ❌")
        for e in erros:
            print(" -", e)
        sys.exit(1)
    print(f"\nE2E VERDE ✅ (fila chamada: {sorted(set(a for a in acoes_fila if a))})")


if __name__ == "__main__":
    main()
