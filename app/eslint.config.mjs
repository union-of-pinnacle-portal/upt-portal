import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node CommonJS admin/migration utilities — run directly via
    // `node --env-file`, never bundled into the app. The Next.js TS config
    // forbids `require()`, which is the only way these can load their deps.
    "scripts/**",
  ]),
]);

export default eslintConfig;
