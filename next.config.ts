import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The floating "N" badge of next dev: build errors still show in an overlay.
  devIndicators: false,
  experimental: {
    // Keeps .next small: the build cache only helps CI pipelines that restore it.
    turbopackFileSystemCacheForBuild: false,
  },
  // PGlite ships a WASM build of Postgres and reads its own files at runtime:
  // it must be loaded by Node, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
