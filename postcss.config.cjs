const path = require('path');

const tailwindcss = require(path.resolve(__dirname, 'JERICHO/node_modules/tailwindcss'));
const autoprefixer = require(path.resolve(__dirname, 'JERICHO/node_modules/autoprefixer'));

module.exports = {
  plugins: [
    tailwindcss({
      config: path.resolve(__dirname, 'tailwind.config.cjs'),
    }),
    autoprefixer(),
  ],
};
