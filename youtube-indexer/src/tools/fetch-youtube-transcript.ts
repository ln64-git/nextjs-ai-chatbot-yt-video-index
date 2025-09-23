import { exec } from "node:child_process";
import { mkdir, readdir, readFile, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { tool } from "ai";
import { YoutubeTranscript } from "youtube-transcript";
import { z } from "zod";
import { extractKeywordsFromTranscript } from "../extract-keywords";

const execAsync = promisify(exec);

// Regex patterns for subtitle parsing
const SRT_NUMBER_REGEX = /^\d+$/;
const VTT_TIMESTAMP_REGEX = /<[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}><c>/g;
const VTT_CLOSE_TAG_REGEX = /<\/c>/g;
const HTML_TAG_REGEX = /<[^>]*>/g;
const TIMESTAMP_REGEX = /[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}/g;
const VIDEO_ID_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;

type VideoMetadata = {
  title: string;
  author_name: string;
};

// Simple cache for transcripts
const transcriptCache = new Map<
  string,
  { transcript: string; timestamp: number }
>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const fetchYouTubeTranscript = tool({
  description: "Fetch transcript from a YouTube video URL",
  inputSchema: z.object({
    url: z.string().describe("YouTube video URL"),
  }),
  execute: async ({ url }) => {
    try {
      console.log("🎬 [TRANSCRIPT] Starting transcript extraction for:", url);

      // Extract video ID
      const videoId = extractVideoId(url);
      if (!videoId) {
        return {
          success: false,
          message: "❌ Could not extract video ID from the provided URL.",
          transcript: "",
          videoId: "",
          transcriptLength: 0,
          summary: "",
        };
      }

      console.log("🔍 [TRANSCRIPT] Extracted video ID:", videoId);

      // Check cache first
      const cached = transcriptCache.get(videoId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log("⚡ [TRANSCRIPT] Using cached transcript");

        // Extract keywords from cached transcript
        console.log(
          "🔍 [KEYWORDS] Extracting keywords from cached transcript..."
        );
        const keywordResult = await extractKeywordsFromTranscript(
          cached.transcript
        );
        const keywordsDisplay = formatKeywordsForDisplay(keywordResult);

        return {
          success: true,
          message: `📝 **Video Analysis: Cached**\n\n**Video ID:** ${videoId}\n**Transcript Length:** ${cached.transcript.length} characters\n\n🎯 **Key Topics & Keywords:**\n${keywordsDisplay}\n\n✅ Using cached data - ready for discussion!`,
          transcript: cached.transcript,
          videoId,
          transcriptLength: cached.transcript.length,
          keywords: keywordResult.keywords,
          groupedKeywords: keywordResult.groupedKeywords,
          totalKeywords: keywordResult.totalCount,
          summary:
            cached.transcript.split(" ").slice(0, 200).join(" ") +
            (cached.transcript.split(" ").length > 200 ? "..." : ""),
        };
      }

      // Get video metadata
      const metadata = await getVideoMetadata(videoId);
      console.log(
        `📊 [TRANSCRIPT] Video: ${metadata.title} by ${metadata.author_name}`
      );

      // Try to extract transcript
      let transcript = "";

      // Method 1: Try youtube-transcript library first (fastest)
      try {
        console.log("📡 [TRANSCRIPT] Trying youtube-transcript library...");
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcriptData && transcriptData.length > 0) {
          transcript = transcriptData
            .map((item) => item.text)
            .join(" ")
            .trim();
          console.log(
            `✅ [TRANSCRIPT] Success via youtube-transcript: ${transcript.length} chars`
          );
        }
      } catch (error) {
        console.log("⚠️ [TRANSCRIPT] youtube-transcript failed:", error);
      }

      // Method 2: Try yt-dlp as fallback
      if (!transcript) {
        console.log("📥 [TRANSCRIPT] Trying yt-dlp fallback...");
        transcript = await extractTranscriptViaYtDlp(videoId);
      }

      if (!transcript) {
        return {
          success: false,
          message: `❌ **Transcript Not Available**\n\n**Video:** ${metadata.title}\n**Author:** ${metadata.author_name}\n\nThis video may not have captions available, or they may be restricted.`,
          transcript: "",
          videoId,
          videoTitle: metadata.title,
          videoAuthor: metadata.author_name,
          transcriptLength: 0,
          summary: "",
        };
      }

      // Cache the transcript
      transcriptCache.set(videoId, {
        transcript,
        timestamp: Date.now(),
      });

      console.log(
        `✅ [TRANSCRIPT] Successfully extracted transcript: ${transcript.length} characters`
      );

      // Extract keywords from the transcript
      console.log("🔍 [KEYWORDS] Starting keyword extraction...");
      const keywordResult = await extractKeywordsFromTranscript(transcript);
      console.log("✅ [KEYWORDS] Keyword extraction complete:", {
        totalKeywords: keywordResult.totalCount,
        topCategories: Object.keys(keywordResult.groupedKeywords),
      });

      // Format keywords for display
      const keywordsDisplay = formatKeywordsForDisplay(keywordResult);

      return {
        success: true,
        message: `📝 **Video Analysis Complete**\n\n**Video:** ${metadata.title}\n**Author:** ${metadata.author_name}\n**Video ID:** ${videoId}\n**Transcript Length:** ${transcript.length} characters\n\n🎯 **Key Topics & Keywords:**\n${keywordsDisplay}\n\n✅ Analysis complete - ready for further discussion!`,
        transcript,
        videoId,
        videoTitle: metadata.title,
        videoAuthor: metadata.author_name,
        transcriptLength: transcript.length,
        keywords: keywordResult.keywords,
        groupedKeywords: keywordResult.groupedKeywords,
        totalKeywords: keywordResult.totalCount,
        summary:
          transcript.split(" ").slice(0, 200).join(" ") +
          (transcript.split(" ").length > 200 ? "..." : ""),
      };
    } catch (error) {
      console.error("❌ [TRANSCRIPT] Error:", error);
      return {
        success: false,
        message:
          "❌ An error occurred while fetching the transcript. Please try again.",
        transcript: "",
        videoId: "",
        transcriptLength: 0,
        summary: "",
      };
    }
  },
});

