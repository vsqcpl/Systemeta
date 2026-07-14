"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="loading-screen">
      <img src="/logo.png" alt="Loading" className="loading-logo" style={{ background: "transparent", border: "none", boxShadow: "none", width: "50px", height: "50px", borderRadius: "14px", objectFit: "cover" }} />
      <div className="loading-text">Redirecting to login...</div>
      <div className="loading-bar">
        <div className="loading-bar-fill"></div>
      </div>
    </div>
  );
}
