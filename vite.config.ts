import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "https://zandani.co.ke",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [react()],
  ssr: {
    noExternal: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("@radix-ui")) return "ui";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("recharts")) return "charts";
            if (id.includes("framer-motion")) return "animations";
            return "vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
