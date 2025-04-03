import { NextResponse } from "next/server";
import Redis from "ioredis";

// Initialize Redis client
const redis = new Redis(
  process.env.REDIS_URL || "redis://:mypassword@localhost:6379",
);

export async function GET() {
  try {
    // Get all keys matching "wins:*"
    const winKeys = await redis.keys("wins:*");
    if (winKeys.length === 0) {
      return NextResponse.json({ leaderboard: [] });
    }

    // Fetch win counts for all users
    const leaderboard: { fid: number; username: string; wins: number }[] = [];
    for (const key of winKeys) {
      const fid = parseInt(key.split(":")[1]);
      const wins = parseInt((await redis.get(key)) || "0");

      // Fetch username from Neynar API
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        {
          headers: {
            accept: "application/json",
            "x-api-key":
              process.env.NEXT_PUBLIC_NEYNAR_API_KEY || "NEYNAR_API_DOCS",
          },
        },
      );

      if (!response.ok) {
        console.error(`Failed to fetch user ${fid}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const user = data.users[0];
      if (user && user.username) {
        leaderboard.push({ fid, username: user.username, wins });
      }
    }

    // Sort by wins (descending)
    leaderboard.sort((a, b) => b.wins - a.wins);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
