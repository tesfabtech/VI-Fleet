import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LoginModalProvider } from "@/components/auth/login-modal-context";
import LoginModal from "@/components/auth/login-modal";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col">
        <LoginModalProvider>
          {children}
          <LoginModal />
        </LoginModalProvider>
      </body>
    </html>
  );
}
