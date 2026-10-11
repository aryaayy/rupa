import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost", port: 5173, strictPort: true,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false, rewrite: path => path.replace(/^\/api/, "") } },
  },
});
