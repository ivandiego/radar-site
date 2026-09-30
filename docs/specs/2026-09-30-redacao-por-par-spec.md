# Spec: Redação por par (v3, 30/09/2026)

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

**A causa não está na tela** (v2, item F): o Pensador lê o histórico por `destino` exato, com `limit 3` e sem as
`aprovada`/`digitada` (`agentes/pensador-lote.mjs:65-67`). Isso gera a pergunta repetida e a 2ª apresentação, e o conserto
é do PR 1 (`conversa_fria`, `pensador-lote.mjs:98`; ordem, Item 1). Esta spec é a **rede da tela**: o Ivan vê o que o
Pensador não viu, antes de aprovar.

**Medição pendente (não feita nesta rodada):** a contagem em produção de (i) rascunhos pendentes sem `par_id` e (ii) destinos
com 2 ou mais mensagens enviadas no mesmo dia nos últimos 14 dias. Só contagem (`count` com `exists`, nada de `group by` em
texto). Ela vai na lista de decisões do Ivan (R4) e entra numa versão seguinte desta spec, se o Ivan autorizar. O número de 29/09 (0 de 33 pendentes com `par_id`)
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
   - as conversas que o Pensador marcou `sem_par` (alarmes abertos no diário, **um item por conversa**, pela chave): quem
     (mascarado), quando, a fala, e os botões **"Ligar a um par"**, **"Resolvido"** e **"Ignorar"**;
   - os rascunhos pendentes **sem `par_id`** (conversa de mais de um par, P2 (a) da ficha do PR 1; ou rascunho antigo, anterior
     ao PR 1; ou escrito pelo Relógios/site): aparecem com o rótulo "sem par" e as mesmas ações de hoje.
3. A **ordem da lista** de pares é decisão do Ivan (R1). A sugestão da ordem é pela comissão em jogo (6% do valor do alvo).

## 3. Desenho

### 3.0 Onde mora cada dado (v2, volta 1 do revisor, item A)

Dois bancos, lidos cada um por quem já os lê hoje:
- **Banco do site** (`SUPABASE_URL`, `js/config.js:3`): `par`, `par_lado`, `pessoa`, `imovel`. Só o site os lê, pelo cliente
  dele e com a sessão do Ivan (RLS), como a Carteira já faz (`js/api.js:29-40`, `fetchCarteira`). **A edge não lê essas
  tabelas** (nenhuma edge lê; os robôs só as veem pelo `retrato_site`). A v1 errou aqui.
- **Banco da edge** (`picoclaw-auth`, `FUNCTIONS_URL`): `mensagem_fila`, `mensagem_recebida`, `diario`, `par_checklist`.
  Só a edge `fila` os lê.

O site junta os dois pelo `par_id` (id, regra 4). Não se usa o `retrato_site` aqui: ele tem teto de 24 h, só traz pessoas em
`5-NEGOCIACAO` e carrega campos privados (`recorte-site.mjs:28`).

### 3.0.1 A chave da conversa (v2, item B)

A chave é a da régua: `chaveDaConversa(canal, destino)` (`agentes/retrato-lib.mjs:15`), espelho da `conversa_chave` do
banco (`agentes/sql/f464-regua-e-bloqueio.sql:96`). WhatsApp: os dígitos **inteiros**, sem o 55. OLX: o chat-id decodificado
(`%3D`, `%2B`, `%2F`, `%40`) e cortado pela `chatIdBase`. **Não** se usa `chaveTelefone` (`regras.ts:109`): ela pega só os 8
últimos dígitos, e dois números diferentes caem na mesma chave.
- A edge ganha uma cópia em TypeScript (`chaveDaConversa` em `regras.ts`) e um **teste de contrato** que roda as mesmas
  fixtures nas três (a `.mjs`, a `.ts` e a `conversa_chave` do SQL, no `tests/contrato-regua-bloqueio.test.sh` que já existe), com o formato real dos destinos: WhatsApp com e sem 55, com `+` e espaços; chat-id
  com `%3D` e sem.
