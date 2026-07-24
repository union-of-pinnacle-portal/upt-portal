"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmailPassword from "supertokens-web-js/recipe/emailpassword";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";
import EmailVerification from "supertokens-web-js/recipe/emailverification";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginPageContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await EmailPassword.signIn({
      formFields: [
        { id: "email", value: email },
        { id: "password", value: password },
      ],
    });

    setIsSubmitting(false);

    if (response.status === "WRONG_CREDENTIALS_ERROR") {
      setError("Invalid email or password.");
      return;
    }

    if (response.status === "SIGN_IN_NOT_ALLOWED") {
      setError("Sign in not allowed. Please verify your email first.");
      return;
    }

    if (response.status !== "OK") {
      setError("Something went wrong. Please try again.");
      return;
    }

    const verificationStatus = await EmailVerification.isEmailVerified();
    if (!verificationStatus.isVerified) {
      router.push("/auth/verify-email");
      return;
    }
    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    const url = await ThirdParty.getAuthorisationURLWithQueryParamsAndSetState({
      thirdPartyId: "google",
      frontendRedirectURI: `${window.location.origin}/auth/callback/google`,
    });
    window.location.assign(url);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-6">
      <BrandLogo className="h-20" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Use your Google account or
            email and password.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {verified && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Email verified — sign in below.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-xs text-muted-foreground underline">Forgot password?</Link>
              </div>
                <Link href="/auth/forgot-password" className="text-xs text-muted-foreground underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}