"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export default function ThemeInitializer() {
  const darkMode = useAppStore((state) => state.darkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme"); // default light or explicitly 'light'
      root.setAttribute("data-theme", "light");
    }
  }, [darkMode]);

  return null;
}
