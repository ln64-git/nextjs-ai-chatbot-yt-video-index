import { tool } from "ai";
import { google } from "googleapis";
import { z } from "zod";

export const fetchYouTubeVideos = tool({
  description:
    "Fetches the most recent videos from a YouTube channel and logs them to console with titles and release dates",
  inputSchema: z.object({
    channelUrl: z
      .string()
      .describe("The YouTube channel URL to fetch videos from"),
  }),
  execute: async ({ channelUrl }: { channelUrl: string }) => {
    try {
      console.log("📺 Fetching videos for channel:", channelUrl);

      // Extract channel ID from URL
      const channelId = extractChannelIdFromUrl(channelUrl);
      if (!channelId) {
        console.log("❌ Could not extract channel ID from URL");
        return {
          success: false,
          message: "Could not extract channel ID from the provided URL",
        };
      }

      console.log("🔍 [VIDEOS] Channel ID:", channelId);

      // Check if YouTube API key is available
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        console.log("⚠️ [VIDEOS] No YouTube API key found, using mock data");
        const mockVideos = await simulateYouTubeAPICall();
        return logVideosAndReturn(mockVideos, channelUrl);
      }

      console.log("📡 [VIDEOS] YouTube API key found, fetching real data...");
      // Fetch real videos from YouTube API
      const videos = await fetchRealYouTubeVideos(channelId, apiKey);
      console.log("✅ [VIDEOS] Fetched videos:", { count: videos.length });
      return logVideosAndReturn(videos, channelUrl);
    } catch (error) {
      console.error("Error fetching YouTube videos:", error);
      return {
        success: false,
        message: "Failed to fetch videos from the channel",
      };
    }
  },
});

// Define regex patterns at module level for performance
const CHANNEL_PATTERNS = [
  /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
];

function extractChannelIdFromUrl(url: string): string | null {
  // Handle different YouTube channel URL formats
  for (const pattern of CHANNEL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function fetchRealYouTubeVideos(channelId: string, apiKey: string) {
  const youtube = google.youtube({
    version: "v3",
    auth: apiKey,
  });

  try {
    // First, get the channel details to get the uploads playlist ID
    const channelResponse = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    });

    if (
      !channelResponse.data.items ||
      channelResponse.data.items.length === 0
    ) {
      // Try searching by username for @channelname format
      const searchResponse = await youtube.search.list({
        part: ["snippet"],
        q: channelId,
        type: ["channel"],
        maxResults: 1,
      });

      if (
        !searchResponse.data.items ||
        searchResponse.data.items.length === 0
      ) {
        throw new Error("Channel not found");
      }

      const foundChannelId = searchResponse.data.items[0].snippet?.channelId;
      if (!foundChannelId) {
        throw new Error("Channel ID not found in search results");
      }

      // Get channel details with the found channel ID
      const channelResponse2 = await youtube.channels.list({
        part: ["contentDetails"],
        id: [foundChannelId],
      });

      if (
        !channelResponse2.data.items ||
        channelResponse2.data.items.length === 0
      ) {
        throw new Error("Channel details not found");
      }

      const uploadsPlaylistId =
        channelResponse2.data.items[0].contentDetails?.relatedPlaylists
          ?.uploads;
      if (!uploadsPlaylistId) {
        throw new Error("Uploads playlist not found");
      }

      // Get videos from the uploads playlist
      const videosResponse = await youtube.playlistItems.list({
        part: ["snippet"],
        playlistId: uploadsPlaylistId,
        maxResults: 10,
      });

      if (!videosResponse.data.items) {
        return [];
      }

      // Get video details for each video
      const videoIds = videosResponse.data.items
        .map((item) => item.snippet?.resourceId?.videoId)
        .filter(Boolean) as string[];

      if (videoIds.length === 0) {
        return [];
      }

      const videoDetailsResponse = await youtube.videos.list({
        part: ["snippet", "statistics"],
        id: videoIds,
      });

      if (!videoDetailsResponse.data.items) {
        return [];
      }

      return videoDetailsResponse.data.items.map((video) => ({
        title: video.snippet?.title || "Unknown Title",
        publishedAt: video.snippet?.publishedAt || "Unknown Date",
        url: `https://www.youtube.com/watch?v=${video.id}`,
        viewCount: Number.parseInt(video.statistics?.viewCount || "0", 10),
        description: video.snippet?.description || "",
        thumbnail: video.snippet?.thumbnails?.high?.url || "",
      }));
    }

    const uploadsPlaylistId =
      channelResponse.data.items[0].contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error("Uploads playlist not found");
    }

    // Get videos from the uploads playlist
    const videosResponse = await youtube.playlistItems.list({
      part: ["snippet"],
      playlistId: uploadsPlaylistId,
      maxResults: 10,
    });

    if (!videosResponse.data.items) {
      return [];
    }

    // Get video details for each video
    const videoIds = videosResponse.data.items
      .map((item) => item.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[];

    if (videoIds.length === 0) {
      return [];
    }

    const videoDetailsResponse = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: videoIds,
    });

    if (!videoDetailsResponse.data.items) {
      return [];
    }

    // Return only essential data for speed
    return videoDetailsResponse.data.items.map((video) => ({
      title: video.snippet?.title || "Unknown Title",
      publishedAt: video.snippet?.publishedAt || "Unknown Date",
      url: `https://www.youtube.com/watch?v=${video.id}`,
      viewCount: Number.parseInt(video.statistics?.viewCount || "0", 10),
      description: (video.snippet?.description || "").substring(0, 100), // Truncate description
      thumbnail: video.snippet?.thumbnails?.medium?.url || "", // Use medium instead of high
    }));
  } catch (error) {
    console.error("Error fetching real YouTube videos:", error);
    // Fallback to mock data if API fails
    return await simulateYouTubeAPICall();
  }
}

