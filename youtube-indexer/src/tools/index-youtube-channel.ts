import { tool } from "ai";
import { z } from "zod";
import { YouTubeChannelIndexer } from "../services/youtube-indexer";

// Move regex patterns to top level for performance
const CHANNEL_URL_PATTERNS = [
	/youtube\.com\/@([a-zA-Z0-9_-]+)/,
	/youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
	/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
	/youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
];

export const indexYouTubeChannel = tool({
	description:
		"Index a YouTube channel for semantic search. This will fetch videos from the channel (defaults to 3 videos for faster processing), extract transcripts, generate keywords, and create vector embeddings for comprehensive content search. Use this when the user provides a YouTube channel link and wants to index it.",
	inputSchema: z.object({
		channelUrl: z
			.string()
			.url()
			.describe(
				"YouTube channel URL to index (e.g., https://youtube.com/@channelname)",
			),
		channelName: z
			.string()
			.optional()
			.describe("Optional display name for the channel"),
		maxVideos: z
			.number()
			.optional()
			.describe(
				"Maximum number of videos to index (optional, defaults to 3 videos for faster processing)",
			),
		confirmIndexing: z
			.boolean()
			.optional()
			.describe("User confirmation to proceed with indexing"),
	}),
	execute: async ({ channelUrl, channelName, maxVideos, confirmIndexing }) => {
		try {
			// Extract channel ID from URL
			const channelId = extractChannelIdFromUrl(channelUrl);
			if (!channelId) {
				return {
					success: false,
					message:
						"❌ **Invalid Channel URL**\n\nPlease provide a valid YouTube channel URL in one of these formats:\n- https://youtube.com/@channelname\n- https://youtube.com/c/channelname\n- https://youtube.com/channel/CHANNEL_ID\n- https://youtube.com/user/username",
					channelId: null,
					status: "failed",
				};
			}

			// Initialize indexer to check existing status
			const indexer = new YouTubeChannelIndexer();
			await indexer.initialize();

			// Get channel info and check if already indexed
			const channelInfo = await indexer.getChannelIndexInfo(channelUrl);
			const displayName =
				channelName || channelInfo.channelName || `Channel ${channelId}`;

			// If no confirmation provided, show channel info and ask for confirmation
			if (confirmIndexing === undefined) {
				let message = `📺 **YouTube Channel Found**\n\n**Channel:** ${displayName}\n**URL:** ${channelUrl}\n\n`;

				if (channelInfo.isIndexed && channelInfo.videoCount > 0) {
					message += `✅ **Already Indexed**\n- **Videos indexed:** ${channelInfo.videoCount}\n- **Last indexed:** ${channelInfo.lastIndexedAt ? new Date(channelInfo.lastIndexedAt).toLocaleDateString() : "Unknown"}\n\n`;
				}

				// Get total video count for estimation
				const allVideos = await indexer.fetchChannelVideosWithYtdlp(channelUrl);
				const totalVideos = allVideos.length;
				// Default to 3 videos if no maxVideos specified
				const defaultMaxVideos = 3;
				const videosToIndex = maxVideos
					? Math.min(maxVideos, totalVideos)
					: Math.min(defaultMaxVideos, totalVideos);

				const timeEstimate = await indexer.estimateIndexingTime(videosToIndex);

				message += `**Indexing Plan:**\n- **Total videos available:** ${totalVideos}\n- **Videos to index:** ${videosToIndex}${maxVideos ? ` (limited to ${maxVideos})` : ` (limited to ${defaultMaxVideos} for faster processing)`}\n- **Estimated time:** ${timeEstimate.estimatedHours > 0 ? `${timeEstimate.estimatedHours} hours` : `${Math.round(timeEstimate.estimatedMinutes)} minutes`}\n\n**What will happen:**\n- Extract transcripts and generate keywords\n- Create vector embeddings for semantic search\n- Build searchable index\n\n**Would you like me to proceed with indexing?**\n\n*Say "yes" or "proceed" to start indexing, or "no" to cancel.*`;

				return {
					success: false,
					message,
					channelId,
					channelUrl,
					channelName: displayName,
					status: "awaiting_confirmation",
					requiresConfirmation: true,
					totalVideos,
					videosToIndex,
					estimatedTime:
						timeEstimate.estimatedHours > 0
							? `${timeEstimate.estimatedHours} hours`
							: `${Math.round(timeEstimate.estimatedMinutes)} minutes`,
				};
			}

			// If user declined
			if (confirmIndexing === false) {
				return {
					success: false,
					message:
						"❌ **Indexing Cancelled**\n\nChannel indexing has been cancelled. You can try again anytime by providing the channel URL.",
					channelId: null,
					status: "cancelled",
				};
			}

			// Proceed with indexing
			console.log(
				"🚀 [CHANNEL-INDEXER] Starting channel indexing:",
				channelUrl,
			);

			// Start indexing process
			const allVideos = await indexer.fetchChannelVideosWithYtdlp(channelUrl);
			// Default to 3 videos if no maxVideos specified
			const defaultMaxVideos = 3;
			const videosToIndex = maxVideos
				? Math.min(maxVideos, allVideos.length)
				: Math.min(defaultMaxVideos, allVideos.length);
			const timeEstimate = await indexer.estimateIndexingTime(videosToIndex);

			// Run indexing (in production, this would be queued)
			indexer
				.indexChannel(channelUrl, displayName, maxVideos || defaultMaxVideos)
				.catch((error) => {
					console.error("Background indexing failed:", error);
				});

			return {
				success: true,
				message: `🚀 **Channel Indexing Started**\n\n**Channel:** ${displayName}\n**URL:** ${channelUrl}\n\n**What's happening:**\n- Fetching **${videosToIndex} videos** from the channel\n- Extracting transcripts and generating keywords\n- Creating vector embeddings for semantic search\n- Building searchable index\n\n**Status:** Indexing in progress...\n**Estimated time:** ${timeEstimate.estimatedHours > 0 ? `${timeEstimate.estimatedHours} hours` : `${Math.round(timeEstimate.estimatedMinutes)} minutes`}\n\n**Progress will be shown in the console.**\n\nYou'll be able to search through the channel content once indexing is complete!`,
				channelId,
				channelUrl,
				channelName: displayName,
				status: "indexing",
				estimatedTime:
					timeEstimate.estimatedHours > 0
						? `${timeEstimate.estimatedHours} hours`
						: `${Math.round(timeEstimate.estimatedMinutes)} minutes`,
				totalVideos: allVideos.length,
				videosToIndex,
			};
		} catch (error) {
			console.error("❌ [CHANNEL-INDEXER] Error:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `❌ **Indexing Failed**\n\nAn error occurred while starting the channel indexing process:\n\n**Error:** ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
				channelId: null,
				status: "failed",
			};
		}
	},
});

function extractChannelIdFromUrl(url: string): string | null {
	for (const pattern of CHANNEL_URL_PATTERNS) {
		const match = url.match(pattern);
		if (match) {
			return match[1];
		}
	}
	return null;
}
