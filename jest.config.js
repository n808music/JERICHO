export default {
  testEnvironment: "jsdom",
  verbose: false,
  collectCoverage: true,
  collectCoverageFrom: ["src/core/**/*.js"],
  coverageDirectory: "coverage",
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/JERICHO/'],
};
