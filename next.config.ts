import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Pin the workspace root to the directory this config belongs to. Without
  // it, Next infers the root from the nearest lockfile up the tree, which
  // inside a git worktree points at the outer checkout and breaks the
  // build (and makes the dev server watch unrelated files).
  turbopack: {
    root: process.cwd(),
  },
  // The Playwright harness runs its own dev server beside the operator's
  // port-3000 server. Next refuses a second dev server on the same dist dir,
  // so the harness sets SPAR_E2E_DIST to keep its build output separate.
  ...(process.env.SPAR_E2E_DIST ? { distDir: process.env.SPAR_E2E_DIST } : {}),
};

export default nextConfig;
