import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (isProd ? "https://vsqc-platform-backend.vercel.app" : "http://localhost:5000");

const nextConfig: NextConfig = {
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
};

export default nextConfig;
