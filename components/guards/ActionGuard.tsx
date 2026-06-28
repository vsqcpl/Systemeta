"use client";

import React from "react";
import { usePermission } from "@/hooks/usePermission";

interface ActionGuardProps {
  action: string;
  children: React.ReactNode;
}

/**
 * Renders children only if the current user can perform the action.
 * DO NOT disable — hide entirely. Disabled buttons imply access is possible.
 */
export default function ActionGuard({ action, children }: ActionGuardProps) {
  const { canDo } = usePermission();
  if (!canDo(action)) return null;
  return <>{children}</>;
}
