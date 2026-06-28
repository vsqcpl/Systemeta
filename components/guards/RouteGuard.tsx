"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { canAccessScreen } from "@/lib/permissionHelpers";
import { UserRole } from "@/lib/roles";

function PageLoadingSkeleton() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">VS</div>
      <div className="loading-text">Loading workspace...</div>
      <div className="loading-bar">
        <div className="loading-bar-fill"></div>
      </div>
    </div>
  );
}

interface RouteGuardProps {
  screenKey: string;
  children: React.ReactNode;
}

export default function RouteGuard({ screenKey, children }: RouteGuardProps) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // wait for rehydration

    // Not logged in → send to login
    if (status === "unauthenticated" || !user) {
      router.replace("/login");
      return;
    }

    // Must change password → send to change-password
    // Exception: change-password page itself must pass through
    if (user.must_change_password && screenKey !== "change_password") {
      router.replace("/change-password");
      return;
    }

    // Role not permitted for this screen → send to /403
    if (!canAccessScreen(screenKey, user.role as UserRole)) {
      router.replace("/403");
      return;
    }
  }, [status, user, screenKey, router]);

  // Show nothing while auth state resolves — use existing loading skeleton
  if (status === "loading") {
    return <PageLoadingSkeleton />;
  }

  // Show nothing while redirecting
  if (!user || !canAccessScreen(screenKey, user.role as UserRole)) {
    return null;
  }

  // If forced to change password and we're not on the change-password page, show nothing (redirect is pending)
  if (user.must_change_password && screenKey !== "change_password") {
    return null;
  }

  return <>{children}</>;
}
