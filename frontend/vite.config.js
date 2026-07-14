import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const assetVersion = process.env.CODEX_WEB_ASSET_VERSION ?? Date.now().toString(36);

export default defineConfig({
  plugins: [react(), tailwindcss(), versionedAssetUrls()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
  },
});

function versionedAssetUrls() {
  return {
    name: "codex-web-versioned-assets",
    transformIndexHtml(html) {
      return html.replace(
        /\b(src|href)="(\/assets\/[^"?]+?\.(?:js|css))"/g,
        `$1="$2?v=${assetVersion}"`,
      );
    },
  };
}
