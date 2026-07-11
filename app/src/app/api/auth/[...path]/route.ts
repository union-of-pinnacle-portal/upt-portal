import { NextRequest } from "next/server";
import supertokens from "supertokens-node";
import { getAppDirRequestHandler } from "supertokens-node/lib/build/nextjs";
import { getBackendConfig } from "@/config/supertokens-backend";

let initialized = false;

function ensureInit() {
  if (!initialized) {
    supertokens.init(getBackendConfig());
    initialized = true;
  }
}

ensureInit();

const handleRequest = getAppDirRequestHandler();

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}