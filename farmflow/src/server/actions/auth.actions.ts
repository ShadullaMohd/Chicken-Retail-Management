"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

export async function loginAction(
  input: LoginInput
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid login details.",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          success: false,
          error: "Invalid email or password, or your account is inactive.",
        };
      }
      return {
        success: false,
        error: "Unable to sign in right now. Please try again.",
      };
    }
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
