# Radar WELICI — painel

Painel do Radar de Permutas (GitHub Pages). Robôs e spec: repo `radar-permutas`.

## Qualidade (F5/F6)
[![CI](https://github.com/ivandiego/radar-site/actions/workflows/ci.yml/badge.svg)](https://github.com/ivandiego/radar-site/actions/workflows/ci.yml)

Gates que travam merge (CI) e publicação (`deploy.sh`): sintaxe de todo js ·
eslint `no-undef` · unit dos módulos puros (`logic`, `registro`, `carteira`)
com **cobertura de linhas >= 80%** · E2E Playwright headless com supabase stubado.
