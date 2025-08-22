import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createHtmlPlugin } from "vite-plugin-html";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    assetsInlineLimit: 0, // Prevents small assets from inlining as data URIs
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          csp: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co;"
        }
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