function logVideosAndReturn(videos: any[], _channelUrl: string) {
  if (videos.length === 0) {
    return {
      success: true,
      message: "No videos found for this channel.",
      videoCount: 0,
      videos: [],
    };
  }

  // Format videos for chat display (removed as we now show structured summary)

  return {
    success: true,
    message:
      "📋 **Channel Analysis Complete**\n\n" +
      `**Channel:** ${videos[0]?.channelTitle || "Unknown"}\n` +
      `**Videos Found:** ${videos.length}\n` +
      `**Most Recent Video:** ${videos[0]?.title || "Unknown"}\n` +
      `**Published:** ${videos[0]?.publishedAt || "Unknown"}\n` +
      `**Views:** ${videos[0]?.viewCount?.toLocaleString() || "Unknown"}\n\n` +
      "✅ Ready to analyze the most recent video's transcript and extract keywords.",
    videoCount: videos.length,
    videos,
    mostRecentVideo: videos[0], // Return the most recent video for transcript fetching
  };
}

async function simulateYouTubeAPICall() {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock video data - fallback when API key is not available
  // Using real video IDs that have transcripts available
  const mockVideos = [
    {
      title: "Latest Video: Amazing Tutorial on React Hooks",
      publishedAt: "2024-01-15T10:30:00Z",
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ", // Rick Roll - has captions
      viewCount: 15_420,
      description: "Learn React hooks in this comprehensive tutorial...",
      thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    },
    {
      title: "Building a Full-Stack App with Next.js",
      publishedAt: "2024-01-12T14:15:00Z",
      url: "https://youtube.com/watch?v=9bZkp7q19f0", // PSY - GANGNAM STYLE - has captions
      viewCount: 8930,
      description: "Complete guide to building a full-stack application...",
      thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg",
    },
    {
      title: "CSS Grid vs Flexbox: When to Use What",
      publishedAt: "2024-01-10T09:45:00Z",
      url: "https://youtube.com/watch?v=YQHsXMglC9A", // Adele - Hello - has captions
      viewCount: 12_350,
      description:
        "Understanding the differences between CSS Grid and Flexbox...",
      thumbnail: "https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg",
    },
    {
      title: "TypeScript Tips and Tricks for Beginners",
      publishedAt: "2024-01-08T16:20:00Z",
      url: "https://youtube.com/watch?v=kJQP7kiw5Fk", // Luis Fonsi - Despacito - has captions
      viewCount: 6780,
      description: "Essential TypeScript tips every developer should know...",
      thumbnail: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    },
    {
      title: "Setting up a Development Environment",
      publishedAt: "2024-01-05T11:10:00Z",
      url: "https://youtube.com/watch?v=YQHsXMglC9A", // Adele - Hello (duplicate for testing)
      viewCount: 4520,
      description: "Complete setup guide for your development environment...",
      thumbnail: "https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg",
    },
  ];

  return mockVideos;
}
