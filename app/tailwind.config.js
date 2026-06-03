/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // White-label: cores vêm de CSS variables definidas em runtime pela
      // configuração da clínica (ThemeProvider). Fallback no index.css.
      colors: {
        primaria: 'rgb(var(--cor-primaria) / <alpha-value>)',
        secundaria: 'rgb(var(--cor-secundaria) / <alpha-value>)',
        fundo: 'rgb(var(--cor-fundo) / <alpha-value>)',
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
