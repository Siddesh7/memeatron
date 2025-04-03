import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

// Initialize Redis client (server-side only)
const redis = new Redis(
  process.env.REDIS_URL || "redis://:mypassword@localhost:6379",
);

// GET: Fetch HP for a user
export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } },
) {
  const { action } = params;
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");

  if (!fid) {
    return NextResponse.json({ error: "FID is required" }, { status: 400 });
  }

  if (action === "get-hp") {
    try {
      const hp = await redis.get(`hp:${fid}`);
      return NextResponse.json({ hp: hp ? parseInt(hp) : 100 });
    } catch (error) {
      console.error("Error fetching HP:", error);
      return NextResponse.json(
        { error: "Failed to fetch HP" },
        { status: 500 },
      );
    }
  } else if (action === "get-wins") {
    try {
      const wins = await redis.get(`wins:${fid}`);
      return NextResponse.json({ wins: wins ? parseInt(wins) : 0 });
    } catch (error) {
      console.error("Error fetching wins:", error);
      return NextResponse.json(
        { error: "Failed to fetch wins" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// POST: Update HP, increment wins, or log an attack
export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } },
) {
  const { action } = params;
  const body = await request.json();

  if (action === "set-hp") {
    const { fid, hp } = body;
    if (!fid || hp === undefined) {
      return NextResponse.json(
        { error: "FID and HP are required" },
        { status: 400 },
      );
    }

    try {
      await redis.set(`hp:${fid}`, hp);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error setting HP:", error);
      return NextResponse.json({ error: "Failed to set HP" }, { status: 500 });
    }
  } else if (action === "reset-hp") {
    const { fids } = body;
    if (!fids || !Array.isArray(fids)) {
      return NextResponse.json(
        { error: "FIDs array is required" },
        { status: 400 },
      );
    }

    try {
      for (const fid of fids) {
        await redis.set(`hp:${fid}`, 100);
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error resetting HP:", error);
      return NextResponse.json(
        { error: "Failed to reset HP" },
        { status: 500 },
      );
    }
  } else if (action === "increment-wins") {
    const { fid } = body;
    if (!fid) {
      return NextResponse.json({ error: "FID is required" }, { status: 400 });
    }

    try {
      await redis.incr(`wins:${fid}`);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error incrementing wins:", error);
      return NextResponse.json(
        { error: "Failed to increment wins" },
        { status: 500 },
      );
    }
  } else if (action === "log-attack") {
    const { fid, attack } = body;
    if (!fid || !attack) {
      return NextResponse.json(
        { error: "FID and attack data are required" },
        { status: 400 },
      );
    }

    try {
      // Store the attack as a JSON string in a Redis list
      await redis.lpush(`attacks:${fid}`, JSON.stringify(attack));
      // Keep only the last 10 attacks to avoid unbounded growth
      await redis.ltrim(`attacks:${fid}`, 0, 9);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error logging attack:", error);
      return NextResponse.json(
        { error: "Failed to log attack" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
