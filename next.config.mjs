import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes disabled: many programmatic nav targets are computed at runtime
  // (`/companies/${slug}`) and the typed-route plumbing creates more friction
  // than value for an internal tool. Re-enable once the route shape stabilizes.
  typedRoutes: false,
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
