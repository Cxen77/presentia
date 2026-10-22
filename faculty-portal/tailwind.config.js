/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#061522', // Main background
          900: '#081B2A', // Secondary background
          850: '#12283D', // Main surface
          800: '#182D43', // Elevated surface
          750: '#202D39', // Card charcoal
          700: '#24374B', // Blue-gray surface
          600: '#293D53', // Border color
        },
        surface: {
          main: '#12283D',
          elevated: '#182D43',
          card: '#202D39',
          bluegray: '#24374B',
          border: '#293D53',
        },
        text: {
          primary: '#F4F5F7',
          secondary: '#A8B9D0',
          muted: '#7F94B0',
        },
        accent: {
          blue: '#9AB9EC',
          light: '#B4CBF5',
          btn: '#F3F2EF',
          btnText: '#101D2C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
