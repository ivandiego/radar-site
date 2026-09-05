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
        "criterios": "", "o_que_busca": "casa maior", "promessa_pendente": False, "telefone": "(11) 94956-4957",
    }, {
        "id": "v2", "nome_exibicao": "Vip Mudo", "estagio": "3-RESPONDEU", "classificacao": "vip", "valor_do_que_tem": 300000,
        "diferenca_max": 50000, "ultima_interacao": "2026-08-01T00:00:00Z", "criterios": "", "telefone": None, "promessa_pendente": False, "gargalo": "",
    }],
    "par_lado": [
        {"par_id": "p1", "pessoa_id": "m1", "imovel_id": None},
        {"par_id": "p1", "pessoa_id": None, "imovel_id": "i1"},
    ],
    "par": [{
        "id": "p1", "apelido": "casa Boa Vista 500", "dono_respondeu": True,
        "updated_at": "2026-09-01T00:00:00Z", "bloqueio": "", "descartado_motivo": None,
    }],
    "imovel": [{
        "id": "i1", "olx_id": "111", "titulo": "Casa Boa Vista", "bairro": "Boa Vista",
        "cidade": "Suzano", "valor": 500000, "status_inventario": "ativo",
        "link_fonte_privado": None, "telefone_anunciante": "(13) 99999-0001",
    }],
}

