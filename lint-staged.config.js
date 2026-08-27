const PRETTIER_WRITE = 'prettier --write --ignore-path .prettierignore';

module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': 'eslint --cache --fix',
  '**/*': ['bash -c tsc-files --noEmit', PRETTIER_WRITE],
  'src/**/!(*locales)/**/!(*.test|*.spec).{ts,tsx,js,go,md,mdx,yml,yaml,json,scss,css}':
    'cspell -c cspell.config.json --no-progress --no-summary',
};
