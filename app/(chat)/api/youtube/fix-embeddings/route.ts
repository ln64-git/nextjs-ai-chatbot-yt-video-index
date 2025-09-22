import { eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { transcriptChunk } from "@/lib/db/youtube-schema";

export async function POST() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    console.log("🔄 [EMBEDDING-FIX] Starting embedding regeneration...");

    // Find chunks without embeddings
    const chunksWithoutEmbeddings = await db
      .select({
        id: transcriptChunk.id,
        content: transcriptChunk.content,
        videoId: transcriptChunk.videoId,
      })
      .from(transcriptChunk)
      .where(isNull(transcriptChunk.embedding))
      .limit(100); // Process in batches

    console.log(
      `📊 [EMBEDDING-FIX] Found ${chunksWithoutEmbeddings.length} chunks without embeddings`
    );

    if (chunksWithoutEmbeddings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All chunks already have embeddings",
        processed: 0,
      });
    }

    // Generate embeddings for each chunk
    let processed = 0;
    let errors = 0;

    for (const chunk of chunksWithoutEmbeddings) {
      try {
        const embedding = await generateEmbedding(chunk.content, openaiApiKey);

        await db
          .update(transcriptChunk)
          .set({ embedding })
          .where(eq(transcriptChunk.id, chunk.id));

        processed++;

        if (processed % 10 === 0) {
          console.log(
            `🔄 [EMBEDDING-FIX] Processed ${processed}/${chunksWithoutEmbeddings.length} chunks`
          );
        }
      } catch (error) {
        console.error(
          `❌ [EMBEDDING-FIX] Error processing chunk ${chunk.id}:`,
          error
        );
        errors++;
      }
    }

    console.log(
      `✅ [EMBEDDING-FIX] Completed: ${processed} processed, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      message: "Embedding regeneration completed",
      processed,
      errors,
      total: chunksWithoutEmbeddings.length,
    });
  } catch (error) {
    console.error("❌ [EMBEDDING-FIX] Error:", error);
    return NextResponse.json(
      {
        error: "Embedding regeneration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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
