module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": ["@swc/jest"] },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testMatch: ["**/tests/**/*.test.ts"],
};
