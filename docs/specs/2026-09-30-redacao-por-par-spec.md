# Spec: Redação por par (v1, 30/09/2026)

Escrita pela IA executora na janela de 24 h (fila, Item 6; ordem `radar-permutas/docs/relatorios/2026-09-29-ordem-de-trabalho-par-no-centro.md`, Parte 1, Item 2).
Peça nova do site, por isso vai por spec, e não por ficha. Depende do `par_id` que o PR 1 da ficha
`radar-permutas/docs/fichas/2026-09-29-pensador-escreve-sem-o-par.md` (v3.1, PR #265, rascunho) passa a gravar em `mensagem_fila`.

## 1. O problema (evidência)

Na ordem de 29/09, o operador aprovou 13 rascunhos lendo só o card da Redação:
- uma pergunta já respondida foi feita de novo ("Já falei que sim");
- duas mensagens no mesmo dia se reapresentaram com "Aqui é o Ivan, da WELICI";
- o card não diz de qual par é a conversa nem em que etapa ele está ("Preciso saber qual o imóvel em permuta em questão").

O que o código faz hoje (lido, não suposto):
- `radar-permutas/supabase/functions/fila/index.ts`, ação `redacao_listar`, lê `mensagem_fila` pendente com `COLUNAS_REDACAO`
  (`regras.ts:271`): **sem `par_id`**. `agruparRascunhos` (`regras.ts:272`) agrupa **por destino** e leva só a **última**
  `mensagem_recebida` (`ultimaRec`). Não lê nada que já saiu de nós.
- `radar-site/js/redacao.js:6` (`gruposDaRedacao`) e `js/setores/redacao.js:14` renderizam um grupo por destino, com
  "ele(a) disse" = a última fala, e ordenam pelo rascunho mais antigo.
- Quem cruzou "o que já mandamos hoje" foi o operador, na Expedição, à mão (`expedicao_listar`, 48 h, sem filtro por destino).
- Não existe na Redação nenhum lugar onde apareça a conversa que o Pensador marcou como `sem_par` (PR #265 grava um
  `alarme('redacao','sem_par', …)` no diário, com `prova_ref` `mensagem_recebida:<id>`, e não gera rascunho).

**Medição pendente (não feita nesta rodada):** a contagem em produção de (i) rascunhos pendentes sem `par_id` e (ii) destinos
com 2 ou mais mensagens enviadas no mesmo dia nos últimos 14 dias. Só contagem (`count` com `exists`, nada de `group by` em
texto). Ela vai na lista de decisões do Ivan (R4) e entra na v2 desta spec. O número de 29/09 (0 de 33 pendentes com `par_id`)
é do operador.

## 2. O que muda (visão do Ivan)

1. A Redação passa a mostrar **um bloco por par**, não por destino. Cada bloco tem:
   - **cabeça do par:** VIP × alvo (nome de exibição do VIP; título, bairro e valor do alvo), a **etapa** de cada ponta e o
     **próximo passo**;
   - dentro do par, **uma faixa por conversa** (a do VIP e a do dono, se as duas tiverem rascunho), com os rascunhos como hoje
     (Aprovar, Editar e aprovar, Rejeitar; duplicata, reescrita, "voltou", "chegou depois" continuam iguais);
   - em cada conversa, **"ver a conversa inteira"**, que expande as falas dos dois lados, mais antigas primeiro;
   - em cada conversa, **"já saiu hoje para este destino"**: as nossas mensagens enviadas hoje e as que estão a caminho
     (aprovada, digitada), com hora;
   - um **aviso vermelho** no rascunho quando aprová-lo fará a **2ª mensagem do dia** para o mesmo destino.
2. Um bloco separado, **"Sem par"**, no topo, com:
   - as conversas que o Pensador marcou `sem_par` (alarme aberto no diário): quem, quando, a fala, e os botões
     **"Ligar a um par"** e **"Ignorar"**;
   - os rascunhos pendentes **sem `par_id`** (conversa de mais de um par, P2 (a) da ficha do PR 1; ou rascunho antigo, anterior
     ao PR 1; ou escrito pelo Relógios/site): aparecem com o rótulo "sem par" e as mesmas ações de hoje.
3. A **ordem da lista** de pares é decisão do Ivan (R1). A sugestão da ordem é pela comissão em jogo (6% do valor do alvo).

## 3. Desenho

### 3.1 Backend (edge `fila`, repositório `radar-permutas`)

- `COLUNAS_REDACAO` ganha `par_id`.
- `redacao_listar` passa a devolver, **além** de `grupos` (mantido por compatibilidade até o site novo ser publicado):
  - `pares`: para cada `par_id` distinto dos pendentes, a cabeça do par, montada **só por id**:
    `par` (id, apelido, `descartado_motivo`), `par_lado` → `pessoa` (id, `nome_exibicao`, `proximo_passo`) e `imovel`
    (id, título, bairro, cidade, valor), e `par_checklist` (lado, etapa). Uma leitura por tabela, com `in (ids)`.
  - `hoje`: por destino dos pendentes, as nossas mensagens em `enviada` com `enviado_em` no dia de hoje em
    `America/Sao_Paulo`, e as em `aprovada`/`digitada`, com id, estado, hora e texto.
  - `sem_par`: os alarmes abertos do diário (`setor='redacao'`, `tipo='alarme'`, `detalhe->>'motivo' = 'sem_par'`, `resolvido_em is null`; é o formato de `alarme()` em `agentes/diario-lib.mjs:24`),
    com id, hora, destino, `pessoa_ref`, `prova_ref` e a fala da `mensagem_recebida` da `prova_ref` (até 300 caracteres).
- **Chave do destino:** a mesma da régua da fila. WhatsApp por `chaveTelefone` (já no `regras.ts`); OLX pelo destino exato
  (chat-id). Nunca por rótulo nem por nome (regra 4).
- **Função pura nova** `montarRedacaoPorPar(pendentes, pares, lados, pessoas, imoveis, checklist, saidas, alarmes, agora)` em
  `regras.ts`, testada em `tests/fila_regras.test.ts`. O `index.ts` só lê e chama.
- **Três respostas (regra 3):** cada leitura que falha vira `null` naquele pedaço, e **não** lista vazia:
  - `pares[id] = null` → a cabeça mostra "par: não consegui ler";
  - `checklist` falhou → "etapa: não sei" (nunca "nenhuma etapa");
  - `hoje` falhou → "já saiu hoje: não sei", e o aviso da 2ª mensagem vira "**não sei se já saiu mensagem hoje**" (amarelo),
    nunca silêncio;
  - `sem_par` falhou → o bloco diz "não consegui ler as conversas sem par".
- **Nova ação de leitura** `conversa_do_destino` `{canal, destino}`: normaliza pelo `canalCanonico` (como a
  `caixa_da_conversa`) e devolve as últimas 40 falas dos dois lados, de 30 dias (`mensagem_recebida` de qualquer estado e
  `mensagem_fila` `enviada`), em ordem de hora. É chamada **só quando o Ivan expande** (o payload da lista não cresce).
- Nenhuma escrita nova no banco nesta fase. Nenhuma migração.

### 3.2 Site (`radar-site`)

- `js/redacao.js` ganha a função pura `redacaoPorPar(payload, agora, tz, ordem)`, que devolve
  `{ semPar: {alarmes, rascunhos, erro}, pares: [ {par, cabeca, etapas, proximo, comissao, conversas: [ {destino, rotulo, canal, hoje, rascunhos} ]} ] }`.
  - **etapa** por ponta = a última etapa feita, na ordem `contactado → valor → fotos → aceite → visita_ok`;
  - **próximo passo** = a primeira etapa que falta em cada ponta, mais o `proximo_passo` do VIP, se houver;
  - **comissão em jogo** = 6% do valor do alvo; alvo sem valor → `null` ("valor não sei"), e vai para o fim na ordem R1 (a);
  - **aviso da 2ª mensagem**: `hoje.length >= 1` → "2ª mensagem do dia para este destino"; `hoje === null` → "não sei".
- `js/setores/redacao.js` renderiza o bloco "Sem par" e os pares. As ações de rascunho (`aprovar`, `aprovar_editado`,
  `rejeitar`) **não mudam** (mesma chamada, mesmo `data-fid`).
- **"Ver a conversa inteira"**: botão por conversa. Chama `conversa_do_destino` e mostra as falas, com o lado ("ele(a)" / "nós")
  e a hora. Falha → "não consegui ler a conversa" (não fica vazio).
- **Telefone:** todo texto novo que aparece (falas, "já saiu hoje", alarme `sem_par`) passa por `mascararTelefones`
  (`js/painel.js`), como as barradas. O rótulo do destino também.
- **"Ignorar"** (bloco "Sem par"): pede confirmação e chama a `alarme_resolver` que já existe (nenhuma escrita nova). Gravar
  o motivo é a decisão R3; até a resposta, segue a (b), sem motivo, porque um motivo pedido e não gravado seria mentira da tela.
- **"Ligar a um par"** (bloco "Sem par"): nesta fase, **não grava nada**. Abre a Carteira (`#carteira`) e mostra ao Ivan o
  que fazer: pôr a chave da conversa (telefone ou link da conversa) na ficha do VIP ou do alvo. A ligação gravada pela Redação é
  a decisão R2.

### 3.3 O que **não** muda

- Nada sai sem o clique do Ivan. A régua, o Carteiro e as rotas `fila_decidir_pela_edge` seguem iguais.
- A Expedição, a Recepção e a Cobrança seguem por destino (irmãos, §5).

## 4. Regras do portão (as 10) contra esta spec

- **Regra 3 (sim/não/não sei):** toda leitura que falha vira "não sei" visível (§3.1). A 2ª mensagem nunca é "não" por falta de dado.
- **Regra 4 (identidade por id):** o par vem do `par_id` do rascunho; a conversa, pela chave canônica do destino. Nenhum
  agrupamento por rótulo ou nome. Rascunho sem `par_id` **não** é encaixado num par por palpite: vai para "Sem par".
- **Regra 9 (fronteira):** a comissão aparece só no site, que é do Ivan. Nada desta spec escreve texto para fora.
- **Regra 10 (gate que prova que falha):** as sabotagens do §7.
- **Leitura de texto:** o site mostra texto ao Ivan (é o papel dele). A IA não lê texto de produção em nenhum passo desta spec.

## 5. Irmãos (onde mais o card é por destino e sem par)

| Lugar | Hoje | Nesta spec |
|---|---|---|
| Redação (`js/setores/redacao.js`) | por destino, última fala | **muda** |
| Expedição (`js/setores/expedicao.js`, `expedicao_listar`) | por mensagem, sem par | residual: ficha própria, se o Ivan quiser |
| Recepção (`recepcao_listar`) | por destino | residual |
| Barradas (`js/setores/barradas.js`) | pelo diário, sem par | residual |
| Rascunho escrito pelo site (`criar`, `fila_criar_pela_edge`) | `par_id` opcional | residual (ficha do PR 1, linha 141): aparece em "Sem par" até ganhar par |

## 6. Cenários (contra a matriz do portão e os casos de 29/09)

1. Pergunta já respondida: a conversa inteira está a um clique, com as duas pontas; o card não esconde a resposta.
2. Duas reapresentações no mesmo dia: o aviso da 2ª mensagem aparece no 2º rascunho, com a hora da 1ª.
3. "Qual o imóvel em questão": a cabeça do par diz VIP × alvo, antes do texto.
4. Rascunho de conversa com dois pares: fica em "Sem par" (não entra num par por palpite).
5. Leitura do checklist falha: "etapa: não sei", e o rascunho continua aprovável (a etapa informa, não trava).
6. Leitura de "já saiu hoje" falha: aviso amarelo "não sei se já saiu mensagem hoje".
7. Mensagem enviada ontem às 23:50 (SP) não conta como hoje; a de hoje às 00:10 (SP), que em UTC é ontem, conta.
8. WhatsApp com o mesmo número gravado com e sem o 55: é a mesma conversa (`chaveTelefone`).
9. Par descartado com rascunho pendente: o bloco mostra "par descartado" na cabeça (não some).
10. Alarme `sem_par` já resolvido: não aparece.

## 7. Provas

- **Unit (edge):** `montarRedacaoPorPar` em `tests/fila_regras.test.ts`, com os cenários 4 a 10.
- **Unit (site):** `redacaoPorPar` em `tests/redacao.test.mjs`, com a ordem, a etapa, o próximo passo, a comissão e o aviso.
  O gate de cobertura (≥ 80% em `js/redacao.js`) continua.
- **E2E Playwright real** (`tests/e2e/site_e2e.py`, Chromium headless, supabase stubado, `/fila` com fixtures, rede externa
  zero): dois pares e um "Sem par"; a cabeça certa; expandir a conversa (chamada `conversa_do_destino` feita, falas na tela);
  o aviso da 2ª mensagem; "Ignorar" chama `alarme_resolver` com o id; aprovar um rascunho dentro do par manda `acao=aprovar`
  com o `data-fid` certo; nenhum telefone não mascarado no HTML; zero `pageerror`.
- **TDD:** commits RED antes dos GREEN, nos dois repositórios.
- **Sabotagens** (com `trap` que restaura): agrupar por destino em vez de `par_id`; tratar leitura falha de `hoje` como lista
  vazia; contar "hoje" em UTC; chave do WhatsApp sem normalizar; encaixar rascunho sem `par_id` no primeiro par; tirar o
  `mascararTelefones` das falas. Todas precisam deixar teste vermelho, mais um controle verde.
- **Esteira:** `bash agentes/esteira.sh` no `radar-permutas` (edge) e o CI do `radar-site` (sintaxe, eslint, unit, E2E).

## 8. Entregas

1. PR no `radar-permutas` (edge `fila`: `par_id` na lista, `pares`/`hoje`/`sem_par`, `conversa_do_destino`), **rascunho**,
   com base no `fix/par-contexto-pr1` (depende do `par_id`).
2. PR no `radar-site` (Redação por par), **rascunho**.
3. Publicar a edge e o site: **decisão do Ivan**, depois de mesclar o #265 (e o #266).

## 9. Decisões do Ivan (vão para `docs/relatorios/2026-09-29-janela-24h-decisoes-para-o-ivan.md`)

- **R1. Ordem da lista de pares:** (a) pela comissão em jogo, 6% do valor do alvo, a maior primeiro, e sem valor no fim
  (*recomendado*, é a sugestão da ordem); (b) pelo rascunho mais antigo (como hoje); (c) pela etapa mais avançada.
  Até a resposta, o código segue (a) com um único ponto de troca (`ordem`).
- **R2. "Ligar a um par" grava a ligação?** (a) Não nesta fase: o botão leva à Carteira para o Ivan pôr a chave na ficha
  (*recomendado*, conservador: uma ligação errada é mensagem para a pessoa errada); (b) sim: tabela nova de ligação
  conversa → par, lida pelo `par-contexto` (migração e ficha própria).
- **R3. "Ignorar" grava o motivo?** (a) sim, uma linha `sem_par_ignorado` no diário com o motivo (*recomendado*: o que foi
  ignorado fica explicado); (b) só resolve o alarme, como a `alarme_resolver` faz hoje.
- **R4. Medição em produção** (só contagem): rascunhos pendentes sem `par_id`; destinos com 2+ envios no mesmo dia em 14 dias.
  (a) rodar com o seu ok (*recomendado*); (b) não medir.
- **R5. Publicar** a edge e o site depois do merge do #265/#266: (a) com ok próprio, na ordem edge → site (*recomendado*).
