"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EmailVerification from "supertokens-web-js/recipe/emailverification";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function handleVerification() {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (token) {
        setVerifying(true);
        try {
          const response = await EmailVerification.verifyEmail();
          if (response.status === "OK") {
            // Go to setup page for admin code prompt on first login
            router.push("/auth/setup");
            return;
          } else {
            setMessage("Verification failed. The link may have expired.");
          }
        } catch {
          setMessage("Something went wrong. Please try resending.");
        }
        setVerifying(false);
        return;
      }

      // No token — check if already verified
      const verified = await EmailVerification.isEmailVerified();
      if (verified.isVerified) {
        router.push("/dashboard");
      }
    }
    handleVerification();
  }, [router]);

  async function handleResend() {
    setIsResending(true);
    setMessage(null);
    const response = await EmailVerification.sendVerificationEmail();
    setIsResending(false);
    if (response.status === "EMAIL_ALREADY_VERIFIED_ERROR") {
      router.push("/dashboard");
    } else {
      setMessage("Verification email resent. Check your inbox.");
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-6">
      <BrandLogo className="h-20" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click it to
            activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder or resend below.
          </p>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
          <Button variant="outline" onClick={handleResend} disabled={isResending}>
            {isResending ? "Resending…" : "Resend verification email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
