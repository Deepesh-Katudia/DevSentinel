import { NextRequest, NextResponse } from "next/server";
import { createSmokeSignup } from "@/lib/auth-smoke";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const result = await createSmokeSignup({
    email,
    password,
    fullName: body.fullName,
    secret: request.headers.get("x-auth-smoke-secret"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(
    {
      success: true,
      data: result.user,
    },
    { status: result.status }
  );
}
