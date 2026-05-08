const nestedConfig = require('./JERICHO/tailwind.config.cjs');

const nestedContent = Array.isArray(nestedConfig.content) ? nestedConfig.content : [];

module.exports = {
  ...nestedConfig,
  content: Array.from(
    new Set([
      './index.html',
      './src/**/*.{js,jsx,ts,tsx}',
      './JERICHO/index.html',
      './JERICHO/src/**/*.{js,jsx,ts,tsx}',
      ...nestedContent,
    ])
  ),
};
