"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * /auth/setup
 *
 * Shown exactly once after a user's first login (email/password or Google).
 * Lets them optionally enter an admin access code to get committee_head role.
 * If they skip or enter nothing, they stay as general member.
 *
 * After this page (submit or skip), they go to /dashboard and never see
 * this page again — setupComplete is stored in their UserMetadata.
 */
export default function SetupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleAssigned, setRoleAssigned] = useState<string | null>(null);

  // Get the current user's ID from the session
  async function getUserId(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/session-user-id");
      if (!res.ok) return null;
      const data = await res.json();
      return data.userId ?? null;
    } catch {
      return null;
    }
  }

  async function markSetupComplete(userId: string) {
    await fetch("/api/auth/set-admin-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        secret: "",
        markSetupOnly: true,
      }),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const userId = await getUserId();
    if (!userId) {
      router.push("/auth/login");
      return;
    }

    await markSetupComplete(userId);
    router.push("/dashboard");
    setIsSubmitting(false);
  }

  async function handleSkip() {
    const userId = await getUserId();
    if (userId) await markSetupComplete(userId);
    router.push("/dashboard");
  }

  if (roleAssigned === "committee_head") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-6">
        <BrandLogo className="h-20" />
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome, Committee Head</CardTitle>
            <CardDescription>
              Your admin access code was accepted. You have been assigned the
              committee head role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-6">
      <BrandLogo className="h-20" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to UPT Portal</CardTitle>
          <CardDescription>
            If you have an admin access code, enter it below. Otherwise skip to
            continue as a general member.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Continuing…" : "Continue"}
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <button
            onClick={handleSkip}
            className="w-full text-center text-sm text-muted-foreground underline"
          >
            Skip — I don&apos;t have a code
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
