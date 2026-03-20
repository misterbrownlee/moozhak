/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/views/**/*.ejs', './web/public/**/*.js'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          ...require('daisyui/src/theming/themes').light,
          '--rounded-box': '0.125rem',
          '--rounded-btn': '0.125rem',
          '--rounded-badge': '0.125rem',
        },
      },
      {
        dark: {
          ...require('daisyui/src/theming/themes').dark,
          '--rounded-box': '0.125rem',
          '--rounded-btn': '0.125rem',
          '--rounded-badge': '0.125rem',
        },
      },
      {
        cupcake: {
          ...require('daisyui/src/theming/themes').cupcake,
          '--rounded-box': '0.125rem',
          '--rounded-btn': '0.125rem',
          '--rounded-badge': '0.125rem',
        },
      },
      {
        nord: {
          ...require('daisyui/src/theming/themes').nord,
          '--rounded-box': '0.125rem',
          '--rounded-btn': '0.125rem',
          '--rounded-badge': '0.125rem',
        },
      },
    ],
    darkTheme: 'dark',
  },
};
