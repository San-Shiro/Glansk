import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The Glansk Bun server serves the studio SPA from src/admin as FLAT files
// (src/secure-app.ts rejects any asset path containing "/"). So we emit every asset
// into the outDir root with no nested "assets/" folder, under the /admin/ base.
//
// Dev: `bun run dev` starts Vite on :5173 and proxies the API + widget iframes
// + shared renderer assets to the Bun backend on :3000.
export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The single source of truth for canvas rendering, shared with the kiosk.
      "@shared": fileURLToPath(new URL("../server/src/shared", import.meta.url)),
      "@glansk/shared": fileURLToPath(new URL("../../packages/shared/src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Allow importing the shared renderer that lives outside this Vite root.
    fs: { allow: [".", "../server/src/shared", "../../packages/shared/src"] },
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/widgets": "http://127.0.0.1:3000",
      "/shared": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
      "/uploads": "http://127.0.0.1:3000",
      // The kiosk display (index.html + flat assets) is served by the Bun
      // backend at /kiosk/. Proxy it so the admin "Open kiosk display" link
      // works during development on the Vite dev server.
      "/kiosk": "http://127.0.0.1:3000",
    },
  },
  build: {
    // Emit straight into the folder the Bun server serves as /admin/.
    outDir: "../server/src/admin",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
});