STUB_SUPABASE = """
const FIX = %s;
function builder(tabela) {
  const b = { _rows: (FIX[tabela] || []).slice(), _single: false };
  for (const m of ['select','in','or','not','eq','is','order','limit','update','insert','upsert','delete'])
    b[m] = () => b;
  b.update = (patch) => { globalThis.__ultimoPatch = patch; return b; };
  // .not(col,'is',null) filtra de verdade: sem isso o par pega o lado sem imóvel (stub mentia)
  b.not = (c, op, v) => { if (op === 'is' && v === null) b._rows = b._rows.filter((r) => r[c] != null); return b; };
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
    "checklist_listar": {"itens": [{"par_id": "p1", "lado": "cliente", "etapa": "contactado"}, {"par_id": "p1", "lado": "dono", "etapa": "contactado"}]},
    "conversa_recente": {"entrada": [{"criado_em": "2026-09-03T12:28:00Z", "remetente": "Mesach", "texto": "Posso te ligar?"}], "saida": []},
    "recepcao_listar": {"chegadas": [{"id": "m1", "canal": "whatsapp", "remetente": "Mesach", "destino": "5511949564957", "texto": "Posso te ligar?", "hora_olx": "09:27, 9/3/2026", "criado_em": "2026-09-03T12:28:00Z", "estado": "nova"}], "enviadas": [], "ordens": []},
    "varredura_criar": {"item": {"id": "v1", "estado": "pendente"}},
    "inbox_marcar": {"item": {"id": "m1", "estado": "ignorada"}},
    "cobranca_listar": {"agenda": [{"id": "c2", "rotulo": "Paula", "o_que": "retornar com a proposta", "prazo": "2026-09-03T15:00:00Z", "quem_deve": "nos", "destino": "1401234567"}, {"id": "c1", "rotulo": "Mesach", "o_que": "mandar as fotos", "prazo": "2100-01-01T15:00:00Z", "quem_deve": "deles", "destino": "5511949564957"}], "diario": []},
    "agenda_cumprir": {"item": {"id": "c2"}},
    "agenda_renegociar": {"item": {"id": "c9"}},
    "agenda_lembrar": {"item": {"id": "f9", "estado": "aprovada"}},
    "agenda_listar": {"itens": []},
    "violacao_listar": {"itens": []},
    "auditoria_listar": {"rodada_em": "2026-09-05T09:00:00Z", "rodada": "R1", "agentes": {"leitor": {"atualizado_em": "2026-09-05T09:00:00Z", "detalhe": {"pedidos": 58, "lidos": 49, "pulados": 9, "rodada": "R1"}}, "confrontador": {"atualizado_em": "2026-09-05T09:05:00Z", "detalhe": {"total": 2, "vermelhos": 1, "amarelos": 0, "verdes": 1, "rodada": "R1"}}}, "resumo": {"total": 2, "vermelhos": 1, "amarelos": 0, "verdes": 1}, "vips": [
        {"pessoa_id": "m1", "nome": "Mateus", "veredito": "vermelho", "motivos": [{"codigo": "alvo_excluido_marcado_disponivel", "texto": "anúncio 1523198681 excluído na OLX, site marca disponivel", "gravidade": "vermelho"}], "alvos": [{"estado": {"estado_real": "excluido"}}], "evidencias": [], "canal_ultima": "dele(a) 2026-09-02T11:49: Bom dia, tudo bem"},
        {"pessoa_id": "b1", "nome": "Bio", "veredito": "verde", "motivos": [], "alvos": [], "evidencias": []}]},
    "fiscalizacao_listar": {"abertas": [{"id": "v1", "tipo": "ignorada_suspeita", "gravidade": "alta", "referencia": "mensagem_recebida:m1", "descricao": "Mesach: Posso te ligar?", "criado_em": "2026-09-04T09:00:00Z"}], "resolvidas": []},
    "violacao_resolver": {"item": {"id": "v1"}},
    "garimpo_listar": {"itens": [{"id": "g1", "estado": "pendente", "pessoa_nome": "Mesach", "meta": 3, "criado_em": "2026-09-04T11:00:00Z"}]},
    "garimpo_criar": {"item": {"id": "g9"}},
    "garimpo_marcar": {"item": {"id": "g1", "estado": "cancelada"}},
    "saude": {"heartbeats": [{"chave": "carteiro", "atualizado_em": "2100-01-01T00:00:00Z", "detalhe": "ok"}], "ordens_abertas": []},
    "aprovar": {"item": {"id": "f1", "estado": "aprovada"}},
    "painel": {"setores": {
        "recepcao": {"ultima_rodada": "2026-09-03T22:00:00Z", "fez": [{"tipo": "chat_lido", "n": 37}], "travado": ["WhatsApp deslogado (QR) desde 21:59"]},
        "redacao": {"ultima_rodada": "2026-09-03T22:02:00Z", "fez": [{"tipo": "rascunho_decisao", "n": 6}], "travado": []},
        "expedicao": {"ultima_rodada": None, "fez": [], "travado": []}, "cobranca": {"ultima_rodada": None, "fez": [], "travado": []},
        "garimpo": {"ultima_rodada": None, "fez": [], "travado": []}, "fiscalizacao": {"ultima_rodada": None, "fez": [], "travado": []}},
        "nao_acontecendo": [{"tipo": "cliente_sem_resposta", "texto": "Nani sem resposta há 3h", "setor": "redacao", "ref": "mensagem_recebida:r1"}],
        "alarmes": [{"id": "a1", "setor": "recepcao", "hora": "2026-09-04T01:00:00Z", "texto": "lacuna: possível perda no chat da Lilis", "prova_ref": "chat_varrido:5513997101500", "motivo": "lacuna"}]},
    "alarme_resolver": {"item": {"id": "a1"}},
    "redacao_listar": {"grupos": [{"destino": "5513988444944", "rotulo": "EWS", "canal": "whatsapp",
        "recebida": {"texto": "Ivan, o apartamento no Ipiranga é uma excelente opção", "hora": "2026-09-02T11:08:00Z"},
        "rascunhos": [{"id": "f1", "texto": "Bom dia. Passando pra ser honesto…", "criado_em": "2026-09-03T14:11:00Z", "origem": "operador_relogios", "estado": "pendente_aprovacao", "duplicado_de": None},
                      {"id": "f2", "texto": "Bom dia. Passando pra ser honesto…", "criado_em": "2026-09-03T14:19:00Z", "origem": "operador_relogios", "estado": "pendente_aprovacao", "duplicado_de": "f1"}]}]},
    "aprovar_editado": {"item": {"id": "f1", "estado": "aprovada"}},
    "rejeitar": {"item": {"id": "f2", "estado": "rejeitada"}},
    "expedicao_listar": {"enviadas": [{"id": "e1", "destino_rotulo": "Vitor", "canal": "whatsapp", "texto": "Boa noite Vitor", "enviado_em": "2026-09-01T22:58:00Z", "prova_envio": "whats 22:58 trecho"}],
                         "falhas": [{"id": "x1", "destino": "5513981780293", "destino_rotulo": "Maracanã", "canal": "whatsapp", "texto": "Oi, Ivan…", "erro": "WhatsApp Web nao reconhece", "criado_em": "2026-09-02T23:00:00Z"}]},
    "tentar_de_novo": {"item": {"id": "x1", "estado": "aprovada"}},
    "auditoria_vip": {"por_telefone": {
        "49564957": {"auditoria": {"selo": "auditada", "motivos": [], "linhas": [
            {"quem": "ele(a)", "texto": "Posso te ligar?", "hora_canal": "2026-09-02T22:29:00.000Z", "hora_registro": "2026-09-02T22:30:00Z", "prova": "mensagem_recebida:r1", "ok": True, "motivo": None}]}},
        "99990001": {"auditoria": {"selo": "divergente", "motivos": ["lacuna: possível perda…"], "linhas": []}}}},
    "conferir_vip": {"item": {"id": "o1", "estado": "pendente"}},
    "mandei_eu_mesmo": {"item": {"id": "x1", "estado": "enviada"}},
    "diario_listar": {"itens": [{"setor": "recepcao", "tipo": "chat_lido", "hora": "2026-09-03T22:00:10Z", "quem": "Nani",
                                 "texto": "Nani: dele(a): Bom dia 200 mil", "prova_ref": "chat_varrido:5513997790904"}]},
    "prova": {"tabela": "chat_varrido", "item": {"chave": "5513997790904", "rotulo": "Nani", "ultima_msg_vista": "dele(a): Bom dia 200 mil", "varrido_em": "2026-09-03T22:00:00Z"}},
    # F9: frescura derivada da caixa — Mesach falou "agora" pela caixa, não pelo campo do site
    "interacoes": {"por_telefone": {"49564957": {"ultima_recebida": "2100-01-01T00:00:00Z", "ultima_enviada": None, "ultima_palavra": "deles", "texto": "Posso te ligar?"}}},
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

        page.goto(base + "/index.html#carteira")
        page.wait_for_selector("#painel:not([hidden])", timeout=8000)

        ok = lambda cond, msg: print(f"ok {msg}") if cond else (erros.append(f"ASSERT: {msg}"), print(f"FALHA {msg}"))

        ok(page.is_hidden("#login"), "sessao fake pula o login")
        # Entrega 5: Carteira como setor — tabela limpa
        page.wait_for_selector('#setor table.vips tr.vip-row', timeout=5000)
        ok("Mesach" in page.inner_text('#setor table.vips'), "carteira: tabela renderiza a pessoa")
        ok("1/3" in page.inner_text('#setor table.vips'), "carteira: alvos/meta na tabela")
        ok("Varrer agora" in page.inner_text("header") and "Nova pessoa" in page.inner_text("header"), "entrega 4: cabeçalho com botões em texto")
        ok("interacoes" in acoes_fila and "dele(a)" in page.inner_text('#setor table.vips'), "F9: ultima interacao vem da caixa (interacoes) e mostra a ultima palavra")
        ok(page.locator('#setor .reguas .alerta.peteca').count() >= 1, "carteira: réguas vencidas no topo (peteca do par respondido)")
        ok(page.locator('#carteira-legado').count() == 0 and page.locator('#abas').count() == 0, "entrega 5: legado e aba Hoje saíram")
        page.click('#setor th[data-o="cliente"]')
        page.wait_for_timeout(200)
        ok(("▼" in page.inner_text('#setor th[data-o="cliente"]')) or ("▲" in page.inner_text('#setor th[data-o="cliente"]')), "carteira: ordenação por coluna")
        page.check('#setor input.todos')
        page.wait_for_timeout(200)
        ok("Mesach" in page.inner_text('#setor table.vips'), "carteira: Mostrar todos mantém o VIP")

        # Entrega 5: ficha do VIP — dados, alvos com pontas, ações no par
        page.click('#setor tr.vip-row[data-pessoa="m1"] button.abrir-ficha')
        page.wait_for_selector('#setor .ficha table.alvos tr[data-par="p1"]')
        ok("casa Boa Vista 500" in page.inner_text('#setor .ficha'), "ficha: alvo do par aparece")
        ok("respondeu" in page.inner_text('#setor .ficha table.alvos'), "ficha: estado do alvo")
        ok("checklist_listar" in acoes_fila and "conversa_recente" in acoes_fila, "ficha: busca pontas e conversa recente")
        ok("Posso te ligar?" in page.inner_text('#setor .ficha .conversa-recente'), "ficha: conversa recente da caixa")
        page.once("dialog", lambda d: d.accept("nota de teste e2e"))
        page.click('#setor .ficha tr[data-par="p1"] button[data-acao="nota"]')
        page.wait_for_timeout(800)
        ok(page.inner_text("#toast").strip() == "Registrado ✔", f"ficha: Nota grava no par (toast={page.inner_text('#toast').strip()!r})")
        page.wait_for_selector('#setor .ficha table.alvos tr[data-par="p1"]')
        page.once("dialog", lambda d: d.accept("topo"))
        page.click('#setor .ficha tr[data-par="p1"] button[data-acao="respondeu"]')
        page.wait_for_timeout(800)
        ok(page.inner_text("#toast").strip() == "Registrado ✔", "ficha: Dono respondeu grava no par")
        ok(page.evaluate("globalThis.__ultimoPatch && globalThis.__ultimoPatch.dono_respondeu === true"), "ficha: Dono respondeu marca dono_respondeu no patch")
        page.wait_for_selector('#setor .ficha table.alvos tr[data-par="p1"]')
        page.once("dialog", lambda d: d.accept("vendido"))
        page.click('#setor .ficha tr[data-par="p1"] button[data-acao="morto"]')
        page.wait_for_timeout(800)
        ok(page.inner_text("#toast").strip() == "Registrado ✔" and "descartado_motivo" in str(page.evaluate("Object.keys(globalThis.__ultimoPatch)")), "ficha: Descartar par grava descartado_motivo")
        page.wait_for_selector('#setor .ficha button.garimpar')
        page.once("dialog", lambda d: d.accept())
        page.click('#setor .ficha button.garimpar')
        page.wait_for_timeout(300)
        ok("garimpo_criar" in acoes_fila, "ficha: Garimpar alvos dispara garimpo_criar")
        page.click('#setor .ficha button.editar')
        page.wait_for_timeout(200)
        ok(page.input_value('#novo-form input[name="nome"]').startswith("Mesach"), "ficha: Editar ficha abre o formulário preenchido")
        page.click('#novo-fechar')
        page.click('#novo-cliente')
        page.wait_for_timeout(200)
        ok(page.input_value('#novo-form input[name="nome"]') == "", "cabeçalho: Nova pessoa abre o formulário vazio")
        page.fill('#novo-form input[name="nome"]', 'Teste E2E'); page.fill('#novo-form input[name="o_que_tem_texto"]', 'apto')
        page.click('#novo-salvar')
        page.wait_for_timeout(800)
        ok("Cliente cadastrado" in page.inner_text('#toast'), "cabeçalho: Nova pessoa salva (insert no Supabase stubado)")
        page.click('#setor .ficha a.voltar')
        page.wait_for_selector('#setor table.vips tr.vip-row')

        # Entrega 1: Painel por setores com evidências + Diário com "Abrir prova"
        # Entrega 4: Recepção — faixa comum, o que chegou, Varrer agora, Escanear QR, Ignorar
        page.click('#setores a[href="#recepcao"]')
        page.wait_for_selector('#setor table.chegadas tr[data-mid]')
        ok("Coletor + Ouvidor" in page.inner_text('#setor .faixa-setor'), "recepção: faixa comum com quem trabalha")
        ok("Posso te ligar?" in page.inner_text('#setor') and "03/09 09:27" in page.inner_text('#setor'), "recepção: mensagem com hora do canal")
        page.once("dialog", lambda d: d.accept())
        page.click('#setor button.varrer')
        page.wait_for_timeout(300)
        ok("varredura_criar" in acoes_fila, "recepção: Varrer agora dispara varredura_criar")
        page.click('#setor button.qr')
        page.wait_for_timeout(200)
        ok("chrome-robo" in page.input_value('#ia-texto'), "recepção: Escanear QR mostra a instrução")
        page.click('#ia-fechar')
        page.click('#setor tr[data-mid="m1"] button.ignorar')
        page.wait_for_timeout(300)
        ok("inbox_marcar" in acoes_fila, "recepção: Ignorar dispara inbox_marcar")

        # Entrega 4: Cobrança — promessas nossas/deles, Cumprida, Renegociar, Lembrar agora
        page.click('#setores a[href="#cobranca"]')
        page.wait_for_selector('#setor .promessas.nossas li[data-cid]')
        ok("vencida há" in page.inner_text('#setor .promessas.nossas'), "cobrança: promessa nossa vencida com atraso")
        page.once("dialog", lambda d: d.accept("2026-12-01"))
        page.click('#setor .promessas.nossas li[data-cid="c2"] button.renegociar')
        page.wait_for_timeout(300)
        ok("agenda_renegociar" in acoes_fila, "cobrança: Renegociar pede prazo e dispara agenda_renegociar")
        page.once("dialog", lambda d: d.accept())
        page.click('#setor .promessas.deles li[data-cid="c1"] button.lembrar')
        page.wait_for_timeout(300)
        ok("agenda_lembrar" in acoes_fila, "cobrança: Lembrar agora dispara agenda_lembrar")
        page.click('#setor .promessas.deles li[data-cid="c1"] button.cumprida')
        page.wait_for_timeout(300)
        ok("agenda_cumprir" in acoes_fila, "cobrança: Cumprida dispara agenda_cumprir")

        # Entrega 4: Garimpo — régua de meta, Garimpar alvos, ordens, Cancelar ordem
        page.click('#setores a[href="#garimpo"]')
        page.wait_for_selector('#setor ul.regua li[data-pid]')
        ok("1/3" in page.inner_text('#setor ul.regua'), "garimpo: régua mostra VIP abaixo da meta")
        page.once("dialog", lambda d: d.accept())
        page.click('#setor ul.regua li[data-pid] button.garimpar')
        page.wait_for_timeout(300)
        ok("garimpo_criar" in acoes_fila, "garimpo: Garimpar alvos dispara garimpo_criar")
        page.once("dialog", lambda d: d.accept())
        page.click('#setor ul.ordens li[data-gid="g1"] button.cancelar')
        page.wait_for_timeout(300)
        ok("garimpo_marcar" in acoes_fila, "garimpo: Cancelar ordem dispara garimpo_marcar")

        # Entrega 4: Fiscalização — violação com setor que resolve, Abrir prova, Resolvida
        page.click('#setores a[href="#fiscalizacao"]')
        page.wait_for_selector('#setor li.viol[data-vid="v1"]')
        ok("ignorada suspeita" in page.inner_text('#setor') and 'href="#redacao"' in page.inner_html('#setor'), "fiscalização: violação aponta o setor que resolve")
        # F4.5.9: VIPs hoje — veredito por VIP da auditoria mecânica, vermelho primeiro, motivo escrito, link pra Carteira
        page.wait_for_selector('#setor li.vip-aud.vermelho[data-pessoa="m1"]')
        ok("1 vermelhos" in page.inner_text('#setor .resumo-vips') and "1 verdes" in page.inner_text('#setor .resumo-vips'), "fiscalização: resumo dos VIPs por cor")
        ok("excluído na OLX" in page.inner_text('#setor li.vip-aud.vermelho') and 'href="#carteira/m1"' in page.inner_html('#setor li.vip-aud.vermelho'), "fiscalização: motivo do VIP vermelho e link pra Carteira")
        ok("auditoria_listar" in acoes_fila, "fiscalização: busca a última rodada da auditoria")
        page.click('#setor li.viol[data-vid="v1"] button.resolvida')
        page.wait_for_timeout(300)
        ok("violacao_resolver" in acoes_fila, "fiscalização: Resolvida dispara violacao_resolver")

        # Entrega 3: Auditoria por VIP — árvore, selos, 4 colunas, Conferir agora, Amostra
        page.click('#setores a[href="#auditoria"]')
        page.wait_for_selector('#setor select.vip')
        page.select_option('#setor select.vip', 'm1')
        page.wait_for_selector('#setor .conversa-aud')
        ok("2 conversas" in page.inner_text('#setor .resumo-aud') and "1 auditada" in page.inner_text('#setor .resumo-aud') and "1 divergente" in page.inner_text('#setor .resumo-aud'), "auditoria: resumo com selos")
        ok("02/09 19:29" in page.inner_text('#setor .conversa-aud') or "02/09 22:29" in page.inner_text('#setor .conversa-aud'), "auditoria: hora do canal na linha")
        ok("lacuna" in page.inner_text('#setor'), "auditoria: motivo da divergência escrito")
        page.click('#setor button.conferir')
        page.wait_for_timeout(400)
        ok("conferir_vip" in acoes_fila, "auditoria: Conferir agora dispara conferir_vip")
        page.click('#setor button.amostra')
        page.wait_for_timeout(400)
        ok(acoes_fila.count("conferir_vip") >= 2, "auditoria: Amostra de 5 dispara conferir_vip")
        page.click('#setores a[href="#painel"]')
        page.wait_for_selector('#setor .cartao-setor')
        ok("Vip Mudo" in page.inner_text('#setor .nao-acontecendo') and 'href="#carteira/v2"' in page.inner_html('#setor .nao-acontecendo'), "painel: VIP mudo 5+ dias com link pra ficha")
        ok(page.locator('#setor .cartao-setor').count() == 6, "painel: 6 cartões, um por setor")
        ok("37 chats lidos" in page.inner_text('#setor'), "painel: 'fez' em português")
        ok("WhatsApp deslogado" in page.inner_text('#setor'), "painel: travado aparece no cartão")
        ok("Nani sem resposta" in page.inner_text('#setor'), "painel: 'não está acontecendo' listado")
        ok("Alarmes abertos (1)" in page.inner_text('#setor') and "possível perda" in page.inner_text('#setor'), "painel: alarme aberto em destaque")
        page.click('#setor .alarmes button.resolver')
        page.wait_for_timeout(500)
        ok("alarme_resolver" in acoes_fila, "painel: Resolvido dispara alarme_resolver")

        # Entrega 2: Redação (contexto + Aprovar/Editar e aprovar/Rejeitar) e Expedição
        page.click('#setores a[href="#redacao"]')
        page.wait_for_selector('#setor .grupo-redacao')
        ok("apartamento no Ipiranga" in page.inner_text('#setor'), "redação: mostra o que o cliente disse")
        ok("rascunhos iguais" in page.inner_text('#setor'), "redação: aviso de duplicata")
        page.click('#setor .grupo-redacao li[data-fid="f1"] button.editar')
        page.fill('#setor .grupo-redacao li[data-fid="f1"] textarea', 'Bom dia EWS, texto editado pelo dono')
        page.click('#setor .grupo-redacao li[data-fid="f1"] button.aprovar-editado')
        page.wait_for_timeout(400)
        ok("aprovar_editado" in acoes_fila, "redação: Editar e aprovar dispara aprovar_editado")
        page.once("dialog", lambda d: d.accept("duplicado"))
        page.click('#setor .grupo-redacao li[data-fid="f2"] button.rejeitar')
        page.wait_for_timeout(400)
        ok("rejeitar" in acoes_fila, "redação: Rejeitar pede motivo e dispara rejeitar")
        page.click('#setores a[href="#expedicao"]')
        page.wait_for_selector('#setor .falhas li')
        ok("whats 22:58 trecho" in page.inner_text('#setor') and "nao reconhece" in page.inner_text('#setor'), "expedição: prova da enviada e erro da falha")
        page.click('#setor .falhas li button.tentar')
        page.wait_for_timeout(300)
        ok("tentar_de_novo" in acoes_fila, "expedição: Tentar de novo")
        page.click('#setores a[href="#painel"]')
        page.wait_for_selector('#setor .cartao-setor')
        page.click('#setor .cartao-setor[data-setor="recepcao"] a.ver-diario')
        page.wait_for_selector('#setor table.diario tr.linha')
        ok("Bom dia 200 mil" in page.inner_text('#setor table.diario'), "diário: texto real da ação")
        page.click('#setor table.diario tr.linha button.abrir-prova')
        page.wait_for_timeout(400)
        ok("prova" in acoes_fila and "varrido" in page.inner_text('#ia-dialog').lower(), "diário: Abrir prova busca a prova e mostra no diálogo")
        page.click('#ia-fechar')
        page.click('#setores a[href="#carteira"]')
        page.wait_for_selector('#setor table.vips tr.vip-row')
        ok("Mesach" in page.inner_text('#setor table.vips'), "carteira: voltar do diário reabre a tabela")

    srv.shutdown()
    if erros:
        print("\nE2E VERMELHO ❌")
        for e in erros:
            print(" -", e)
        sys.exit(1)
    print(f"\nE2E VERDE ✅ (fila chamada: {sorted(set(a for a in acoes_fila if a))})")


if __name__ == "__main__":
    main()
