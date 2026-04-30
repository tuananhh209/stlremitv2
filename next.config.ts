import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker/Railway deployment — creates .next/standalone
  output: "standalone",

  // Allow images from Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  reactStrictMode: true,
};

export default nextConfig;
