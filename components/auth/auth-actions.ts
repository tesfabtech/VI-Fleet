"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return { error: "Please enter both email and password." };
  }

  try {
    await signIn("credentials", {
      email: email.trim(),
      password,
      redirectTo: "/dashboard",
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            error: "Invalid email or password. Please check your credentials.",
          };
        case "AccessDenied":
          return {
            error: "Access denied. Your account is not active or authorized.",
          };
        default:
          return {
            error: "Authentication failed. Please try again.",
          };
      }
    }

    // Preserve Next.js redirect thrown by NextAuth on successful login
    throw error;
  }
}
