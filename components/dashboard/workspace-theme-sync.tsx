"use client";

import { useEffect } from "react";

export function applyWorkspaceThemeFromStorage() {
  if (typeof window === "undefined") return;

  const savedTheme = localStorage.getItem("vi-fleet-theme") || "light";
  const savedAccent = localStorage.getItem("vi-fleet-accent") || "blue";

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    savedTheme === "dark" || (savedTheme === "system" && prefersDark)
      ? "dark"
      : "light";

  const root = document.documentElement;
  root.setAttribute("data-vi-theme", resolvedTheme);
  root.setAttribute("data-vi-accent", savedAccent);
}

export default function WorkspaceThemeSync() {
  useEffect(() => {
    applyWorkspaceThemeFromStorage();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyWorkspaceThemeFromStorage();

    window.addEventListener("vi-fleet-theme-change", handleChange);
    window.addEventListener("storage", handleChange);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      window.removeEventListener("vi-fleet-theme-change", handleChange);
      window.removeEventListener("storage", handleChange);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return null;
}