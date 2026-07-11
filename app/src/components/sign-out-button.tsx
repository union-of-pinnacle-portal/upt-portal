"use client";

import { Button } from "@/components/ui/button";
import Session from "supertokens-web-js/recipe/session";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await Session.signOut();
    router.push("/auth/login");
  }

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}