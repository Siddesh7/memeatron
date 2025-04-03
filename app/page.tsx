"use client";

import { useEffect, useState } from "react";
import {
  useMiniKit,
  useAddFrame,
  useNotification,
  useClose,
} from "@coinbase/onchainkit/minikit";

// Define game-specific interfaces
interface Weapon {
  name: string;
  flavor: string;
}

interface Opponent {
  fid: number;
  username: string;
  hp: number;
}

interface LeaderboardEntry {
  fid: number;
  username: string;
  wins: number;
}

interface AttackEntry {
  attacker: string;
  weapon: string;
  damage: number;
  timestamp: string;
}

// Neynar API response types
interface FollowingResponse {
  users: Array<{
    user: {
      fid: number;
      username: string;
    };
  }>;
  next?: {
    cursor: string | null;
  };
}

interface UserSearchResponse {
  result: {
    users: Array<{
      fid: number;
      username: string;
    }>;
    next: {
      cursor: string | null;
    };
  };
}

// Hardcoded FIDs for testing
const SIDDESH_FID = 252720; // Siddesh's FID
const PRIVYCHAT_FID = 456; // Replace with Privychat's actual FID

const weapons: Weapon[] = [
  { name: "Laser Shiba", flavor: "Woof woof, you’re broke!" },
  { name: "Glitter Pepe", flavor: "Rare and explosive, just like my NFT." },
  { name: "Doge Slingshot", flavor: "Much damage, wow!" },
  {
    name: "Moon Lambo",
    flavor: "Vroom vroom, straight to the moon—and your face.",
  },
  { name: "Dancing Vitalik", flavor: "Smart contract this, punk!" },
];

