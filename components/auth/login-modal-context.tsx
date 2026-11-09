"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type LoginModalContextType = {
  isLoginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
};

const LoginModalContext = createContext<LoginModalContextType>({
  isLoginOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
});

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  function openLogin() {
    setIsLoginOpen(true);
  }

  function closeLogin() {
    setIsLoginOpen(false);
  }

  useEffect(() => {
    // 1. Close on ESC key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsLoginOpen(false);
      }
    }

    // 2. Open on #login or ?login=true URL
    if (typeof window !== "undefined") {
      if (window.location.hash === "#login" || window.location.search.includes("login=true")) {
        setIsLoginOpen(true);
      }
    }

    // 3. Global click interceptor: any click on a "Sign in" / "/login" link opens the popup
    function handleGlobalClick(e: MouseEvent) {
      // Don't intercept if already on the dedicated /login route
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't intercept clicks inside the open modal itself
      if (target.closest('[role="dialog"]')) {
        return;
      }

      // Check if target is a link/button intended for login
      const loginTarget = target.closest<HTMLElement>(
        'a[href="/login"], a[href="#login"], button[data-login-trigger], [data-auth="login"]'
      );

      if (loginTarget) {
        e.preventDefault();
        setIsLoginOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleGlobalClick, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, []);

  // Prevent background scrolling when modal is active
  useEffect(() => {
    if (isLoginOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isLoginOpen]);

  return (
    <LoginModalContext.Provider value={{ isLoginOpen, openLogin, closeLogin }}>
      {children}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  return useContext(LoginModalContext);
}
