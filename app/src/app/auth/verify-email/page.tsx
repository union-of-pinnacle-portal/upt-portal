"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EmailVerification from "supertokens-web-js/recipe/emailverification";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    async function handleVerification() {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (token) {
        setHasToken(true);
        try {
          const response = await EmailVerification.verifyEmail();
          if (response.status === "OK") {
            window.location.href = "/auth/login?verified=true";
            return;
          }
        } catch {
          // fall through
        }
        setHasToken(false);
        return;
      }

      const verified = await EmailVerification.isEmailVerified();
      if (verified.isVerified) {
        router.push("/dashboard");
      }
    }
    handleVerification();
  }, [router]);

  if (hasToken) {
    return (
      <div
        style={{
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "60px 20px",
          color: "#333",
        }}
      >
        <p style={{ fontSize: "16px" }}>Verifying your email...</p>
        <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
          You will be redirected to sign in shortly.
        </p>
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
            Did not receive it? Check your spam folder or resend below.
          </p>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              setIsResending(true);
              setMessage(null);
              const response = await EmailVerification.sendVerificationEmail();
              setIsResending(false);
              if (response.status === "EMAIL_ALREADY_VERIFIED_ERROR") {
                router.push("/dashboard");
              } else {
                setMessage("Verification email resent. Check your inbox.");
              }
            }}
            disabled={isResending}
          >
            {isResending ? "Resending..." : "Resend verification email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
