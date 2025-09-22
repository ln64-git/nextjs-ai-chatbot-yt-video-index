import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import {
  channelIndexStatus,
  transcriptChunk,
  youtubeChannel,
  youtubeVideo,
} from "@/lib/db/youtube-schema";

export async function GET() {
  try {
    console.log("🔍 [DEBUG] Checking database status...");

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

    console.log("📊 [DEBUG] Database Status:", diagnostic.database);
    console.log("🔧 [DEBUG] Environment:", diagnostic.environment);

    return NextResponse.json({
      success: true,
      diagnostic,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [DEBUG] Error:", error);
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
