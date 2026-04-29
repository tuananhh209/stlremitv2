import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Allow ts-jest to handle the project's tsconfig
          jsx: "react-jsx",
          esModuleInterop: true,
          moduleResolution: "node",
        },
      },
    ],
  },
  testMatch: [
    "**/tests/**/*.test.ts",
    "**/tests/**/*.test.tsx",
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx",
  ],
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/api/**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
};

export default config;
