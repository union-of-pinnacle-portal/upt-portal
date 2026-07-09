import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import supertokens from "supertokens-node";
import { getSSRSession } from "supertokens-node/lib/build/nextjs";
import { getBackendConfig } from "@/config/supertokens-backend";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

supertokens.init(getBackendConfig());

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();

  const { accessTokenPayload, hasToken, error } = await getSSRSession(cookieList);

  if (error) {
    redirect("/auth/login");
  }

  if (!hasToken || !accessTokenPayload) {
    redirect("/auth/login");
  }

  const role = (accessTokenPayload as { role?: string }).role ?? "general";
  const email = (accessTokenPayload as { email?: string }).email ?? "";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Dashboard</CardTitle>
          <CardDescription>
            {email} · Role: <strong>{role}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You&apos;re logged in to the UPT Portal.
          </p>
        </CardContent>
        <CardFooter>
          <SignOutButton />
        </CardFooter>
      </Card>
    </div>
  );
}