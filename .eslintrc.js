module.exports = {
  env: {
    browser: false,
    es2017: true,
  },
  extends: [
    'standard',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'object-curly-spacing': 'off',
    // Knuth says operators come first, and he is right.
    'operator-linebreak': ['warn', 'before'],
    camelcase: 'off',
    'no-unused-vars': 'off',
    'comma-dangle': ['warn', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      functions: 'ignore',
    }],
  },
}
