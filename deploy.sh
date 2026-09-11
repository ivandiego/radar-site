#!/bin/bash
# Deploy do radar-site com cache-bust: injeta ?v=<epoch> nos imports de módulo
# e no <script> do index, roda os testes, commita e publica no Pages.
set -e
cd "$(dirname "$0")"
V=$(date +%s)
sed -i '' -E "s|(js/app\.js)(\?v=[0-9]*)?|\1?v=$V|" index.html
sed -i '' -E "s|(style\.css)(\?v=[0-9]*)?|\1?v=$V|" index.html
# 11/09: TODO import relativo de js/ e js/setores/ ganha a MESMA versão. Antes só app.js e api.js eram reescritos:
# os imports de dentro de setores/ ficavam sem ?v (o navegador podia servir módulo velho sem a função nova → a tela
# quebra com "does not provide an export") e estatistica.js ficou preso numa versão antiga. Mesma versão em todo
# lugar também faz cada módulo carregar UMA vez (api.js e logic.js carregavam duas: com e sem ?v).
for f in js/*.js js/setores/*.js; do
  sed -i '' -E "s#from '(\.\.?/[A-Za-z0-9_/-]+)\.js(\?v=[0-9]*)?'#from '\1.js?v=$V'#g" "$f"
done
if grep -rnE "from '\.\.?/[^']+\.js'" js/ ; then echo "IMPORT SEM VERSÃO - abortado"; exit 1; fi
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
# gates (PR 3 da revisão): sintaxe de TODO js + unit + E2E Playwright real —
# um SyntaxError em app.js derrubava o painel inteiro e o deploy não via
for f in js/*.js js/setores/*.js; do node --check "$f"; done
# F6: identificador indefinido (bug de 03/09: import esquecido virou ReferenceError em prod)
npx --yes eslint@9 js/ || { echo "ESLINT FALHOU - abortado"; exit 1; }
# F6: unit + gate de cobertura (>=80% linhas nos módulos puros)
node --test --experimental-test-coverage --test-coverage-include='js/logic.js' --test-coverage-include='js/registro.js' --test-coverage-include='js/carteira.js' --test-coverage-include='js/painel.js' --test-coverage-include='js/redacao.js' --test-coverage-include='js/auditoria.js' --test-coverage-include='js/recepcao.js' --test-coverage-include='js/cobranca.js' --test-coverage-include='js/garimpo.js' --test-coverage-include='js/fiscalizacao.js' --test-coverage-include='js/ficha.js' --test-coverage-lines=80 tests/*.test.mjs > /dev/null 2>&1 || { echo "TESTES/COBERTURA FALHARAM - abortado"; exit 1; }
python3 tests/e2e/site_e2e.py > /tmp/site-e2e.log 2>&1 || { echo "E2E FALHOU - abortado"; tail -8 /tmp/site-e2e.log; exit 1; }
git add index.html js/ && git commit -q -m "${1:-chore: deploy} (v=$V)" && git push -q
echo "publicado v=$V"
