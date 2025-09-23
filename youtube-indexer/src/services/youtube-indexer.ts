import { pipeline } from "@xenova/transformers";
import { eq, sql } from "drizzle-orm";

// Database will be injected from the chatbot
let db: any = null;

// Regex patterns for VTT parsing
const VTT_NUMBER_REGEX = /^\d+$/;

import { extractKeywordsFromTranscript } from "../extract-keywords";
import {
  channelIndexStatus,
  type TranscriptChunk,
  transcriptChunk,
  videoKeyword,
  type YouTubeChannel,
  youtubeChannel,
  youtubeVideo,
} from "../types/youtube-schema";

// Configuration
const CHUNK_SIZE = 400; // tokens per chunk
const CHUNK_OVERLAP = 50; // token overlap between chunks
const MAX_KEYWORDS_PER_CHUNK = 20;

// Move regex patterns to top level for performance
const SENTENCE_SPLIT_REGEX = /[.!?]+/;
const CHANNEL_URL_PATTERNS = [
  /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
];
const DURATION_REGEX = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;

type IndexStatusUpdate = {
  status: string;
  progress: number;
  totalVideos: number;
  processedVideos: number;
  errorMessage?: string;
};

export class YouTubeChannelIndexer {
  static setDatabase(database: any) {
    db = database;
  }
  // biome-ignore lint/style/useReadonlyClassProperties: channelDbId is assigned in indexChannel method
  private channelDbId: string | null = null;

  async initialize() {
    console.log("🔧 Initializing pipelines...");
    await pipeline("ner", "Xenova/bert-base-NER");
    // For embeddings, we'll use OpenAI API in production
    console.log("✅ Pipelines initialized");
  }

  async getChannelIndexInfo(channelUrl: string): Promise<{
    isIndexed: boolean;
    videoCount: number;
    channelName: string;
    lastIndexedAt: Date | null;
  }> {
    const channelId = this.extractChannelIdFromUrl(channelUrl);

    const [channel] = await db
      .select({
        id: youtubeChannel.id,
        isIndexed: youtubeChannel.isIndexed,
        videoCount: youtubeChannel.videoCount,
        channelName: youtubeChannel.channelName,
        lastIndexedAt: youtubeChannel.lastIndexedAt,
      })
      .from(youtubeChannel)
      .where(eq(youtubeChannel.channelId, channelId))
      .limit(1);

    if (!channel) {
      return {
        isIndexed: false,
        videoCount: 0,
        channelName: "",
        lastIndexedAt: null,
      };
    }

    // Get actual video count from database
    const videoCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(youtubeVideo)
      .where(eq(youtubeVideo.channelId, channel.id));

    return {
      isIndexed: channel.isIndexed,
      videoCount: videoCountResult[0]?.count || 0,
      channelName: channel.channelName,
      lastIndexedAt: channel.lastIndexedAt,
    };
  }

  estimateIndexingTime(videoCount: number): {
    estimatedMinutes: number;
    estimatedHours: number;
  } {
    // Rough estimation: 2-3 minutes per video (transcript + keywords + embeddings)
    const minutesPerVideo = 2.5;
    const totalMinutes = videoCount * minutesPerVideo;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.round(totalMinutes % 60);

    return {
      estimatedMinutes: totalMinutes,
      estimatedHours: hours + (remainingMinutes > 0 ? 1 : 0),
    };
  }

