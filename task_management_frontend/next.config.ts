import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export means the app is served as plain files. Any API calls must use
  // an ABSOLUTE base URL at runtime (cannot rely on same-origin /api).
  output: "export",

  // Required for `next export` when using <Image/> (even if not used today).
  images: { unoptimized: true },
};

export default nextConfig;
