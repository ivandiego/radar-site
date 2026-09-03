#!/bin/bash
# Deploy do radar-site com cache-bust: injeta ?v=<epoch> nos imports de módulo
# e no <script> do index, roda os testes, commita e publica no Pages.
set -e
cd "$(dirname "$0")"
V=$(date +%s)
sed -i '' -E "s|(js/app\.js)(\?v=[0-9]*)?|\1?v=$V|" index.html
sed -i '' -E "s|(style\.css)(\?v=[0-9]*)?|\1?v=$V|" index.html
sed -i '' -E 's|from '"'"'\./(logic\|api\|config)\.js(\?v=[0-9]*)?'"'"'|from '"'"'./\1.js?v='"$V"''"'"'|g' js/app.js
sed -i '' -E 's|from '"'"'\./(config)\.js(\?v=[0-9]*)?'"'"'|from '"'"'./\1.js?v='"$V"''"'"'|g' js/api.js
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node tests/logic.test.mjs > /dev/null 2>&1 || { echo "TESTES FALHARAM - abortado"; exit 1; }
git add -A && git commit -q -m "${1:-chore: deploy} (v=$V)" && git push -q
echo "publicado v=$V"
