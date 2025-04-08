/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    domains: ["a.ltrbxd.com"], // Add the hostname here
  },
  assetPrefix: isProd ? "/what-do-i-watch/" : "",
  basePath: isProd ? "/what-do-i-watch" : "",
};

export default nextConfig;
