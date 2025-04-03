import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

// Initialize Redis client
const redis = new Redis(
  process.env.REDIS_URL || "redis://:mypassword@localhost:6379",
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");

  if (!fid) {
    return NextResponse.json({ error: "FID is required" }, { status: 400 });
  }

  try {
    // Fetch the last 10 attacks from the Redis list
    const attacks = await redis.lrange(`attacks:${fid}`, 0, 9);
    const attackLog = attacks.map((attack) => JSON.parse(attack));
    return NextResponse.json({ attacks: attackLog });
  } catch (error) {
    console.error("Error fetching attacks:", error);
    return NextResponse.json(
      { error: "Failed to fetch attacks" },
      { status: 500 },
    );
  }
}
