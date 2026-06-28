"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: ReactNode;
}

export default function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container] = useState(() => {
    // Only runs on client — safe from SSR
    if (typeof document !== "undefined") {
      return document.createElement("div");
    }
    return null;
  });

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    document.body.style.overflow = "hidden";
    setMounted(true);
    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      document.body.style.overflow = "";
    };
  }, [container]);

  if (!mounted || !container) return null;

  return createPortal(children, container);
}
