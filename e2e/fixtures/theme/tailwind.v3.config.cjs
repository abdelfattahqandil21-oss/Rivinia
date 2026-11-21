const colors = [
  'primary',
  'surface',
  'surface-raised',
  'text',
  'text-muted',
  'border',
  'focus',
  'danger',
  'success',
  'info',
  'warning',
];

module.exports = {
  content: ['./e2e/fixtures/theme/src/**/*.{html,ts}'],

  theme: {
    extend: {
      colors: Object.fromEntries(
        colors.map((name) => [
          `rv-${name}`,
          `var(--rv-color-${name})`,
        ]),
      ),

      spacing: {
        'rv-1': 'var(--rv-space-1)',
        'rv-2': 'var(--rv-space-2)',
        'rv-3': 'var(--rv-space-3)',
        'rv-4': 'var(--rv-space-4)',
      },

      borderRadius: {
        'rv-sm': 'var(--rv-radius-sm)',
        'rv-md': 'var(--rv-radius-md)',
        'rv-lg': 'var(--rv-radius-lg)',
      },

      boxShadow: {
        'rv-md': 'var(--rv-shadow-md)',
      },

      fontFamily: {
        rv: ['var(--rv-font-family)'],
      },
    },
  },
};
