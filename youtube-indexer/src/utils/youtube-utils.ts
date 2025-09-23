/**
 * YouTube utility functions for link extraction and validation
 */

export type YouTubeLinkType = "channel" | "video" | "playlist" | "invalid";

export type YouTubeLinkInfo = {
  type: YouTubeLinkType;
  id: string;
  url: string;
  isValid: boolean;
};

/**
 * Extracts YouTube links from text and determines their type
 */
export function extractYouTubeLinks(text: string): YouTubeLinkInfo[] {
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:c\/|channel\/|@|user\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/g;
  const links: YouTubeLinkInfo[] = [];

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration
  while ((match = youtubeRegex.exec(text)) !== null) {
    const fullUrl = match[0];
    const id = match[1];

    const linkInfo = analyzeYouTubeLink(fullUrl, id);
    if (linkInfo.isValid) {
      links.push(linkInfo);
    }
  }

  return links;
}

/**
 * Analyzes a YouTube URL to determine its type and validity
 */
function analyzeYouTubeLink(url: string, id: string): YouTubeLinkInfo {
  // Normalize the URL
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Check for channel patterns
  if (url.includes("/c/") || url.includes("/channel/") || url.includes("/@")) {
    return {
      type: "channel",
      id,
      url: normalizedUrl,
      isValid: true,
    };
  }

  // Check for video patterns
  if (url.includes("youtu.be/") || url.includes("youtube.com/watch?v=")) {
    return {
      type: "video",
      id,
      url: normalizedUrl,
      isValid: true,
    };
  }

  // Check for playlist patterns
  if (url.includes("/playlist?list=")) {
    return {
      type: "playlist",
      id,
      url: normalizedUrl,
      isValid: true,
    };
  }

  return {
    type: "invalid",
    id,
    url: normalizedUrl,
    isValid: false,
  };
}

/**
 * Validates if a YouTube link is a channel link
 */
export function isYouTubeChannelLink(text: string): boolean {
  const links = extractYouTubeLinks(text);
  return links.some((link) => link.type === "channel" && link.isValid);
}

/**
 * Gets the first valid YouTube channel link from text
 */
export function getFirstChannelLink(text: string): YouTubeLinkInfo | null {
  const links = extractYouTubeLinks(text);
  return links.find((link) => link.type === "channel" && link.isValid) || null;
}

/**
 * Generates a response message for YouTube link validation
 */
export function generateYouTubeLinkResponse(
  linkInfo: YouTubeLinkInfo | null
): string {
  if (!linkInfo) {
    return "❌ No valid YouTube channel link found. Please provide a YouTube channel URL (e.g., https://youtube.com/@channelname or https://youtube.com/c/channelname)";
  }

  if (linkInfo.type === "channel") {
    return `✅ Valid YouTube channel link detected: ${linkInfo.url}\n\nI can help you index this channel's content for semantic search. Would you like me to proceed with indexing all videos from this channel?`;
  }

  if (linkInfo.type === "video") {
    return "❌ This appears to be a video link, not a channel link. Please provide a YouTube channel URL instead.";
  }

  if (linkInfo.type === "playlist") {
    return "❌ This appears to be a playlist link, not a channel link. Please provide a YouTube channel URL instead.";
  }

  return "❌ Invalid YouTube link format. Please provide a valid YouTube channel URL.";
}
