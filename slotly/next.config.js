const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
