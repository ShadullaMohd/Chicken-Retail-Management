"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginAction } from "@/server/actions/auth.actions";

interface LoginFormProps {
  isDev?: boolean;
}

const DEV_ACCOUNTS = [
  { label: "Owner", email: "owner@farmflow.in", pass: "Owner@123" },
  { label: "Manager", email: "manager.main@farmflow.in", pass: "Manager@123" },
  { label: "Sales Staff", email: "sales.main@farmflow.in", pass: "Sales@123" },
];

export function LoginForm({ isDev = false }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    const result = await loginAction(values);

    if (!result.success) {
      setServerError(result.error ?? "Unable to sign in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const fillDevAccount = (email: string, pass: string) => {
    setServerError(null);
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#17212B] text-center">
        Welcome Back
      </h2>
      <p className="text-base text-gray-500 text-center mt-1 mb-6">
        Sign in to manage your chicken shops
      </p>

      {serverError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm sm:text-base text-red-700"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base font-medium text-[#17212B]">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="owner@farmflow.in"
              className="pl-11 h-12 text-base"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-base font-medium text-[#17212B]"
          >
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pl-11 pr-11 h-12 text-base"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-lg font-semibold bg-[#079B50] hover:bg-[#067A3F] text-white cursor-pointer"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Signing In...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      {isDev && (
        <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Development Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEV_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDevAccount(acc.email, acc.pass)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-xs font-medium text-[#17212B] hover:border-[#079B50] hover:bg-[#E9F8EF]/50 transition-colors cursor-pointer"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
