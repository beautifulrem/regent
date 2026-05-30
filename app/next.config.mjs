/** @type {import('next').NextConfig} */
const nextConfig = {
  // the repo's root eslint already covers TS; keep next build focused on compilation
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@mandate/shared'],
  webpack: (config) => {
    // wagmi's WalletConnect / MetaMask-SDK code paths reference optional deps this
    // injected-only demo never uses. Alias them to an empty module so webpack neither
    // warns about resolving them NOR emits an invalid bare-identifier external (the
    // latter crashed the browser bundle with "Invalid or unexpected token").
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      lokijs: false,
      encoding: false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