function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_REGEX);
  return match?.[1] || null;
}

async function getVideoMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (response.ok) {
      return (await response.json()) as VideoMetadata;
    }
  } catch (error) {
    console.error("Error fetching metadata:", error);
  }
  return { title: "Unknown", author_name: "Unknown" };
}

async function extractTranscriptViaYtDlp(videoId: string): Promise<string> {
  const tempDir = join(process.cwd(), "temp_transcripts");

  try {
    await mkdir(tempDir, { recursive: true });

    const command = `yt-dlp --write-subs --write-auto-subs --sub-langs en,en-US,en-GB --skip-download --output "${tempDir}/%(title)s.%(ext)s" "https://www.youtube.com/watch?v=${videoId}"`;

    try {
      await execAsync(command);
    } catch (error) {
      console.log("⚠️ [TRANSCRIPT] yt-dlp command failed:", error);
      return "";
    }

    const files = await readdir(tempDir);
    const subtitleFiles = files.filter(
      (f) => f.endsWith(".vtt") || f.endsWith(".srt") || f.endsWith(".json")
    );

    for (const file of subtitleFiles) {
      const filePath = join(tempDir, file);
      const transcript = await parseSubtitleFile(filePath, file);

      if (transcript) {
        console.log(
          `✅ [TRANSCRIPT] Success via yt-dlp: ${transcript.length} chars`
        );
        await unlink(filePath).catch(() => {
          // Ignore cleanup errors
        });
        await rmdir(tempDir).catch(() => {
          // Ignore cleanup errors
        });
        return transcript;
      }
    }

    await rmdir(tempDir).catch(() => {
      // Ignore cleanup errors
    });
    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] yt-dlp method failed:", error);
    return "";
  }
}

function parseVTT(content: string): string {
  return content
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("WEBVTT") &&
        !line.includes("-->") &&
        !line.match(SRT_NUMBER_REGEX) &&
        line.trim()
    )
    .map((line) =>
      line
        .replace(VTT_TIMESTAMP_REGEX, "")
        .replace(VTT_CLOSE_TAG_REGEX, "")
        .replace(HTML_TAG_REGEX, "")
        .replace(TIMESTAMP_REGEX, "")
        .trim()
    )
    .filter(
      (line) =>
        !line.startsWith("Kind:") && !line.startsWith("Language:") && line
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSRT(content: string): string {
  return content
    .split("\n")
    .filter(
      (line) =>
        !line.match(SRT_NUMBER_REGEX) && !line.includes("-->") && line.trim()
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJSON(content: string): string {
  try {
    const data = JSON.parse(content);
    return (
      data.events
        ?.map((event: any) => event.segs?.map((seg: any) => seg.utf8).join(""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim() || ""
    );
  } catch {
    return "";
  }
}

async function parseSubtitleFile(
  filePath: string,
  fileName: string
): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  if (content.length < 10) {
    return "";
  }

  let transcript = "";
  if (fileName.endsWith(".vtt")) {
    transcript = parseVTT(content);
  } else if (fileName.endsWith(".srt")) {
    transcript = parseSRT(content);
  } else if (fileName.endsWith(".json")) {
    transcript = parseJSON(content);
  }

  return transcript.length > 10 ? transcript : "";
}

// Helper function to format keywords for display
function formatKeywordsForDisplay(keywordResult: {
  keywords: Array<{ word: string; entity: string; score: number }>;
  groupedKeywords: Record<
    string,
    Array<{ word: string; entity: string; score: number }>
  >;
  totalCount: number;
}): string {
  let display = `**Total Keywords Found:** ${keywordResult.totalCount}\n\n`;

  // Show top keywords by category
  const topCategories = Object.entries(keywordResult.groupedKeywords)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5);

  for (const [category, keywords] of topCategories) {
    if (keywords.length > 0) {
      const topKeywords = keywords
        .slice(0, 8)
        .map((k) => k.word)
        .join(", ");
      display += `**${category.charAt(0).toUpperCase() + category.slice(1)}:** ${topKeywords}\n`;
    }
  }

  // Show top overall keywords
  const topKeywords = keywordResult.keywords
    .slice(0, 15)
    .map((k) => k.word)
    .join(", ");

  display += `\n**Top Keywords:** ${topKeywords}`;

  return display;
}
