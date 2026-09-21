"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EchoReachLogo } from "@/components/brand/echo-logo";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(searchParams.get("next") ?? "/home");
    router.refresh();
  }

  return (
    <main className="min-h-screen w-full bg-white flex flex-col justify-center items-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-[390px] flex flex-col animate-in fade-in-50 duration-200">
        {/* Brand Logo */}
        <div className="mb-4">
          <EchoReachLogo className="w-[50px] h-[40px]" />
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-[26px] font-semibold text-[#001f3e] tracking-tight">
            Welcome back!
          </h1>
          <p className="text-sm text-[#6e8298] mt-1">
            Enter your account details to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive" className="rounded-[8px] py-2 px-3">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-[#242b33]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              placeholder="clinician@health.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-[8px] border-[#e4e8ec] bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-[#242b33]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-[8px] border-[#e4e8ec] bg-white"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-[12px] mt-2 cursor-pointer text-sm font-medium bg-[#0073F3] hover:bg-[#0062d4] text-white"
          >
            {loading ? "Signing in..." : "Continue"}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-[#6e8298]">
          ECHO / REACH Clinical Encounter System
        </p>
      </div>
    </main>
  );
}
