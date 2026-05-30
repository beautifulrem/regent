/** @type {import('next').NextConfig} */
const nextConfig = {
  // the repo's root eslint already covers TS; keep next build focused on compilation
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@mandate/shared'],
};

export default nextConfig;
