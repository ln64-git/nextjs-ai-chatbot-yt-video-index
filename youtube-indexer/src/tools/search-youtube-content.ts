import { tool } from "ai";
import { z } from "zod";
import { SemanticSearchService } from "../services/semantic-search";

export const searchYouTubeContent = tool({
  description:
    "Search through indexed YouTube channel content using semantic search. Find specific topics, moments, or discussions across all videos in a channel.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "Search query (e.g., 'precision stitching', 'train to India', 'healthy relationships')"
      ),
    channelId: z
      .string()
      .optional()
      .describe("Optional channel ID to limit search to specific channel"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("Number of results to return"),
  }),
  execute: async ({ query, channelId, limit = 10 }) => {
    try {
      console.log("🔍 [CONTENT-SEARCH] Searching for:", query);

      // Initialize search service
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return {
          success: false,
          message:
            "❌ **Search Unavailable**\n\nOpenAI API key not configured. Please contact support.",
          results: [],
          totalResults: 0,
        };
      }

      const searchService = new SemanticSearchService(openaiApiKey);

      // Perform semantic search
      const results = await searchService.search(query, {
        channelId,
        limit,
        similarityThreshold: 0.5,
        includeKeywords: true,
      });

      if (results.length === 0) {
        return {
          success: true,
          message: `🔍 **No Results Found**\n\n**Query:** "${query}"\n\nNo matching content found in the indexed channels. Try:\n- Using different keywords\n- Being more specific\n- Checking if the channel is fully indexed`,
          results: [],
          totalResults: 0,
        };
      }

      // Format results for display
      const formattedResults = results.map((result, index) => {
        const timeLink = `${result.video.videoUrl}&t=${result.chunk.startTime}s`;

        return {
          rank: index + 1,
          video: {
            title: result.video.title,
            url: timeLink,
            publishedAt: new Date(
              result.video.publishedAt
            ).toLocaleDateString(),
            duration: formatDuration(result.video.duration),
            viewCount: result.video.viewCount?.toLocaleString(),
          },
          channel: result.channel.channelName,
          content: result.chunk.content,
          timeRange: `${formatTime(result.chunk.startTime)} - ${formatTime(result.chunk.endTime)}`,
          relevanceScore: Math.round(result.relevanceScore * 100),
          matchedKeywords: result.matchedKeywords.slice(0, 5),
        };
      });

      // Group results by video for better organization
      const resultsByVideo = new Map();
      for (const result of formattedResults) {
        const videoKey = result.video.title;
        if (!resultsByVideo.has(videoKey)) {
          resultsByVideo.set(videoKey, {
            video: result.video,
            channel: result.channel,
            clips: [],
          });
        }
        resultsByVideo.get(videoKey).clips.push({
          content: result.content,
          timeRange: result.timeRange,
          relevanceScore: result.relevanceScore,
          matchedKeywords: result.matchedKeywords,
        });
      }

      // Create response message
      let message = `🎯 **Search Results for "${query}"**\n\n`;
      message += `**Found ${results.length} relevant clips across ${resultsByVideo.size} videos**\n\n`;

      // Display results grouped by video
      for (const [videoTitle, videoData] of resultsByVideo) {
        message += `**📺 ${videoTitle}**\n`;
        message += `*Channel: ${videoData.channel} | Published: ${videoData.video.publishedAt}*\n`;
        message += `*Duration: ${videoData.video.duration} | Views: ${videoData.video.viewCount}*\n\n`;

        for (const clip of videoData.clips) {
          message += `**⏰ ${clip.timeRange}** (${clip.relevanceScore}% match)\n`;
          message += `*Keywords: ${clip.matchedKeywords.join(", ")}*\n`;
          message += `"${clip.content.length > 200 ? `${clip.content.substring(0, 200)}...` : clip.content}"\n\n`;
        }
        message += `[Watch Video](${videoData.video.url})\n\n---\n\n`;
      }

      return {
        success: true,
        message,
        results: formattedResults,
        totalResults: results.length,
        videosFound: resultsByVideo.size,
        query,
      };
    } catch (error) {
      console.error("❌ [CONTENT-SEARCH] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `❌ **Search Failed**\n\nAn error occurred while searching:\n\n**Error:** ${errorMessage}\n\nPlease try again with a different query.`,
        results: [],
        totalResults: 0,
      };
    }
  },
});

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) {
    return "Unknown";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
