import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.config.*', 'tests/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.strict,
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/no-shadow': 'error',
            eqeqeq: ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',
            'no-eval': 'error',
            'no-new-func': 'error',
            'no-throw-literal': 'error',
            'no-console': ['error', { allow: ['warn', 'error'] }],
        },
    },
);
