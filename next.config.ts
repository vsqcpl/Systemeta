import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (isProd ? "https://vsqc-platform-backend.vercel.app" : "http://localhost:5000");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.9", "192.168.1.9:3000", "localhost", "localhost:3000", "127.0.0.1", "0.0.0.0"],
  poweredByHeader: false,
  async headers() {
    const isEnforced = process.env.CSP_ENFORCE === "true";
    const cspKey = isEnforced ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
    const cspValue = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'";

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: cspKey,
            value: cspValue,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/:path(dashboard|projects|timesheets|billing|tasks|leave|expenses|audit|client-manager|admin|portfolio|timesheet|my-tasks|portal|settings)/:nested*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        source: "/:path(dashboard|projects|timesheets|billing|tasks|leave|expenses|audit|client-manager|admin|portfolio|timesheet|my-tasks|portal|settings)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/admin/users",
        destination: "/admin",
      },
      {
        source: "/portfolio",
        destination: "/projects",
      },
      {
        source: "/timesheet",
        destination: "/timesheets",
      },
      {
        source: "/my-tasks",
        destination: "/tasks",
      },
      {
        source: "/billing/milestones",
        destination: "/billing",
      },
      {
        source: "/portal",
        destination: "/projects",
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      jspdf$: "jspdf/dist/jspdf.umd.min.js",
      canvg$: false,
      "core-js": false,
    };
    return config;
  },
};

export default nextConfig;
