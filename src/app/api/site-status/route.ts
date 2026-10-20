import { NextRequest, NextResponse } from "next/server";
import { ORDER_API_BASE } from "@/lib/api/orderApi";
import { siteStatusQuery } from "@/lib/visitorId";

export const dynamic = "force-dynamic";

const ALWAYS_OPEN = process.env.ALWAYS_OPEN === "1";
const STAGING_HOST = process.env.STAGING_HOST ?? "";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isStaging = STAGING_HOST !== "" && host.startsWith(STAGING_HOST);
  if (ALWAYS_OPEN || isStaging) {
    return NextResponse.json({ siteClosed: false, alwaysOpen: true, activeVisitors: 0 });
  }

  try {
    const url = ORDER_API_BASE
      ? `${ORDER_API_BASE}/site-status?${siteStatusQuery(request)}`
      : null;

    if (!url) {
      return NextResponse.json({ siteClosed: false, activeVisitors: 0 });
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json({ siteClosed: false, activeVisitors: 0 });
    }

    const data = (await res.json()) as { siteClosed?: boolean; activeVisitors?: number };
    return NextResponse.json({
      siteClosed: data.siteClosed === true,
      activeVisitors: data.activeVisitors ?? 0,
    });
  } catch {
    return NextResponse.json({ siteClosed: false, activeVisitors: 0 });
  }
}
