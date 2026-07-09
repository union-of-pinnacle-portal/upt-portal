"use client";

import SuperTokens from "supertokens-web-js";
import { frontendConfig } from "@/config/supertokens-frontend";

if (typeof window !== "undefined") {
  SuperTokens.init(frontendConfig);
}

export function SuperTokensProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}