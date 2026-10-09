/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // enables minimal Docker image via .next/standalone
  async rewrites() {
    // Proxy /backend/* to the API. Only emit the rewrite when BACKEND_URL is a
    // valid absolute http(s) URL — a missing or malformed value (e.g. a secret
    // pasted into the wrong env field) must NOT fail the production build.
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    if (!/^https?:\/\//.test(backendUrl)) {
      console.warn(
        `[next.config] Ignoring /backend proxy rewrite: BACKEND_URL is not a valid http(s) URL (got: "${backendUrl}").`
      );
      return [];
    }
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
