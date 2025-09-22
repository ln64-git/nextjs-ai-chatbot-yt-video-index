import { tool } from "ai";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { transcriptChunk } from "@/lib/db/youtube-schema";

export const regenerateEmbeddings = tool({
  description:
    "Regenerate missing embeddings for transcript chunks to improve search functionality.",
  inputSchema: z.object({
    batchSize: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .default(100)
      .describe("Number of chunks to process in one batch"),
  }),
  execute: async ({ batchSize = 100 }) => {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return {
          success: false,
          message:
            "❌ **Embedding Regeneration Failed**\n\nOpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.",
        };
      }

      console.log("🔄 [EMBEDDING-REGEN] Starting embedding regeneration...");

      // Find chunks without embeddings
      const chunksWithoutEmbeddings = await db
        .select({
          id: transcriptChunk.id,
          content: transcriptChunk.content,
          videoId: transcriptChunk.videoId,
        })
        .from(transcriptChunk)
        .where(isNull(transcriptChunk.embedding))
        .limit(batchSize);

      console.log(
        `📊 [EMBEDDING-REGEN] Found ${chunksWithoutEmbeddings.length} chunks without embeddings`
      );

      if (chunksWithoutEmbeddings.length === 0) {
        return {
          success: true,
          message:
            "✅ **All Set!**\n\nAll transcript chunks already have embeddings. No regeneration needed.",
          processed: 0,
        };
      }

      // Generate embeddings for each chunk
      let processed = 0;
      let errors = 0;

      for (const chunk of chunksWithoutEmbeddings) {
        try {
          const embedding = await generateEmbedding(
            chunk.content,
            openaiApiKey
          );

          await db
            .update(transcriptChunk)
            .set({ embedding })
            .where(eq(transcriptChunk.id, chunk.id));

          processed++;

          if (processed % 10 === 0) {
            console.log(
              `🔄 [EMBEDDING-REGEN] Processed ${processed}/${chunksWithoutEmbeddings.length} chunks`
            );
          }
        } catch (error) {
          console.error(
            `❌ [EMBEDDING-REGEN] Error processing chunk ${chunk.id}:`,
            error
          );
          errors++;
        }
      }

      console.log(
        `✅ [EMBEDDING-REGEN] Completed: ${processed} processed, ${errors} errors`
      );

      return {
        success: true,
        message: `## 🔄 Embedding Regeneration Complete

**Results:**
- **Processed:** ${processed} chunks
- **Errors:** ${errors} chunks
- **Total Found:** ${chunksWithoutEmbeddings.length} chunks

${
  errors > 0
    ? `⚠️ **Note:** ${errors} chunks failed to process. This might be due to API rate limits or content issues.`
    : "✅ **Success:** All chunks processed successfully!"
}

Your search functionality should now work much better with proper semantic search capabilities.`,
        processed,
        errors,
        total: chunksWithoutEmbeddings.length,
      };
    } catch (error) {
      console.error("❌ [EMBEDDING-REGEN] Error:", error);
      return {
        success: false,
        message: `❌ **Embedding Regeneration Failed**

Error: ${error instanceof Error ? error.message : "Unknown error"}

Please check your OpenAI API key and database connection, then try again.`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
