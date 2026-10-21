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
  ]),
  {
    /**
     * React Compiler's immutability rule assumes values from hooks are never
     * mutated. React Three Fiber is built on the opposite premise: `useFrame`
     * exists precisely so you can mutate three.js objects (meshes, cameras,
     * uniforms) in place, 60+ times a second. Going through state instead would
     * mean a React render per frame — the exact thing this architecture avoids.
     *
     * Scoped to the WebGL layer only, so the rule keeps protecting the DOM
     * components where it genuinely applies.
     */
    files: ["src/components/canvas/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
