import {
	channelIndexStatus,
	transcriptChunk,
	youtubeChannel,
	youtubeVideo,
} from "@workspace/youtube-indexer";
import { tool } from "ai";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";

export const checkDatabaseStatus = tool({
	description:
		"Check the status of the YouTube indexing database, including embedding coverage and indexing progress.",
	inputSchema: z.object({
		// No input parameters needed
	}),
	execute: async () => {
		try {
			console.log("🔍 [DB-STATUS] Checking database status...");

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
					"⚠️ Low embedding coverage - consider re-indexing with proper API keys",
				);
			}
			if (chunksWithoutEmbeddings.count > 0) {
				diagnostic.recommendations.push(
					"🔄 Some chunks missing embeddings - run embedding regeneration",
				);
			}
			if (!process.env.OPENAI_API_KEY) {
				diagnostic.recommendations.push(
					"🔑 Set OPENAI_API_KEY environment variable",
				);
			}

			console.log("📊 [DB-STATUS] Database Status:", diagnostic.database);
			console.log("🔧 [DB-STATUS] Environment:", diagnostic.environment);

			return {
				success: true,
				message: `## 📊 Database Status Report

**Database Overview:**
- **Channels:** ${diagnostic.database.totalChannels}
- **Videos:** ${diagnostic.database.totalVideos}
- **Transcript Chunks:** ${diagnostic.database.totalChunks}
- **Chunks with Embeddings:** ${diagnostic.database.chunksWithEmbeddings}
- **Chunks without Embeddings:** ${diagnostic.database.chunksWithoutEmbeddings}
- **Embedding Coverage:** ${diagnostic.database.embeddingPercentage}%

**Environment:**
- **OpenAI API Key:** ${diagnostic.environment.openaiApiKey}
- **YouTube API Key:** ${diagnostic.environment.youtubeApiKey}
- **PostgreSQL URL:** ${diagnostic.environment.postgresUrl}

**Recent Indexing Activity:**
${
	diagnostic.indexingStatus.length > 0
		? diagnostic.indexingStatus
				.map(
					(status) =>
						`- **Status:** ${status.status} | **Progress:** ${status.progress}% | **Videos:** ${status.processedVideos}/${status.totalVideos} | **Chunks:** ${status.processedChunks}/${status.totalChunks}`,
				)
				.join("\n")
		: "No indexing activity found"
}

**Recommendations:**
${
	diagnostic.recommendations.length > 0
		? diagnostic.recommendations.map((rec) => `- ${rec}`).join("\n")
		: "✅ Everything looks good!"
}`,
				diagnostic,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("❌ [DB-STATUS] Error:", error);
			return {
				success: false,
				message: `❌ **Database Status Check Failed**

Error: ${error instanceof Error ? error.message : "Unknown error"}

Please check your database connection and try again.`,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
