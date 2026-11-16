import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LoginModalProvider } from "@/components/auth/login-modal-context";
import LoginModal from "@/components/auth/login-modal";
import WorkspaceThemeSync from "@/components/dashboard/workspace-theme-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VI-Fleet - Vehicle Management System",
  description: "Enterprise vehicle and fleet management platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("vi-fleet-theme")||"light";var p=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=(t==="dark"||(t==="system"&&p))?"dark":"light";document.documentElement.setAttribute("data-vi-theme",r);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <WorkspaceThemeSync />
        <LoginModalProvider>
          {children}
          <LoginModal />
        </LoginModalProvider>
      </body>
    </html>
  );
}
