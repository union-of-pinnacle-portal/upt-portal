import { redirect } from "next/navigation";

/**
 * Root route is just an entry point into the portal. Send everyone to the
 * dashboard; if they have no session, the dashboard redirects them on to
 * /auth/login. There is no public landing page in P0.
 */
export default function Home() {
  redirect("/dashboard");
}
