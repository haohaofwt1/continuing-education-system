import { NextResponse } from "next/server";
import { getProductionReadiness } from "@/lib/production-readiness";

export async function GET() {
  const readiness = await getProductionReadiness();
  return NextResponse.json(readiness, { status: readiness.ready ? 200 : 503 });
}
