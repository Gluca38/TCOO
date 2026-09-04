import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    /**
     * Die Domänenschicht bleibt frei von UI- und Framework-Abhängigkeiten.
     *
     * Das ist die Voraussetzung dafür, dass Berechnung und Datenmodell später
     * unverändert serverseitig weiterverwendet werden können, wenn Login und
     * zentrale Speicherung dazukommen. Die Regel erzwingt das, statt es der
     * Disziplin zu überlassen.
     */
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'zustand', 'recharts', '../ui/*', '../state/*', '../io/*', '../format/*'],
              message:
                'src/domain/ muss frei von UI- und Framework-Abhängigkeiten bleiben (siehe README, Abschnitt Architektur).',
            },
          ],
        },
      ],
    },
  },
)