  async indexChannel(
    channelUrl: string,
    channelName: string,
    maxVideos?: number
  ): Promise<void> {
    try {
      console.log(`🚀 Starting channel indexing: ${channelName}`);

      // Create or update channel record
      const channel = await this.createChannelRecord(channelUrl, channelName);

      // Store the database ID for later use
      this.channelDbId = channel.id;

      // Create index status record
      await this.createIndexStatusRecord(channel.id);

      // Fetch all videos from channel
      const allVideos = await this.fetchChannelVideosWithYtdlp(channelUrl);
      const videos = maxVideos ? allVideos.slice(0, maxVideos) : allVideos;
      console.log(
        `📺 Found ${allVideos.length} total videos, indexing ${videos.length} videos`
      );

      // Update status
      await this.updateIndexStatus({
        status: "indexing_videos",
        progress: 10,
        totalVideos: videos.length,
        processedVideos: 0,
      });

      // Process videos in parallel batches for better performance
      const BATCH_SIZE = 3; // Process 3 videos at a time (reduced for better performance)
      let processedCount = 0;

      for (let i = 0; i < videos.length; i += BATCH_SIZE) {
        const batch = videos.slice(i, i + BATCH_SIZE);

        console.log(
          `🎬 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(videos.length / BATCH_SIZE)} (${batch.length} videos)`
        );

        // Process batch in parallel using optimized yt-dlp method
        const channelDbId = this.channelDbId;
        if (channelDbId === undefined) {
          throw new Error("Channel database ID is not set.");
        }
        const batchPromises = batch.map(async (video) => {
          try {
            await this.processVideoWithYtdlp(channelDbId, video);
            return { success: true, video: video.title };
          } catch (error) {
            console.error(
              `❌ Error processing "${video.title}":`,
              error instanceof Error ? error.message : String(error)
            );
            return {
              success: false,
              video: video.title,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        processedCount += batch.length;

        const successCount = batchResults.filter((r) => r.success).length;
        console.log(
          `✅ Batch completed: ${successCount}/${batch.length} videos successful`
        );

        const progress = Math.round(20 + (processedCount / videos.length) * 30);
        await this.updateIndexStatus({
          status: "indexing_videos",
          progress,
          totalVideos: videos.length,
          processedVideos: processedCount,
        });
      }

      // Mark channel as indexed
      await this.markChannelAsIndexed(channel.id);
      await this.updateIndexStatus({
        status: "completed",
        progress: 100,
        totalVideos: videos.length,
        processedVideos: videos.length,
      });

      console.log(`🎉 Channel indexing completed: ${channelName}`);
      console.log(`📊 Successfully indexed ${videos.length} videos`);
      console.log("🔍 Channel is now searchable!");
    } catch (error) {
      console.error("❌ Channel indexing failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.updateIndexStatus({
        status: "failed",
        progress: 0,
        totalVideos: 0,
        processedVideos: 0,
        errorMessage,
      });
      throw error;
    }
  }

  private async createChannelRecord(
    channelUrl: string,
    channelName: string
  ): Promise<YouTubeChannel> {
    const channelId = this.extractChannelIdFromUrl(channelUrl);

    // First try to get existing channel
    const existingChannel = await db
      .select()
      .from(youtubeChannel)
      .where(eq(youtubeChannel.channelId, channelId))
      .limit(1);

    if (existingChannel.length > 0) {
      // Update existing channel
      const [updatedChannel] = await db
        .update(youtubeChannel)
        .set({
          channelName,
          channelUrl,
          updatedAt: new Date(),
        })
        .where(eq(youtubeChannel.channelId, channelId))
        .returning();

      return updatedChannel;
    }

    // Create new channel
    const [newChannel] = await db
      .insert(youtubeChannel)
      .values({
        channelId,
        channelName,
        channelUrl,
        isIndexed: false,
      })
      .returning();

    return newChannel;
  }

  private async createIndexStatusRecord(channelDbId: string): Promise<void> {
    await db.insert(channelIndexStatus).values({
      channelId: channelDbId,
      status: "pending",
      progress: 0,
    });
  }

  async fetchChannelVideosWithYtdlp(channelUrl: string): Promise<any[]> {
    console.log("📺 Fetching videos using yt-dlp...");

    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      // Get channel videos using yt-dlp
      const command = `yt-dlp --flat-playlist --print "%(id)s|%(title)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" "${channelUrl}"`;

      console.log("📥 Running yt-dlp to get channel videos...");
      const { stdout } = await execAsync(command);

      console.log(
        `📊 yt-dlp output (first 200 chars): ${stdout.substring(0, 200)}...`
      );

      const videos: any[] = [];
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const [videoId, title, duration, viewCount, likeCount, uploadDate] =
          line.split("|");

        if (!videoId || !title) {
          continue;
        }

        videos.push({
          videoId,
          title: title.replace(/\|/g, " "), // Clean up title
          description: "",
          publishedAt: uploadDate
            ? this.parseUploadDate(uploadDate)
            : new Date().toISOString(),
          duration: duration ? Number.parseInt(duration, 10) : 0,
          viewCount: viewCount ? Number.parseInt(viewCount, 10) : 0,
          likeCount: likeCount ? Number.parseInt(likeCount, 10) : 0,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }

      console.log(`✅ Found ${videos.length} videos using yt-dlp`);
      return videos;
    } catch (error) {
      console.error("❌ Error fetching videos with yt-dlp:", error);
      return [];
    }
  }

  async fetchChannelVideos(channelUrl: string): Promise<any[]> {
    try {
      console.log("📺 Fetching videos from YouTube API...");

      // Extract channel ID from URL
      const channelId = this.extractChannelIdFromUrl(channelUrl);
      if (!channelId) {
        throw new Error("Could not extract channel ID from URL");
      }

      // Check if YouTube API key is available
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        console.log("⚠️ YouTube API key not found, using mock data");
        return this.getMockVideos();
      }

      // Use the real YouTube API
      const { google } = await import("googleapis");
      const youtube = google.youtube({
        version: "v3",
        auth: apiKey,
      });

      // First, get the channel details to get the uploads playlist ID
      const channelResponse = await youtube.channels.list({
        part: ["contentDetails"],
        id: [channelId],
      });

      let uploadsPlaylistId: string | undefined;

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

        uploadsPlaylistId =
          channelResponse2.data.items[0].contentDetails?.relatedPlaylists
            ?.uploads;
      } else {
        uploadsPlaylistId =
          channelResponse.data.items[0].contentDetails?.relatedPlaylists
            ?.uploads;
      }

      if (!uploadsPlaylistId) {
        throw new Error("Uploads playlist not found");
      }

      // Get videos from the uploads playlist (fetch ALL videos using pagination)
      const allVideos: any[] = [];
      let nextPageToken: string | undefined;
      let totalFetched = 0;

      console.log("📺 Fetching all videos using pagination...");

      do {
        const playlistResponse = await youtube.playlistItems.list({
          part: ["snippet"],
          playlistId: uploadsPlaylistId,
          maxResults: 50, // YouTube API max per request
          pageToken: nextPageToken,
        });

        if (!playlistResponse.data.items) {
          break;
        }

        // Get video details for this batch
        const videoIds = playlistResponse.data.items
          .map((item) => item.snippet?.resourceId?.videoId)
          .filter((id): id is string => id !== undefined);

        if (videoIds.length === 0) {
          nextPageToken = playlistResponse.data.nextPageToken || undefined;
          continue;
        }

        const videosResponse = await youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: videoIds,
        });

        if (videosResponse.data.items) {
          // Transform the response to match our expected format
          const batchVideos = videosResponse.data.items.map((video) => ({
            videoId: video.id || "unknown",
            title: video.snippet?.title || "Untitled",
            description: video.snippet?.description || "",
            publishedAt: new Date(video.snippet?.publishedAt || Date.now()),
            duration: this.parseDuration(
              video.contentDetails?.duration || "PT0S"
            ),
            viewCount: Number.parseInt(video.statistics?.viewCount || "0", 10),
            likeCount: Number.parseInt(video.statistics?.likeCount || "0", 10),
            thumbnailUrl: video.snippet?.thumbnails?.high?.url || "",
            videoUrl: `https://youtube.com/watch?v=${video.id || "unknown"}`,
          }));

          allVideos.push(...batchVideos);
          totalFetched += batchVideos.length;

          // Only log every 50 videos to reduce noise
          if (totalFetched % 50 === 0 || totalFetched === allVideos.length) {
            console.log(`📺 Fetched ${totalFetched} videos so far...`);
          }
        }

        // Get next page token for pagination
        nextPageToken = playlistResponse.data.nextPageToken || undefined;
      } while (nextPageToken);

      if (allVideos.length === 0) {
        throw new Error("No videos found in playlist");
      }

      console.log(
        `✅ Successfully fetched ${allVideos.length} total videos from entire channel`
      );
      return allVideos;
    } catch (error) {
      console.error("❌ Error fetching real videos:", error);
      console.log("⚠️ Falling back to mock data");
      return this.getMockVideos();
    }
  }

  private getMockVideos(): any[] {
    return [
      {
        videoId: "dQw4w9WgXcQ",
        title: "Sample Video 1",
        description: "Sample description",
        publishedAt: new Date(),
        duration: 212,
        viewCount: 1_000_000,
        likeCount: 50_000,
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        videoUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      },
    ];
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration (e.g., "PT4M13S" = 253 seconds)
    const match = duration.match(DURATION_REGEX);
    if (!match) {
      return 0;
    }

    const hours = Number.parseInt(match[1] || "0", 10);
    const minutes = Number.parseInt(match[2] || "0", 10);
    const seconds = Number.parseInt(match[3] || "0", 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseVTTContent(vttContent: string): string {
    // Remove VTT headers and timestamps
    const lines = vttContent.split("\n");
    const transcriptLines: string[] = [];

    for (const line of lines) {
      // Skip empty lines, timestamps, and VTT headers
      if (
        line.trim() === "" ||
        line.includes("-->") ||
        line.startsWith("WEBVTT") ||
        VTT_NUMBER_REGEX.test(line.trim())
      ) {
        continue;
      }

      // Remove VTT tags
      const cleanLine = line
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (cleanLine) {
        transcriptLines.push(cleanLine);
      }
    }

    return transcriptLines.join(" ").trim();
  }

  private async createTranscriptChunks(
    videoDbId: string,
    transcript: string
  ): Promise<TranscriptChunk[]> {
    const sentences = this.splitIntoSentences(transcript);
    const chunks: TranscriptChunk[] = [];
    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;
    let startTime = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);

      if (currentTokens + sentenceTokens > CHUNK_SIZE && currentChunk) {
        // Save current chunk
        const [chunk] = await db
          .insert(transcriptChunk)
          .values({
            videoId: videoDbId,
            chunkIndex,
            content: currentChunk.trim(),
            startTime,
            endTime: startTime + Math.floor((currentTokens / 4) * 60), // rough time estimate
            tokenCount: currentTokens,
          })
          .returning();

        chunks.push(chunk);

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, CHUNK_OVERLAP);
        currentChunk = `${overlapText} ${sentence}`;
        currentTokens = this.estimateTokenCount(currentChunk);
        startTime = chunk.endTime;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Save final chunk
    if (currentChunk) {
      const [chunk] = await db
        .insert(transcriptChunk)
        .values({
          videoId: videoDbId,
          chunkIndex,
          content: currentChunk.trim(),
          startTime,
          endTime: startTime + Math.floor((currentTokens / 4) * 60),
          tokenCount: currentTokens,
        })
        .returning();

      chunks.push(chunk);
    }

    return chunks;
  }

  private async processChunk(chunk: TranscriptChunk): Promise<void> {
    // Extract keywords from chunk
    const keywordResult = await extractKeywordsFromTranscript(chunk.content);

    // Process keywords
    const keywords = keywordResult.keywords
      .slice(0, MAX_KEYWORDS_PER_CHUNK)
      .map((k) => ({
        videoId: chunk.videoId,
        chunkId: chunk.id,
        keyword: k.word,
        entityType: k.entity,
        confidence: Math.round(k.score * 100),
        frequency: 1, // This would be calculated from actual frequency
        relevance: Math.round(k.score * 100),
      }));

    // Insert keywords
    if (keywords.length > 0) {
      await db.insert(videoKeyword).values(keywords);
    }

    // Generate embedding for chunk
    try {
      const embedding = await this.generateEmbedding(chunk.content);
      await db
        .update(transcriptChunk)
        .set({ embedding })
        .where(eq(transcriptChunk.id, chunk.id));
    } catch (error) {
      console.error(
        `Failed to generate embedding for chunk ${chunk.id}:`,
        error
      );
    }
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(SENTENCE_SPLIT_REGEX)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(" ");
    const overlapWords = Math.floor(overlapTokens / 4);
    return words.slice(-overlapWords).join(" ");
  }

  private extractChannelIdFromUrl(url: string): string {
    // Extract channel ID from various YouTube URL formats
    for (const pattern of CHANNEL_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    throw new Error("Invalid YouTube channel URL");
  }

  private async updateIndexStatus(update: IndexStatusUpdate): Promise<void> {
    if (!this.channelDbId) {
      throw new Error("Channel database ID not set. Call indexChannel first.");
    }

    const updateData = this.buildUpdateData(update);

    await db
      .update(channelIndexStatus)
      .set(updateData)
      .where(eq(channelIndexStatus.channelId, this.channelDbId));
  }

  private buildUpdateData(update: IndexStatusUpdate) {
    const updateData: any = {
      status: update.status,
      progress: update.progress,
      totalVideos: update.totalVideos,
      processedVideos: update.processedVideos,
    };

    if (update.errorMessage) {
      updateData.errorMessage = update.errorMessage;
    }

    if (update.status === "completed") {
      updateData.completedAt = new Date();
    }

    return updateData;
  }

  private async markChannelAsIndexed(channelDbId: string): Promise<void> {
    await db
      .update(youtubeChannel)
      .set({
        isIndexed: true,
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(youtubeChannel.id, channelDbId));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not found");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002",
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  // New optimized method that processes videos in parallel with yt-dlp
  private async processVideoWithYtdlp(
    channelDbId: string,
    video: any
  ): Promise<void> {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { mkdir, readdir, readFile, rmdir, unlink } = await import(
      "node:fs/promises"
    );
    const { join } = await import("node:path");

    const execAsync = promisify(exec);
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    try {
      // Create temp directory
      const tempDir = join(process.cwd(), "temp_transcripts", video.videoId);
      await mkdir(tempDir, { recursive: true });

      // Get video metadata and transcript in one yt-dlp call
      // Use more robust yt-dlp options to handle problematic videos
      const command = `yt-dlp --write-auto-sub --write-subs --skip-download --sub-lang "en,en-US,en-GB" --sub-format "vtt/srt" --print "%(title)s|%(description)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --ignore-errors --no-warnings --extractor-retries 3 --fragment-retries 3 --write-info-json "${videoUrl}" -o "${join(tempDir, "%(id)s.%(ext)s")}"`;

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("yt-dlp timeout")), 30_000) // 30 second timeout
      );

      let transcript = "";
      let title = video.title;
      let description = "";
      let duration = video.duration;
      let viewCount = video.viewCount;
      let likeCount = video.likeCount;
      let uploadDate = video.publishedAt;

      try {
        const { stdout } = (await Promise.race([
          execAsync(command),
          timeoutPromise,
        ])) as any;

        // Parse metadata
        const [
          parsedTitle,
          parsedDescription,
          parsedDuration,
          parsedViewCount,
          parsedLikeCount,
          parsedUploadDate,
        ] = stdout.split("|");

        title = parsedTitle || video.title;
        description = parsedDescription || "";
        duration = parsedDuration
          ? Number.parseInt(parsedDuration, 10)
          : video.duration;
        viewCount = parsedViewCount
          ? Number.parseInt(parsedViewCount, 10)
          : video.viewCount;
        likeCount = parsedLikeCount
          ? Number.parseInt(parsedLikeCount, 10)
          : video.likeCount;
        uploadDate = parsedUploadDate
          ? this.parseUploadDate(parsedUploadDate)
          : video.publishedAt;

        // Find and read transcript
        const files = await readdir(tempDir);

        const vttFile = files.find((file) => file.includes(".en.vtt"));
        const srtFile = files.find((file) => file.includes(".en.srt"));
        const autoVttFile = files.find(
          (file) => file.endsWith(".vtt") && !file.includes(".en.vtt")
        );
        const autoSrtFile = files.find(
          (file) => file.endsWith(".srt") && !file.includes(".en.srt")
        );

        if (vttFile) {
          console.log(`📝 Found VTT file: ${vttFile}`);
          const vttContent = await readFile(join(tempDir, vttFile), "utf-8");
          transcript = this.parseVTTContent(vttContent);
        } else if (srtFile) {
          console.log(`📝 Found SRT file: ${srtFile}`);
          const srtContent = await readFile(join(tempDir, srtFile), "utf-8");
          transcript = this.parseSRTContent(srtContent);
        } else if (autoVttFile) {
          console.log(`📝 Found auto VTT file: ${autoVttFile}`);
          const vttContent = await readFile(
            join(tempDir, autoVttFile),
            "utf-8"
          );
          transcript = this.parseVTTContent(vttContent);
        } else if (autoSrtFile) {
          console.log(`📝 Found auto SRT file: ${autoSrtFile}`);
          const srtContent = await readFile(
            join(tempDir, autoSrtFile),
            "utf-8"
          );
          transcript = this.parseSRTContent(srtContent);
        } else {
          console.log(
            `❌ No subtitle files found for ${video.title}, trying fallback...`
          );

          // Try fallback command without language restrictions
          try {
            const fallbackCommand = `yt-dlp --write-auto-sub --write-subs --skip-download --sub-format "vtt/srt" --print "%(title)s|%(description)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --ignore-errors --no-warnings --extractor-retries 2 --fragment-retries 2 "${videoUrl}" -o "${join(tempDir, "%(id)s.%(ext)s")}"`;

            await Promise.race([execAsync(fallbackCommand), timeoutPromise]);

            // Check for files again
            const fallbackFiles = await readdir(tempDir);

            const anyVttFile = fallbackFiles.find((file) =>
              file.includes(".vtt")
            );
            const anySrtFile = fallbackFiles.find((file) =>
              file.includes(".srt")
            );

            if (anyVttFile) {
              const vttContent = await readFile(
                join(tempDir, anyVttFile),
                "utf-8"
              );
              transcript = this.parseVTTContent(vttContent);
            } else if (anySrtFile) {
              const srtContent = await readFile(
                join(tempDir, anySrtFile),
                "utf-8"
              );
              transcript = this.parseSRTContent(srtContent);
            }
          } catch (fallbackError) {
            console.log(
              `❌ Fallback also failed for ${video.title}:`,
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError)
            );
          }
        }

        // Clean up temp directory
        for (const file of files) {
          await unlink(join(tempDir, file));
        }
        await rmdir(tempDir);
      } catch (error) {
        // Clean up temp directory on error
        try {
          const files = await readdir(tempDir);
          for (const file of files) {
            await unlink(join(tempDir, file));
          }
          await rmdir(tempDir);
        } catch {
          // Ignore cleanup errors
        }

        console.log(
          `⚠️ Failed to process ${video.title}: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }

      if (!transcript) {
        console.log(`⚠️ No transcript available for: ${video.title}`);
        return;
      }

      // Create video record
      const [videoRecord] = await db
        .insert(youtubeVideo)
        .values({
          channelId: channelDbId,
          videoId: video.videoId,
          title: title || video.title,
          description: description || "",
          publishedAt: uploadDate ? new Date(uploadDate) : new Date(),
          duration: duration || 0,
          viewCount: viewCount || 0,
          likeCount: likeCount || 0,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          videoUrl,
          isTranscriptAvailable: true,
          transcript,
          transcriptLength: transcript.length,
        })
        .onConflictDoUpdate({
          target: youtubeVideo.videoId,
          set: {
            title: title || video.title,
            description: description || "",
            publishedAt: uploadDate ? new Date(uploadDate) : new Date(),
            duration: duration || 0,
            viewCount: viewCount || 0,
            likeCount: likeCount || 0,
            thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
            videoUrl,
            isTranscriptAvailable: true,
            transcript,
            transcriptLength: transcript.length,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Process transcript into chunks
      const chunks = await this.createTranscriptChunks(
        videoRecord.id,
        transcript
      );

      // Process chunks in parallel
      const CHUNK_BATCH_SIZE = 10;
      for (let i = 0; i < chunks.length; i += CHUNK_BATCH_SIZE) {
        const chunkBatch = chunks.slice(i, i + CHUNK_BATCH_SIZE);
        await Promise.all(chunkBatch.map((chunk) => this.processChunk(chunk)));
      }

      console.log(`✅ Processed: ${video.title} (${chunks.length} chunks)`);
    } catch (error) {
      console.error(`❌ Error processing ${video.title}:`, error);
      throw error;
    }
  }

  private parseUploadDate(uploadDate: string): string {
    try {
      // yt-dlp upload_date format is YYYYMMDD
      if (uploadDate && uploadDate.length === 8) {
        const year = uploadDate.substring(0, 4);
        const month = uploadDate.substring(4, 6);
        const day = uploadDate.substring(6, 8);
        return new Date(`${year}-${month}-${day}`).toISOString();
      }
      // Try parsing as regular date
      const date = new Date(uploadDate);
      if (Number.isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private parseSRTContent(srtContent: string): string {
    // Remove SRT headers and timestamps
    const lines = srtContent.split("\n");
    const transcriptLines: string[] = [];

    for (const line of lines) {
      // Skip empty lines, timestamps, and SRT headers
      if (
        line.trim() === "" ||
        line.includes("-->") ||
        VTT_NUMBER_REGEX.test(line.trim())
      ) {
        continue;
      }

      // Remove SRT tags
      const cleanLine = line
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (cleanLine) {
        transcriptLines.push(cleanLine);
      }
    }

    return transcriptLines.join(" ").trim();
  }
}
