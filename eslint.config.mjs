// F6 (03/09): um import esquecido virou ReferenceError em produção e nem
// node --check nem o E2E de leitura viram. no-undef fecha essa classe.
const browser = Object.fromEntries(['document','window','fetch','navigator','prompt','confirm','alert',
  'setTimeout','clearTimeout','setInterval','location','FormData','URLSearchParams','console',
  'Event','CustomEvent','localStorage','Intl','URL','AbortSignal'].map((g) => [g, 'readonly']));
export default [{
  files: ['js/**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browser },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'off' },
}];
