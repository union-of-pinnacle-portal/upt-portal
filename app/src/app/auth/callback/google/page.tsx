"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";

/**
 * Google redirects back to this page after OAuth.
 * SuperTokens handles the token exchange automatically.
 */
export default function GoogleCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const response = await ThirdParty.signInAndUp();

      if (response.status === "OK") {
        router.push("/dashboard");
      } else {
        router.push("/auth/login?error=oauth_failed");
      }
    }
    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
