import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      cache: "no-store",
    });
    const backend = await response.json();

    return NextResponse.json({
      status: "ok",
      frontend: "healthy",
      backend,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        frontend: "healthy",
        backendError: err.message,
      },
      { status: 200 }
    );
  }
}