const MemeATron3000: React.FC = () => {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const addFrame = useAddFrame();
  const sendNotification = useNotification();
  const close = useClose();

  // Player state
  const [hp, setHp] = useState<number>(100);
  const [weapon, setWeapon] = useState<Weapon | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [notificationToken, setNotificationToken] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [attackMessage, setAttackMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [attackLog, setAttackLog] = useState<AttackEntry[]>([]);

  // Initialize frame
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Assign random weapon on join
  useEffect(() => {
    if (!weapon) {
      const randomIndex: number = Math.floor(Math.random() * weapons.length);
      setWeapon(weapons[randomIndex]);
    }
  }, [weapon]);

  // Fetch HP from API
  const fetchHp = async (fid: number): Promise<number> => {
    const response = await fetch(`/api/redis/get-hp?fid=${fid}`);
    const data = await response.json();
    if (data.error) {
      console.error(data.error);
      return 100; // Default HP
    }
    return data.hp;
  };

  // Set HP via API
  const setHpApi = async (fid: number, hp: number): Promise<void> => {
    const response = await fetch("/api/redis/set-hp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid, hp }),
    });
    const data = await response.json();
    if (data.error) {
      console.error(data.error);
    }
  };

  // Reset HP via API
  const resetHpApi = async (fids: number[]): Promise<void> => {
    const response = await fetch("/api/redis/reset-hp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fids }),
    });
    const data = await response.json();
    if (data.error) {
      console.error(data.error);
    }
  };

  // Increment wins via API
  const incrementWins = async (fid: number): Promise<void> => {
    const response = await fetch("/api/redis/increment-wins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid }),
    });
    const data = await response.json();
    if (data.error) {
      console.error(data.error);
    }
  };

  // Log an attack via API
  const logAttack = async (fid: number, attack: AttackEntry): Promise<void> => {
    const response = await fetch("/api/redis/log-attack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid, attack }),
    });
    const data = await response.json();
    if (data.error) {
      console.error(data.error);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/leaderboard");
      const data = await response.json();
      if (data.error) {
        console.error(data.error);
        return;
      }
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  };

  // Fetch attack log
  const fetchAttackLog = async (fid: number) => {
    try {
      const response = await fetch(`/api/attacks?fid=${fid}`);
      const data = await response.json();
      if (data.error) {
        console.error(data.error);
        return;
      }
      setAttackLog(data.attacks);
    } catch (error) {
      console.error("Failed to fetch attack log:", error);
    }
  };

  // Fetch opponents and ensure the other account is included
  useEffect(() => {
    const fetchOpponents = async () => {
      if (!context?.user?.fid) {
        setOpponents([]);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch player's HP
        const playerHp = await fetchHp(context.user.fid);
        setHp(playerHp);
        if (playerHp === 100) {
          await setHpApi(context.user.fid, 100);
        }

        // Fetch attack log
        await fetchAttackLog(context.user.fid);

        // Fetch leaderboard
        await fetchLeaderboard();

        // Fetch opponents from Neynar API
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/following?fid=${context.user.fid}&limit=5`,
          {
            headers: {
              accept: "application/json",
              "x-api-key":
                process.env.NEXT_PUBLIC_NEYNAR_API_KEY || "NEYNAR_API_DOCS",
              "x-neynar-experimental": "false",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as FollowingResponse;
        const fetchedOpponents: Opponent[] = [];

        // Fetch or initialize HP for each opponent
        for (const entry of data.users) {
          const opponent = entry.user;
          if (!opponent.username) continue;

          const opponentHp = await fetchHp(opponent.fid);
          if (opponentHp === 100) {
            await setHpApi(opponent.fid, 100);
          }

          fetchedOpponents.push({
            fid: opponent.fid,
            username: opponent.username,
            hp: opponentHp,
          });
        }

        // Ensure the other account is included
        const currentFid = context.user.fid;
        let otherAccount: { fid: number; username: string } | null = null;

        if (currentFid === SIDDESH_FID) {
          otherAccount = { fid: PRIVYCHAT_FID, username: "privychat" };
        } else if (currentFid === PRIVYCHAT_FID) {
          otherAccount = { fid: SIDDESH_FID, username: "siddesh" };
        }

        if (
          otherAccount &&
          !fetchedOpponents.some((o) => o.fid === otherAccount!.fid)
        ) {
          const otherHp = await fetchHp(otherAccount.fid);
          if (otherHp === 100) {
            await setHpApi(otherAccount.fid, 100);
          }
          fetchedOpponents.push({
            fid: otherAccount.fid,
            username: otherAccount.username,
            hp: otherHp,
          });
        }

        setOpponents(fetchedOpponents);
      } catch (error) {
        console.error("Failed to fetch opponents:", error);
        setOpponents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpponents();
  }, [context]);

  // Search for a user by username
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a username to search.");
      return;
    }

    setSearchError("");
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            accept: "application/json",
            "x-api-key":
              process.env.NEXT_PUBLIC_NEYNAR_API_KEY || "NEYNAR_API_DOCS",
            "x-neynar-experimental": "false",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as UserSearchResponse;
      const user = data.result.users[0];

      if (!user) {
        setSearchError("User not found.");
        return;
      }

      // Check if the user is already an opponent
      if (opponents.some((o) => o.fid === user.fid)) {
        setSearchError("User is already an opponent.");
        return;
      }

      // Add the user as an opponent
      const userHp = await fetchHp(user.fid);
      if (userHp === 100) {
        await setHpApi(user.fid, 100);
      }

      setOpponents((prev) => [
        ...prev,
        { fid: user.fid, username: user.username, hp: userHp },
      ]);
      setSearchQuery(""); // Clear the search bar
    } catch (error) {
      console.error("Failed to search user:", error);
      setSearchError("Failed to search user. Please try again.");
    }
  };

  // Post a cast to Farcaster using Neynar API
  const postCast = async (text: string) => {
    try {
      const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key":
            process.env.NEXT_PUBLIC_NEYNAR_API_KEY || "NEYNAR_API_DOCS",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          signer_uuid: "YOUR_SIGNER_UUID", // Replace with actual signer UUID
          text: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to post cast: ${response.status}`);
      }

      const data = await response.json();
      console.log("Cast posted:", data);
    } catch (error) {
      console.error("Error posting cast:", error);
    }
  };

  // Handle adding frame for notifications
  const handleAddFrame = async (): Promise<void> => {
    const result = await addFrame();
    if (result) {
      setNotificationToken(result.token);
      console.log("Frame added:", result.url, result.token);
    }
  };

  // Attack logic with Redis updates via API
  const handleAttack = async (opponent: Opponent): Promise<void> => {
    const damage: number = Math.floor(Math.random() * 21) + 10; // 10-30 damage
    const newHp: number = Math.max(0, opponent.hp - damage);

    // Log the attack in the opponent's attack log
    const attackEntry: AttackEntry = {
      attacker: context?.user?.username || "Unknown",
      weapon: weapon?.name || "Unknown",
      damage,
      timestamp: new Date().toISOString(),
    };
    await logAttack(opponent.fid, attackEntry);

    // Update opponent's HP via API
    await setHpApi(opponent.fid, newHp);
    setOpponents((prev: Opponent[]) =>
      prev.map((o) => (o.fid === opponent.fid ? { ...o, hp: newHp } : o)),
    );

    // Attack feedback
    const attackText = `💥 @${context?.user?.username} hit @${opponent.username} with ${weapon?.name} for ${damage} damage!`;
    setAttackMessage(attackText);

    // Post a public cast
    if (context?.user?.username && weapon) {
      await postCast(attackText);
    }

    // Notify opponent (private notification)
    if (
      notificationToken &&
      context?.user?.fid &&
      context?.user?.username &&
      weapon
    ) {
      await sendNotification({
        title: `${weapon.name} Strike!`,
        body: `@${context.user.username} hit you with "${weapon.flavor}" for ${damage} damage!`,
      });
    }

    // Simulate retaliation (50% chance)
    if (Math.random() > 0.5 && hp > 0) {
      const retaliationDamage: number = Math.floor(Math.random() * 21) + 10;
      const newPlayerHp = Math.max(0, hp - retaliationDamage);

      // Log the retaliation in the player's attack log
      const retaliationEntry: AttackEntry = {
        attacker: opponent.username,
        weapon: "Retaliation Strike",
        damage: retaliationDamage,
        timestamp: new Date().toISOString(),
      };
      await logAttack(context?.user?.fid!, retaliationEntry);

      // Update player's HP via API
      await setHpApi(context?.user?.fid!, newPlayerHp);
      setHp(newPlayerHp);

      const retaliationText = `🔥 @${opponent.username} fought back for ${retaliationDamage} damage!`;
      setAttackMessage((prev) => `${prev}\n${retaliationText}`);
      await postCast(retaliationText);
    }

    // Clear attack message after 3 seconds
    setTimeout(() => setAttackMessage(""), 3000);
  };

  // Reset HP on game over and increment wins if the player won
  const resetGame = async () => {
    if (context?.user?.fid) {
      const fids = [context.user.fid, ...opponents.map((o) => o.fid)];
      await resetHpApi(fids);
      setHp(100);
      setOpponents((prev) => prev.map((o) => ({ ...o, hp: 100 })));

      // Increment wins if the player won
      if (hp > 0) {
        await incrementWins(context.user.fid);
        // Refresh leaderboard
        await fetchLeaderboard();
      }
    }
  };

  // Check game over
  const isGameOver: boolean =
    !isLoading &&
    (hp <= 0 || (opponents.length > 0 && opponents.every((o) => o.hp <= 0)));

  // Reset game when game over
  useEffect(() => {
    if (isGameOver) {
      setTimeout(() => {
        resetGame();
      }, 5000); // Reset after 5 seconds
    }
  }, [isGameOver]);

  return (
    <div className="p-4 flex flex-col items-center h-screen bg-gradient-to-b from-purple-100 to-blue-100">
      {/* Header */}
      <div className="flex justify-between w-full mb-4">
        <h1 className="text-2xl font-bold text-purple-700">Meme-a-Tron 3000</h1>
        <div>
          <button
            onClick={handleAddFrame}
            className="mr-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            Save
          </button>
          <button
            onClick={close}
            className="text-sm font-semibold text-red-600 hover:underline"
          >
            Close
          </button>
        </div>
      </div>

      {/* Player Stats */}
      <div className="mb-4 text-center bg-white p-4 rounded-lg shadow-lg">
        <p className="text-lg font-semibold text-gray-800">
          Your HP:{" "}
          <span className={hp <= 30 ? "text-red-500" : "text-green-500"}>
            {hp}
          </span>
        </p>
        <p className="text-md text-gray-600">
          Weapon: {weapon?.name ?? "Loading..."}
        </p>
        {weapon && (
          <p className="text-sm italic text-gray-500">"{weapon.flavor}"</p>
        )}
      </div>

      {/* Attack Log */}
      {attackLog.length > 0 && (
        <div className="mb-4 w-full">
          <h2 className="text-md font-semibold mb-2 text-gray-800">
            Recent Attacks Against You
          </h2>
          <div className="bg-white p-4 rounded-lg shadow-lg">
            {attackLog.map((attack, index) => (
              <div key={index} className="mb-2 text-sm text-gray-700">
                <p>
                  <span className="font-semibold">{attack.attacker}</span> hit
                  you with{" "}
                  <span className="font-semibold">{attack.weapon}</span> for{" "}
                  <span className="text-red-500">{attack.damage}</span> damage
                  on {new Date(attack.timestamp).toLocaleString()}.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mb-4 w-full">
          <h2 className="text-md font-semibold mb-2 text-gray-800">
            Leaderboard
          </h2>
          <div className="bg-white p-4 rounded-lg shadow-lg">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.fid}
                className="flex justify-between items-center mb-2 text-sm text-gray-700"
              >
                <span>
                  {index + 1}. {entry.username}
                </span>
                <span className="font-semibold text-purple-600">
                  {entry.wins} Wins
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4 w-full">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a friend to attack..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSearch}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition"
          >
            Add
          </button>
        </div>
        {searchError && (
          <p className="text-red-500 text-sm mt-1">{searchError}</p>
        )}
      </div>

      {/* Attack Feedback */}
      {attackMessage && (
        <div className="mb-4 text-center bg-yellow-100 p-3 rounded-lg shadow-md animate-bounce">
          <p className="text-sm text-yellow-800 whitespace-pre-line">
            {attackMessage}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-4 text-center">
          <p className="text-md text-gray-600 animate-pulse">
            Loading opponents...
          </p>
        </div>
      )}

      {/* Game Over */}
      {!isLoading && isGameOver && (
        <div className="mb-4 text-center bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-purple-600">
            {hp > 0 ? "You Win!" : "Game Over"}
          </h2>
          <p className="text-md text-gray-600">
            {hp > 0
              ? "Bragging rights secured! 🎉"
              : "Better luck next time. 😢"}
          </p>
          <p className="text-sm text-gray-500">Resetting in 5 seconds...</p>
        </div>
      )}

      {/* Opponents */}
      {!isLoading && !isGameOver && (
        <div className="w-full">
          <h2 className="text-md font-semibold mb-2 text-gray-800">
            Opponents
          </h2>
          {opponents.length > 0 ? (
            opponents.map((opponent) => (
              <div
                key={opponent.fid}
                className="flex justify-between items-center mb-2 bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <span className="text-gray-700">
                  {opponent.username} (HP:{" "}
                  <span
                    className={
                      opponent.hp <= 30 ? "text-red-500" : "text-green-500"
                    }
                  >
                    {opponent.hp}
                  </span>
                  )
                </span>
                {opponent.hp > 0 && hp > 0 && (
                  <button
                    onClick={() => handleAttack(opponent)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                  >
                    Attack
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-600 text-center">
              No opponents found. Search for a friend to add them!
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MemeATron3000;
