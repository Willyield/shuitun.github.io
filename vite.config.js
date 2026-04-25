import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/shuitun.github.io/",
  plugins: [react()]
});
