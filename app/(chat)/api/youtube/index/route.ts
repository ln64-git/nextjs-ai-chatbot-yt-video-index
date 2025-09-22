import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { YouTubeChannelIndexer } from "@/lib/services/youtube-indexer";

const indexRequestSchema = z.object({
  channelUrl: z.string().url().describe("YouTube channel URL to index"),
  channelName: z.string().optional().describe("Optional channel name"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channelUrl, channelName } = indexRequestSchema.parse(body);

    // Extract channel ID from URL
    const channelId = extractChannelIdFromUrl(channelUrl);
    if (!channelId) {
      return NextResponse.json(
        { error: "Invalid YouTube channel URL" },
        { status: 400 }
      );
    }

    // Initialize indexer
    const indexer = new YouTubeChannelIndexer(channelId);
    await indexer.initialize();

    // Start indexing process (this should be run in background)
    // For now, we'll run it synchronously, but in production you'd want to use a queue
    const channelNameToUse = channelName || `Channel ${channelId}`;

    // Run indexing in background
    indexer.indexChannel(channelUrl, channelNameToUse).catch((error) => {
      console.error("Background indexing failed:", error);
    });

    return NextResponse.json({
      success: true,
      message: `Started indexing channel: ${channelNameToUse}`,
      channelId,
      status: "indexing",
    });
  } catch (error) {
    console.error("Indexing request failed:", error);
    return NextResponse.json(
      { error: "Failed to start indexing process" },
      { status: 500 }
    );
  }
}

function extractChannelIdFromUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
