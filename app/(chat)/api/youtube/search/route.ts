import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import {
  channelIndexStatus,
  transcriptChunk,
  youtubeChannel,
  youtubeVideo,
} from "@/lib/db/youtube-schema";
import { SemanticSearchService } from "@/lib/services/semantic-search";

const searchRequestSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  channelId: z
    .string()
    .optional()
    .describe("Optional channel ID to limit search"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("Number of results to return"),
  similarityThreshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.7)
    .describe("Similarity threshold for vector search"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query, channelId, limit, similarityThreshold } =
      searchRequestSchema.parse(body);

    // Initialize search service
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const searchService = new SemanticSearchService(openaiApiKey);

    // Perform search
    const results = await searchService.search(query, {
      channelId,
      limit,
      similarityThreshold,
      includeKeywords: true,
    });

    // Format results for response
    const formattedResults = results.map((result) => ({
      video: {
        id: result.video.id,
        videoId: result.video.videoId,
        title: result.video.title,
        description: result.video.description,
        publishedAt: result.video.publishedAt,
        duration: result.video.duration,
        viewCount: result.video.viewCount,
        thumbnailUrl: result.video.thumbnailUrl,
        videoUrl: result.video.videoUrl,
      },
      channel: result.channel,
      chunk: {
        id: result.chunk.id,
        content: result.chunk.content,
        startTime: result.chunk.startTime,
        endTime: result.chunk.endTime,
        tokenCount: result.chunk.tokenCount,
      },
      relevanceScore: result.relevanceScore,
      matchedKeywords: result.matchedKeywords,
      timeRange: {
        start: formatTime(result.startTime),
        end: formatTime(result.endTime),
      },
    }));

    return NextResponse.json({
      success: true,
      query,
      results: formattedResults,
      totalResults: formattedResults.length,
      searchTime: Date.now(), // This would be calculated properly
    });
  } catch (error) {
    console.error("Search request failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔍 [DIAGNOSTIC] Checking database status...");

    // Check total counts
    const [totalChannels] = await db
      .select({ count: sql<number>`count(*)` })
      .from(youtubeChannel);

    const [totalVideos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(youtubeVideo);

    const [totalChunks] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptChunk);

    // Check chunks with embeddings
    const [chunksWithEmbeddings] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptChunk)
      .where(sql`${transcriptChunk.embedding} IS NOT NULL`);

    // Check chunks without embeddings
    const [chunksWithoutEmbeddings] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptChunk)
      .where(sql`${transcriptChunk.embedding} IS NULL`);

    // Check indexing status
    const indexStatuses = await db
      .select()
      .from(channelIndexStatus)
      .orderBy(sql`${channelIndexStatus.createdAt} DESC`)
      .limit(5);

    const embeddingPercentage = totalChunks.count
      ? Math.round((chunksWithEmbeddings.count / totalChunks.count) * 100)
      : 0;

    const diagnostic = {
      database: {
        totalChannels: totalChannels.count,
        totalVideos: totalVideos.count,
        totalChunks: totalChunks.count,
        chunksWithEmbeddings: chunksWithEmbeddings.count,
        chunksWithoutEmbeddings: chunksWithoutEmbeddings.count,
        embeddingPercentage,
      },
      indexingStatus: indexStatuses.map((status) => ({
        channelId: status.channelId,
        status: status.status,
        progress: status.progress,
        totalVideos: status.totalVideos,
        processedVideos: status.processedVideos,
        totalChunks: status.totalChunks,
        processedChunks: status.processedChunks,
        errorMessage: status.errorMessage,
        startedAt: status.startedAt,
        completedAt: status.completedAt,
      })),
      environment: {
        openaiApiKey: process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing",
        youtubeApiKey: process.env.YOUTUBE_API_KEY ? "✅ Set" : "❌ Missing",
        postgresUrl: process.env.POSTGRES_URL ? "✅ Set" : "❌ Missing",
      },
      recommendations: [] as string[],
    };

    // Add recommendations based on findings
    if (embeddingPercentage < 50) {
      diagnostic.recommendations.push(
        "⚠️ Low embedding coverage - consider re-indexing with proper API keys"
      );
    }
    if (chunksWithoutEmbeddings.count > 0) {
      diagnostic.recommendations.push(
        "🔄 Some chunks missing embeddings - run embedding regeneration"
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      diagnostic.recommendations.push(
        "🔑 Set OPENAI_API_KEY environment variable"
      );
    }

    console.log("📊 [DIAGNOSTIC] Database Status:", diagnostic.database);
    console.log("🔧 [DIAGNOSTIC] Environment:", diagnostic.environment);

    return NextResponse.json({
      success: true,
      diagnostic,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [DIAGNOSTIC] Error:", error);
    return NextResponse.json(
      {
        error: "Diagnostic failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
