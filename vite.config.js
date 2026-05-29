import { defineConfig } from "vite";

// GitHub Pages project sites need "/REPO_NAME/" as the base path.
// Override with VITE_BASE_PATH="/" for local root hosting or a custom domain.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/text-to-chem/"
});
