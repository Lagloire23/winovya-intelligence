/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1140px' },
    },
    extend: {
      colors: {
        'brand-primary': 'hsl(217, 42%, 45%)',
        'brand-blue-bright': 'hsl(206, 91%, 46%)',
        'brand-blue-sky': 'hsl(198, 100%, 47%)',
        'brand-green-light': 'hsl(101, 56%, 58%)',
        'brand-green-deep': 'hsl(149, 100%, 27%)',
        'brand-neutral': 'hsl(217, 5%, 96%)',
        'brand-navy': '#0C1A35',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        md: '0.625rem',
        sm: '0.5rem',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3D6BA8 0%, #1593E0 50%, #00B0F0 100%)',
        'gradient-accent': 'linear-gradient(135deg, #008A45 0%, #8BCF5E 100%)',
      },
      boxShadow: {
        card: '0 2px 8px rgba(61, 107, 168, 0.08)',
      },
    },
  },
  plugins: [],
}
