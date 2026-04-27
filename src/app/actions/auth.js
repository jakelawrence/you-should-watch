"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function credentialsSignIn(email, password, callbackUrl = "/") {
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error; // re-throw NEXT_REDIRECT so Next.js handles the navigation
  }
}
