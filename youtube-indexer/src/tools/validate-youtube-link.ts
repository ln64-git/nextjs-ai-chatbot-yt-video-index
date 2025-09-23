import { tool } from "ai";
import { z } from "zod";
import {
  generateYouTubeLinkResponse,
  getFirstChannelLink,
  isYouTubeChannelLink,
} from "../utils/youtube-utils";

export const validateYouTubeLink = tool({
  description:
    "Use this tool whenever you see ANY YouTube URL in the user's message. It will validate if it's a proper YouTube channel link that can be indexed for semantic search.",
  inputSchema: z.object({
    message: z
      .string()
      .describe("The user's message to check for YouTube links"),
  }),
  execute: ({ message }: { message: string }) => {
    try {
      // Check if the message contains any YouTube links
      const hasChannelLink = isYouTubeChannelLink(message);

      if (!hasChannelLink) {
        return {
          success: false,
          message: generateYouTubeLinkResponse(null),
          linkInfo: null,
        };
      }

      // Get the first valid channel link
      const channelLink = getFirstChannelLink(message);

      if (!channelLink) {
        return {
          success: false,
          message: generateYouTubeLinkResponse(null),
          linkInfo: null,
        };
      }

      return {
        success: true,
        message: generateYouTubeLinkResponse(channelLink),
        linkInfo: channelLink,
      };
    } catch (error) {
      console.error("Error validating YouTube link:", error);
      return {
        success: false,
        message: "❌ Error processing YouTube link. Please try again.",
        linkInfo: null,
      };
    }
  },
});
