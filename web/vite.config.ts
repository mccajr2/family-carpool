import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dormant Spotify Playlist chrome (roadmap Carpool music parking).
 * Keep out of the default gate until music-provider-model / Apple Music.
 * Re-include with `VITEST_INCLUDE_PARKED=1` (`npm run test:parked`).
 */
const parkedPlaylistTests = [
  "**/RidePlaylistTab.test.tsx",
  "**/playlistClient.test.ts",
  "**/playlistRidersFromCalendarPlaylist.test.ts",
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.VITEST_INCLUDE_PARKED === "1" ? [] : parkedPlaylistTests),
    ],
  },
})
