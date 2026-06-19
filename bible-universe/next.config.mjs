/** @type {import('next').NextConfig} */
const nextConfig = {
  output:      'export',        // static HTML/JS/CSS — no Node server required
  assetPrefix: '.',             // relative asset paths: ./_next/... works at any subpath
  distDir:     '../universe',   // output to repo-root/universe/ for Cloudflare to serve

  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  webpack(config) {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
