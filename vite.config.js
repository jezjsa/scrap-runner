import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "CONVEX_"],
  server: {
    host: true,
    port: 5177,
    strictPort: true,
  },
});
