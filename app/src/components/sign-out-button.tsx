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

  // `sm` matches the header's other actions (they were previously mismatched
  // heights), and `ghost` keeps sign out from competing with the primary
  // action next to it.
  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}