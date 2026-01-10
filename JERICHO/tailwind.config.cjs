/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#02030a',
        ink: '#0a0d18',
        card: '#0c1021',
        accent: '#f5f5f5',
        muted: '#9ea0a7',
        hot: '#f2e14f',
        line: '#1c2030',
        glass: 'rgba(255,255,255,0.04)',
        'jericho-bg': 'var(--jericho-bg)',
        'jericho-surface': 'var(--jericho-surface)',
        'jericho-text': 'var(--jericho-text)',
        'jericho-accent': 'var(--jericho-accent)'
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glass: '0 20px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        edge: '0 0 0 1px rgba(255,255,255,0.05)'
      },
      borderRadius: {
        xl: '18px'
      },
      spacing: {
        18: '4.5rem'
      },
      backgroundImage: {
        mesh:
          'radial-gradient(120% 120% at 20% 20%, rgba(120,120,255,0.08), rgba(0,0,0,0)), radial-gradient(100% 80% at 80% 0%, rgba(255,255,255,0.05), rgba(0,0,0,0))'
      }
    }
  },
  plugins: []
};
