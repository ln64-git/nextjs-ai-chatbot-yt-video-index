import { tool } from "ai";
import { z } from "zod";
import { SemanticSearchService } from "@/lib/services/semantic-search";

export const testSearch = tool({
  description:
    "Test the search functionality with detailed debugging information to diagnose search issues.",
  inputSchema: z.object({
    query: z.string().describe("Search query to test"),
    channelId: z
      .string()
      .optional()
      .describe("Optional channel ID to limit search"),
    similarityThreshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.5)
      .describe("Similarity threshold for vector search"),
  }),
  execute: async ({ query, channelId, similarityThreshold = 0.5 }) => {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return {
          success: false,
          message:
            "❌ **Search Test Failed**\n\nOpenAI API key not configured.",
        };
      }

      console.log(`🧪 [SEARCH-TEST] Testing search for: "${query}"`);
      console.log(
        `🧪 [SEARCH-TEST] Similarity threshold: ${similarityThreshold}`
      );

      const searchService = new SemanticSearchService(openaiApiKey);

      // Test with different thresholds to see what's happening
      const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9];
      const results: any[] = [];

      for (const threshold of thresholds) {
        try {
          const searchResults = await searchService.search(query, {
            channelId,
            limit: 5,
            similarityThreshold: threshold,
            includeKeywords: true,
          });

          results.push({
            threshold,
            count: searchResults.length,
            results: searchResults.map((r) => ({
              videoTitle: r.video.title,
              relevanceScore: r.relevanceScore,
              startTime: r.startTime,
              endTime: r.endTime,
              contentPreview: `${r.chunk.content.substring(0, 100)}...`,
              matchedKeywords: r.matchedKeywords,
            })),
          });

          console.log(
            `🧪 [SEARCH-TEST] Threshold ${threshold}: ${searchResults.length} results`
          );
        } catch (error) {
          console.error(
            `❌ [SEARCH-TEST] Threshold ${threshold} failed:`,
            error
          );
          results.push({
            threshold,
            count: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Generate a detailed report
      const report = `## 🧪 Search Test Results

**Query:** "${query}"
**Channel ID:** ${channelId || "All channels"}
**Original Threshold:** ${similarityThreshold}

### Results by Threshold:

${results
  .map((r) =>
    r.error
      ? `**Threshold ${r.threshold}:** ❌ Error - ${r.error}`
      : `**Threshold ${r.threshold}:** ${r.count} results
${
  r.results.length > 0
    ? r.results
        .map(
          (result: any, i: number) =>
            `${i + 1}. **${result.videoTitle}** (Score: ${result.relevanceScore.toFixed(3)})
   - Time: ${Math.floor(result.startTime / 60)}:${(result.startTime % 60).toString().padStart(2, "0")} - ${Math.floor(result.endTime / 60)}:${(result.endTime % 60).toString().padStart(2, "0")}
   - Keywords: ${result.matchedKeywords.join(", ")}
   - Preview: "${result.contentPreview}"`
        )
        .join("\n\n")
    : "   No results"
}`
  )
  .join("\n\n")}

### Analysis:
${
  results.some((r) => r.count > 0)
    ? "✅ Search is working, but results may not be semantically relevant. Consider adjusting the similarity threshold or checking embedding quality."
    : "❌ Search is not returning any results. Check database content and embedding generation."
}`;

      return {
        success: true,
        message: report,
        testResults: results,
        query,
        channelId,
        similarityThreshold,
      };
    } catch (error) {
      console.error("❌ [SEARCH-TEST] Error:", error);
      return {
        success: false,
        message: `❌ **Search Test Failed**

Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