- **Busca larga no banco, corte exato no código:** o banco não tem índice pela chave. A edge busca largo e a função pura fica
  só com as linhas cuja `chaveDaConversa` é **igual** à do rascunho:
  - **WhatsApp:** `destino like '%<dígitos sem 55>'` (o destino é gravado `55`+dígitos, `canalCanonico`, `regras.ts:86`);
  - **OLX (chat):** o banco grava o chat-id como veio, com padding e às vezes codificado (`…==@conference.olxbr`,
    `…%3D%3D%40conference.olxbr`; `retrato-lib.mjs:8-10`, `coletor-lib.mjs:159`). A busca é pelo **prefixo** do chat-id até o
    1º caractere entre `= % @ + /`: `destino like '<prefixo>%'`. Prefixo com menos de 12 caracteres → a edge **recusa** a busca
    (`conversa: não sei`), porque um prefixo curto traria conversas de outros;
  - **OLX (anúncio, 1º contato):** o list-id é só dígitos: `destino = '<list-id>'`, sem busca larga;
  - outro canal → `conversa: não sei` (nunca 0).
  - Teste contra linhas **gravadas no formato real** (WhatsApp com e sem 55; chat-id com `==@`, com `%3D==@`, com `%3D%3D%40`
    e com um `=` a menos), no Postgres local.

### 3.1 Backend (edge `fila`, repositório `radar-permutas`)

- **Ação nova `redacao_por_par`** (v3). A `redacao_listar` fica **como está** até o site novo ser publicado (o site de hoje
  depende dela, e ela já leva o `destino`: é o estado atual, não piora). A remoção da `redacao_listar` é a entrega 4 (§8).
- Na ação nova, **nenhum `destino` sai da edge** (item D). Cada conversa leva `conversa_id` = o id (uuid) do rascunho
  pendente mais antigo dela: é opaco e não dá para reverter (v3: o md5 sem sal da chave foi descartado, porque ~10^11 números
  se recuperam em segundos). O rótulo é o `destino_rotulo`, mascarado pela edge; sem rótulo → "conversa sem nome (canal)",
  **nunca** o destino (hoje `regras.ts:307` cai no destino).
