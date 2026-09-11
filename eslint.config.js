import js from '@eslint/js'
import ts from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/*
 * Configuración deliberadamente corta.
 *
 * Existe sobre todo por una regla: rules-of-hooks. Un useCallback puesto
 * debajo de un return temprano crasheó la app entera, y ni TypeScript ni las
 * pruebas lo vieron — el tipo era correcto y la lógica también. Solo se notaba
 * abriendo la app.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'pruebas/fixtures/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // El proyecto usa `catch {}` a propósito en varios sitios donde fallar
      // en silencio es lo correcto; se explica con un comentario en cada uno.
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', Response: 'readonly', URL: 'readonly' } },
  },
]
