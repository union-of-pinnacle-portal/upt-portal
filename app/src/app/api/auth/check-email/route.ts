import { NextRequest, NextResponse } from "next/server";
import supertokens from "supertokens-node";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ existsViaGoogle: false });

  const users = await supertokens.listUsersByAccountInfo("public", { email });
  const existsViaGoogle = users.some((u) =>
    u.loginMethods.some((m) => m.recipeId === "thirdparty"),
  );

  return NextResponse.json({ existsViaGoogle });
}