- `redacao_por_par` lê `mensagem_fila` pendente com `par_id` (`limit 500`, como hoje em `index.ts:352`; se voltar 500,
  `cortada: true`, e a tela diz "há mais rascunhos do que a tela mostra") e devolve:
  - `checklist`: `par_checklist` (par_id, lado, etapa) dos `par_id` dos pendentes, uma leitura com `in (ids)`;
  - `hoje`: por conversa dos pendentes, as nossas mensagens `enviada` com `enviado_em` no dia de hoje em `America/Sao_Paulo`, e
    as `aprovada`/`digitada`/`falhou` (a `falhou` pode sair de novo por `tentar_de_novo`, então conta, com o rótulo "falhou,
    pode sair de novo"), com id, estado, hora e texto (mascarado). Uma leitura de todas as do dia com `limit 500`: se
    voltar 500 linhas, `hoje = null` ("não sei"), porque o corte esconderia envios;
  - `sem_par`: os alarmes abertos do diário (`setor='redacao'`, `tipo='alarme'`, `detalhe->>'motivo' = 'sem_par'`,
    `resolvido_em is null`; formato de `alarme()` em `agentes/diario-lib.mjs:24`, gravado em `pensador-lote.mjs:90`),
    **agrupados pela chave da conversa** (o alarme é o comum, não o `alarmeUnico`: cada rodada com mensagem nova do mesmo
    destino grava outro). **A chave de cada alarme sai da `mensagem_recebida` da `prova_ref`** (canal e destino inteiros), nunca
    do `detalhe` (só tem `{motivo}`, `diario-lib.mjs:27`) nem da coluna `diario.destino` (cortada em 60 caracteres,
    `diario-lib.mjs:14`, e chat-ids chegam a 63). Alarme cuja `mensagem_recebida` não foi lida ou achada fica **sozinho**, com
    "conversa: não sei", e nunca é juntado a outro. Leitura com `limit 200`; se voltar 200, "há mais alarmes do que a tela
    mostra". Cada grupo: `conversa_id` (o id do alarme mais novo), os ids dos alarmes, a hora do mais novo, o rótulo mascarado
    e a fala mais nova (até 300 caracteres, mascarada).
  - "ele(a) disse" e "chegou depois" passam a ser calculados **pela chave** (hoje são pelo `destino` exato, `index.ts:355`,
    `regras.ts:275-280`), porque a conversa agora é agrupada pela chave.
- **Função pura nova** `montarRedacaoPorPar(pendentes, checklist, saidas, alarmes, falas, agora)` em `regras.ts`, testada em
  `tests/fila_regras.test.ts`. O `index.ts` só lê e chama.
- **Três respostas (regra 3):** cada leitura que falha vira `null` naquele pedaço, e **não** lista vazia:
  - `checklist` falhou → "etapa: não sei" (nunca "nenhuma etapa"); par sem linha no checklist (lido) → "nenhuma etapa feita";
  - `hoje` falhou ou bateu no `limit` → aviso **amarelo** "não sei se já saiu mensagem hoje", nunca silêncio;
  - `sem_par` falhou → o bloco diz "não consegui ler as conversas sem par";
  - a fala da `prova_ref` que falhou ou não foi achada → "fala: não consegui ler" / "fala: não achei" (duas coisas diferentes).
- **Nova ação de leitura** `conversa_do_rascunho` `{fila_id}` ou `{alarme_id}` (item D): a edge lê a linha da fila **pelo id** e tira dela o
  canal e o destino no servidor. O navegador nunca manda o destino. Devolve as últimas 40 falas dos dois lados, de 30 dias
  (`mensagem_recebida` de qualquer estado e `mensagem_fila` `enviada`), pela busca larga + corte exato do §3.0.1, em ordem de
  hora, e **`cortada: true|false`**: se havia mais de 40 ou mais antigas que 30 dias, a tela diz "mostrando as 40 últimas
  de 30 dias" (item E). Com `{alarme_id}`, a edge lê o alarme, depois a `mensagem_recebida` da `prova_ref`, e tira dela o
  canal e o destino; sem `prova_ref` legível → "não consegui ler a conversa".
  É chamada **só quando o Ivan expande**.
- Nenhuma escrita nova no banco nesta fase. Nenhuma migração.

### 3.2 Site (`radar-site`)

- **Cabeça do par** (item A): um módulo puro novo, `js/redacao-leitura.js`, com `lerParesDaRedacao(cliente, parIds)`, que
  **recebe o cliente** (como `js/registro.js`), testado em `tests/redacao-leitura.test.mjs` com um cliente falso que finge
  `select`, `in` e erro. O `js/api.js` só passa o `sb` (ele importa de `esm.sh` e não roda em teste). A função que lê do banco do site `par` (id, apelido,
  `descartado_motivo`), `par_lado` (par_id, pessoa_id, imovel_id), `pessoa` (id, `nome_exibicao`, `proximo_passo`) e `imovel`
  (id, titulo, bairro, cidade, valor), com colunas **explícitas** (nunca `*`: nada de `telefone`, `contato_privado`,
  `link_thread_olx_privado`, `link_fonte_privado`, `telefone_anunciante`). Uma leitura por tabela, com `in (ids)`.
  - Leitura com erro → `null` → "par: não consegui ler";
  - leitura ok e o `par_id` não veio → "par: não achei (apagado?)", **diferente** de não ler;
  - par sem `par_lado` do VIP ou sem imóvel → "VIP: não achei" / "alvo: não achei".
  - O stub do E2E (`FIX` em `tests/e2e/site_e2e.py:19`) hoje não finge filtro nem erro (`site_e2e.py:48-54`). Ele passa a
    respeitar `select` (colunas pedidas) e `in`, e a devolver erro quando a fixture pedir. Sem isso as sabotagens
    `select('*')` e "não achei × não consegui ler" não ficariam vermelhas.
- `js/redacao.js` ganha a função pura `redacaoPorPar(fila, cabecas, agora, tz, ordem)`, que devolve
  `{ semPar: {grupos, rascunhos, erro}, pares: [ {par, cabeca, etapas, proximo, comissao, conversas: [ {conversa_id, rotulo, canal, hoje, rascunhos} ]} ] }`.
  - **Dois rótulos diferentes no bloco "Sem par"** (regra 3): "conversa sem par" (o Pensador procurou e não achou nenhum,
    alarme `sem_par`) e "rascunho sem par gravado" (rascunho pendente sem `par_id`: pode ser conversa de **mais de um** par,
    rascunho anterior ao PR 1 ou escrito pelo site; a tela não sabe qual e diz isso). "Nenhum" e "não sei" não viram a mesma
    coisa.
  - **etapa** por ponta = a última etapa feita, na ordem `contactado → valor → fotos → aceite → visita_ok`;
  - **próximo passo** = a primeira etapa que falta em cada ponta, mais o `proximo_passo` do VIP, se houver;
  - **comissão em jogo** = 6% do valor do alvo; alvo sem valor → `null` ("valor não sei"), e vai para o fim na ordem R1 (a);
  - **aviso da 2ª mensagem**: `hoje.length >= 1` → "2ª mensagem do dia para esta conversa (neste canal)"; `hoje === null` →
    "não sei". O "neste canal" é declarado: um envio pela OLX e outro pelo WhatsApp para a mesma pessoa no mesmo dia **não**
    disparam o aviso (a ligação entre os canais só existe no `bloqueio_conversa.destinos_origem`; residual, §5).
  - "hoje" e as horas são sempre em `America/Sao_Paulo`: o `tz` é obrigatório nesta função (o `fmt` tem `tz='UTC'` de padrão,
    `js/redacao.js:4`), e o teste do fuso (cenário 7) roda **também no site**.
- `js/setores/redacao.js` renderiza o bloco "Sem par" e os pares. As ações de rascunho (`aprovar`, `aprovar_editado`,
  `rejeitar`) **não mudam** (mesma chamada, mesmo `data-fid`).
- **Telefone (item D):** nenhum `data-*` leva destino (hoje `data-destino="${g.destino}"` em `js/setores/redacao.js:17` põe o
  telefone cru no HTML; a nova tela usa só `data-fid`, `data-alarmes` (ids) e `data-conversa` (uuid opaco)). Todo texto novo (falas,
  "já saiu hoje", o texto, o `destino` e o `pessoa_ref` do alarme `sem_par`, o rótulo) passa por `mascararTelefones`
  (`js/painel.js:55`) **também quando a edge já mascarou** (duas redes).
- **"Ver a conversa inteira"**: botão por conversa. Chama `conversa_do_rascunho` e mostra as falas, com o lado ("ele(a)" /
  "nós") e a hora. Falha → "não consegui ler a conversa" (não fica vazio); `cortada` → o aviso do corte.
- **"Ignorar"** (bloco "Sem par", item C): pede confirmação e chama a `alarme_resolver` que já existe **para cada id do grupo**
  (nenhuma escrita nova). Se algum falhar, a tela diz quantos ficaram abertos. A `alarme_resolver` (`index.ts:472`) resolve só
  pelo id e `tipo='alarme'`; ela não confere `setor` nem `motivo`, mas o site só manda ids que vieram do bloco `sem_par`.
  A `mensagem_recebida` continua como está (marcada `sem_par`); se a pessoa escrever de novo, a conversa volta ao Pensador
  sozinha (a mensagem nova entra com `pensado_em is null`, `lote-lib.mjs:278`) e gera outro alarme, se ainda não tiver par.
  Gravar o motivo é a decisão R3; até a resposta, segue a (b).
- **"Ligar a um par"** (bloco "Sem par", item C): nesta fase **não grava nada**, e a tela **diz o beco inteiro**, sem prometer:
  1. abre a Carteira (`#carteira`). O Ivan acha a pessoa pelo nome mascarado e pela fala (ele reconhece a conversa no
     WhatsApp ou na OLX; o telefone não vem por esta tela) e põe o telefone ou o link da conversa na ficha do VIP ou do alvo;
  2. avisa: "**a mensagem que já chegou não volta sozinha ao Pensador** (ela ficou marcada). Para responder agora, use a
     ficha na Carteira → IA → '+ Fila' (`js/setores/carteira.js:122-141`, que já grava o `par_id`); ou espere a pessoa
     escrever de novo";
  3. avisa também: "**a ligação só vale quando o robô reler o site**, e ele relê no máximo a cada 24 h e só traz clientes em
     5-NEGOCIACAO (o `retrato_site`). Cliente em outra etapa continua sem par";
  4. o alarme continua aberto até o Ivan clicar "Resolvido" (a mesma `alarme_resolver`). O mesmo alarme aparece no Painel
     (`index.ts:463`, `alarmesAbertos`): resolver num lugar resolve no outro, porque é a mesma linha.
  (A v2 citava um "Nova mensagem" que não existe no site, e a ação `criar` pede o destino vindo do navegador.)
  Sem isso, o cliente ficaria sem resposta e sem aviso (achado do revisor: `pensador-lote.mjs:93` marca `pensado_em`, e
  `sqlNovasParaPensar` só pega `pensado_em is null`). Fazer a mensagem voltar ao Pensador sozinha é uma escrita nova: é a
  decisão R2 (b).

### 3.3 O que **não** muda

- Nada sai sem o clique do Ivan. A régua, o Carteiro e as rotas `fila_decidir_pela_edge` seguem iguais.
- A Expedição, a Recepção e a Cobrança seguem por destino (irmãos, §5).

## 4. Regras do portão (as 10) contra esta spec

- **Regra 3 (sim/não/não sei):** toda leitura que falha vira "não sei" visível (§3.1). A 2ª mensagem nunca é "não" por falta de dado.
- **Regra 4 (identidade por id):** o par vem do `par_id` do rascunho; a conversa, pela chave canônica do destino. Nenhum
  agrupamento por rótulo ou nome. Rascunho sem `par_id` **não** é encaixado num par por palpite: vai para "Sem par".
- **Regra 9 (fronteira):** a comissão aparece só no site, que é do Ivan. Nada desta spec escreve texto para fora. O telefone
  não vai ao navegador por esta tela (sem `destino` no payload nem em `data-*`), e os campos privados do site não são lidos
  (colunas explícitas, §3.2).
- **Regra 6 (falha não vira estado):** o corte de 40 falas, o `limit` de "hoje" e a fala não lida aparecem na tela.
- **Regra 10 (gate que prova que falha):** as sabotagens do §7.
- **Leitura de texto:** o site mostra texto ao Ivan (é o papel dele). A IA não lê texto de produção em nenhum passo desta spec.

## 5. Irmãos (onde mais o card é por destino e sem par)

| Lugar | Hoje | Nesta spec |
|---|---|---|
| Redação (`js/setores/redacao.js`) | por destino, última fala | **muda** |
| Expedição (`js/setores/expedicao.js`, `expedicao_listar`) | por mensagem, sem par | residual: ficha própria, se o Ivan quiser |
| Recepção (`recepcao_listar`) | por destino | residual |
| Barradas (`js/setores/barradas.js`) | pelo diário, sem par | residual |
| Histórico do Pensador (`agentes/pensador-lote.mjs:65-67`) | por `destino` exato, `limit 3`, sem `aprovada`/`digitada` | **causa**: PR 1 (`conversa_fria`); esta spec é só a tela |
| Migração de canal (`bloqueio_conversa.destinos_origem`, f464:43) | liga OLX e WhatsApp só no bloqueio | residual: o aviso é "neste canal" (§3.2), declarado na tela |
| Alarme `sem_par` (`pensador-lote.mjs:90`) | `alarme()` comum: um por rodada com mensagem nova | a tela agrupa pela chave; trocar por `alarmeUnico` é observação ao #265 (R6) |
| `conversa_recente` (`index.ts:478-497`; Recepção e Carteira) | busca pelos 8 últimos dígitos | residual: **ficha própria** (o mesmo defeito do item B, fora desta tela) |
| Alarmes no Painel (`index.ts:463`) | o `sem_par` aparece lá também | declarado: mesma linha, resolver num lugar resolve no outro |
| Rascunho escrito pelo site (`criar`, `fila_criar_pela_edge`) | `par_id` opcional | residual (ficha do PR 1, linha 141): aparece em "Sem par" até ganhar par |

## 6. Cenários (contra a matriz do portão e os casos de 29/09)

1. Pergunta já respondida: a conversa inteira está a um clique, com as duas pontas; o card não esconde a resposta.
2. Duas reapresentações no mesmo dia: o aviso da 2ª mensagem aparece no 2º rascunho, com a hora da 1ª.
3. "Qual o imóvel em questão": a cabeça do par diz VIP × alvo, antes do texto.
4. Rascunho de conversa com dois pares: fica em "Sem par" (não entra num par por palpite).
5. Leitura do checklist falha: "etapa: não sei", e o rascunho continua aprovável (a etapa informa, não trava).
6. Leitura de "já saiu hoje" falha: aviso amarelo "não sei se já saiu mensagem hoje".
7. Mensagem enviada ontem às 23:50 (SP) não conta como hoje; a de hoje às 00:10 (SP), que em UTC é ontem, conta.
8. WhatsApp com o mesmo número gravado com e sem o 55: é a mesma conversa (`chaveDaConversa`).
9. Par descartado com rascunho pendente: o bloco mostra "par descartado" na cabeça (não some).
10. Alarme `sem_par` já resolvido: não aparece.
11. Três alarmes `sem_par` da mesma conversa (3 rodadas): um item só; "Ignorar" resolve os 3; se 1 falhar, a tela diz.
12. WhatsApp: dois números diferentes com os mesmos 8 últimos dígitos: são **duas** conversas (a chave inteira).
13. OLX: o mesmo chat-id gravado com `%3D` e com `=`: a mesma conversa.
14. `par_id` do rascunho não existe mais no site (leitura ok, sem linha): "par: não achei", diferente de "não consegui ler".
15. "Ligar a um par": a tela diz que a mensagem já chegada não volta sozinha e aponta a ficha na Carteira → IA → "+ Fila"; diz também o teto de 24 h e o 5-NEGOCIACAO.
16. Conversa com 60 falas: aparecem 40, com o aviso do corte.
17. "Já saiu hoje" bateu no `limit`: aviso amarelo "não sei", não "nenhuma".

## 7. Provas

- **Unit (edge):** `montarRedacaoPorPar` em `tests/fila_regras.test.ts`, com os cenários 4 a 10.
- **Unit (site):** `redacaoPorPar` em `tests/redacao.test.mjs`, com a ordem, a etapa, o próximo passo, a comissão e o aviso.
  O gate de cobertura (≥ 80% em `js/redacao.js`) continua.
- **E2E Playwright real** (`tests/e2e/site_e2e.py`, Chromium headless, supabase stubado, `/fila` com fixtures, rede externa
  zero; stub do banco do site para `par`/`par_lado`/`pessoa`/`imovel`): dois pares e um "Sem par"; a cabeça certa; expandir a conversa (chamada `conversa_do_rascunho` com o `fila_id`, sem destino, falas na tela);
  o aviso da 2ª mensagem; "Ignorar" chama `alarme_resolver` com o id; aprovar um rascunho dentro do par manda `acao=aprovar`
  com o `data-fid` certo; nenhum telefone não mascarado no HTML; zero `pageerror`.
- **TDD:** commits RED antes dos GREEN, nos dois repositórios.
- **Sabotagens** (com `trap` que restaura): agrupar por destino em vez de `par_id`; tratar leitura falha de `hoje` como lista
  vazia; contar "hoje" em UTC; chave do WhatsApp sem normalizar; encaixar rascunho sem `par_id` no primeiro par; tirar o
  `mascararTelefones` das falas; (v2) usar `chaveTelefone` (8 dígitos) no lugar da `chaveDaConversa`; falha da cabeça do par
  virar "descartado" ou sumir; "não achei" igual a "não consegui ler"; falha de `conversa_do_rascunho` virar lista vazia;
  `cortada` ignorado; falha de `sem_par` virar bloco vazio; `limit` de "hoje" batido tratado como completo; destino cru num
  `data-*`; `select('*')` na leitura do site; o "Ligar a um par" sem o aviso do beco; "Ignorar" resolvendo só o 1º id do grupo.
  Todas precisam deixar teste vermelho, mais um controle verde. A cópia TS da chave tem o teste de contrato do §3.0.1 contra
  a `.mjs` e contra a `conversa_chave` do SQL, com fixtures no formato real (WhatsApp com e sem 55; chat-id com `==@`,
  `%3D==@` e um `=` a menos). (v3) Mais sabotagens: busca OLX pelo chat-id inteiro (sem prefixo); chave do alarme tirada da
  coluna `diario.destino`; md5 da chave como id; `grupos` da ação nova com `destino`; os dois rótulos do "Sem par" iguais;
  `falhou` fora de "hoje"; o corte de 500 calado.
- **Esteira:** `bash agentes/esteira.sh` no `radar-permutas` (edge) e o CI do `radar-site` (sintaxe, eslint, unit, E2E).

## 8. Entregas

1. PR no `radar-permutas` (edge `fila`: `par_id` na lista, `checklist`/`hoje`/`sem_par`, `conversa_do_rascunho`,
   `chaveDaConversa` em TS), **rascunho**,
   com base no `fix/par-contexto-pr1` (depende do `par_id`).
2. PR no `radar-site` (Redação por par), **rascunho**.
3. Publicar a edge e o site: **decisão do Ivan**, depois de mesclar o #265 (e o #266).
4. Depois do site novo publicado: um PR que tira a `redacao_listar` e o seu `destino` da edge.

## 9. Decisões do Ivan (vão para `docs/relatorios/2026-09-29-janela-24h-decisoes-para-o-ivan.md`)

- **R1. Ordem da lista de pares:** (a) pela comissão em jogo, 6% do valor do alvo, a maior primeiro, e sem valor no fim
  (*recomendado*, é a sugestão da ordem); (b) pelo rascunho mais antigo (como hoje); (c) pela etapa mais avançada.
  Até a resposta, o código segue (a) com um único ponto de troca (`ordem`).
- **R2. "Ligar a um par" grava a ligação e faz a mensagem voltar ao Pensador?** (a) Não nesta fase: o botão leva à Carteira,
  e a tela avisa que a mensagem já chegada não volta sozinha (o Ivan responde pela ficha na Carteira → IA → "+ Fila" ou espera a pessoa)
  (*recomendado*, conservador: uma ligação errada é mensagem para a pessoa errada); (b) sim: tabela nova de ligação
  conversa → par, lida pelo `par-contexto`, e a mensagem marcada `sem_par` volta a `pensado_em is null` (migração e ficha
  própria).
- **R3. "Ignorar" grava o motivo?** (a) sim, uma linha `sem_par_ignorado` no diário com o motivo (*recomendado*: o que foi
  ignorado fica explicado); (b) só resolve o alarme, como a `alarme_resolver` faz hoje.
- **R4. Medição em produção** (só contagem): rascunhos pendentes sem `par_id`; destinos com 2+ envios no mesmo dia em 14 dias.
  (a) rodar com o seu ok (*recomendado*); (b) não medir.
- **R6. Alarme `sem_par` único por conversa** (observação ao #265): (a) trocar `alarme()` por `alarmeUnico` com a chave da
  conversa no `pensador-lote.mjs:90` (*recomendado*; hoje cada rodada com mensagem nova grava outro); (b) deixar, a tela agrupa.
- **R5. Publicar** a edge e o site depois do merge do #265/#266: (a) com ok próprio, na ordem edge → site (*recomendado*).

## 10. Mudanças da v2 (volta 1 do revisor: DEVOLVER, 30/09)

- **A.** A cabeça do par sai da edge e vai para o site: `par`, `par_lado`, `pessoa` e `imovel` moram no banco do site
  (§3.0). A edge só dá `checklist`, `hoje` e `sem_par`.
- **B.** A chave passa a ser a `chaveDaConversa` da régua, com uma cópia TS e um teste de contrato. A `chaveTelefone` (8 dígitos)
  saiu. A busca é larga no banco, com corte exato no código (§3.0.1).
- **C.** O circuito do `sem_par`: alarmes agrupados pela chave; "Ignorar" resolve o grupo; "Ligar a um par" diz o beco (a
  mensagem marcada não volta sozinha) e aponta o "Nova mensagem"; R2 (b) e R6 novas.
- **D.** Telefone: o `destino` sai do payload e de todo `data-*`; `conversa_do_rascunho` recebe o id da fila ou do alarme, e a
  edge tira o destino no servidor; mascarar também `destino`/`pessoa_ref` do alarme.
- **E.** Regra 3: "não achei" × "não consegui ler" na cabeça e na fala; o corte de 40 falas e o `limit` de "hoje" aparecem.
- **F.** §1 e §5: a causa é do PR 1 (`pensador-lote.mjs:65-67`, `conversa_fria`); a migração de canal é residual declarado.
- **G.** 12 sabotagens a mais, o teste do fuso no site e os cenários 11 a 17.

## 11. Mudanças da v3 (volta 2 do revisor: DEVOLVER, 30/09)

1. **Busca da OLX:** pelo prefixo do chat-id até o 1º `= % @ + /`, com o mínimo de 12 caracteres; `olx_anuncio` pelo list-id
   exato; teste contra linhas no formato real (§3.0.1).
2. **Destino do alarme `sem_par`:** sai da `mensagem_recebida` da `prova_ref`, nunca do `detalhe` nem do `diario.destino`
   cortado em 60; alarme sem conversa legível fica sozinho, com "não sei".
3. **Telefone:** ação nova `redacao_por_par` sem destino; a `redacao_listar` fica como está até a entrega 4; `conversa_id` =
   uuid opaco no lugar do md5 sem sal; o rótulo nunca cai no destino.
4. **"Ligar a um par":** o caminho que existe (Carteira → IA → "+ Fila", com `par_id`); como o Ivan acha a pessoa sem o
   telefone na tela; o teto de 24 h e o 5-NEGOCIACAO do `retrato_site` na tela; o alarme também no Painel.
5. **Provas:** leitura do site em módulo puro com o cliente injetado; stub do E2E que finge filtro e erro; contrato da chave
   também contra o SQL; a citação errada do `site-tabelas.sql` saiu.
6. **§5 e rótulos:** `conversa_recente` (8 dígitos) e o alarme no Painel entram; "ele(a) disse"/"chegou depois" pela chave;
   "conversa sem par" × "rascunho sem par gravado"; os cortes de 500 e de 200 aparecem na tela; `falhou` conta em "hoje".
