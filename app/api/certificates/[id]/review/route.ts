import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "CERTIFICATE_APPROVAL_WORKFLOW_REMOVED", message: "Certificates are calculated automatically by cycle rules." },
    { status: 410 }
  );
}
