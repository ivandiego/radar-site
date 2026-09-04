#!/bin/bash
# Deploy do radar-site com cache-bust: injeta ?v=<epoch> nos imports de módulo
# e no <script> do index, roda os testes, commita e publica no Pages.
set -e
cd "$(dirname "$0")"
V=$(date +%s)
sed -i '' -E "s|(js/app\.js)(\?v=[0-9]*)?|\1?v=$V|" index.html
sed -i '' -E "s|(style\.css)(\?v=[0-9]*)?|\1?v=$V|" index.html
sed -i '' -E 's|from '"'"'\./(logic\|api\|config\|setores/painel\|setores/diario\|setores/redacao\|setores/expedicao)\.js(\?v=[0-9]*)?'"'"'|from '"'"'./\1.js?v='"$V"''"'"'|g' js/app.js
sed -i '' -E 's|from '"'"'\./(config\|registro\|carteira)\.js(\?v=[0-9]*)?'"'"'|from '"'"'./\1.js?v='"$V"''"'"'|g' js/api.js
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
# gates (PR 3 da revisão): sintaxe de TODO js + unit + E2E Playwright real —
# um SyntaxError em app.js derrubava o painel inteiro e o deploy não via
for f in js/*.js js/setores/*.js; do node --check "$f"; done
# F6: identificador indefinido (bug de 03/09: import esquecido virou ReferenceError em prod)
npx --yes eslint@9 js/ || { echo "ESLINT FALHOU - abortado"; exit 1; }
# F6: unit + gate de cobertura (>=80% linhas nos módulos puros)
node --test --experimental-test-coverage --test-coverage-include='js/logic.js' --test-coverage-include='js/registro.js' --test-coverage-include='js/carteira.js' --test-coverage-include='js/painel.js' --test-coverage-include='js/redacao.js' --test-coverage-lines=80 tests/*.test.mjs > /dev/null 2>&1 || { echo "TESTES/COBERTURA FALHARAM - abortado"; exit 1; }
python3 tests/e2e/site_e2e.py > /tmp/site-e2e.log 2>&1 || { echo "E2E FALHOU - abortado"; tail -8 /tmp/site-e2e.log; exit 1; }
git add index.html js/ && git commit -q -m "${1:-chore: deploy} (v=$V)" && git push -q
echo "publicado v=$V"
