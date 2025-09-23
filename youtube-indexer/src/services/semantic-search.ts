import { and, desc, eq, sql } from "drizzle-orm";

// Database interface - will be injected from the chatbot
let db: any = null;

import {
  searchQuery,
  type TranscriptChunk,
  transcriptChunk,
  videoKeyword,
  type YouTubeVideo,
  youtubeChannel,
  youtubeVideo,
} from "../types/youtube-schema";

// Move regex patterns to top level for performance
const WORD_SPLIT_REGEX = /\s+/;
const QUERY_WORD_REGEX = /\s+/;

export type SearchResult = {
  chunk: TranscriptChunk;
  video: YouTubeVideo;
  channel: { channelName: string; channelUrl: string };
  relevanceScore: number;
  matchedKeywords: string[];
  startTime: number;
  endTime: number;
};

export type SearchOptions = {
  channelId?: string;
  limit?: number;
  similarityThreshold?: number;
  includeKeywords?: boolean;
};

export class SemanticSearchService {
  static setDatabase(database: any) {
    db = database;
  }
  private readonly openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      channelId,
      limit = 10,
      similarityThreshold = 0.5,
      includeKeywords = true,
    } = options;

    console.log(`🔍 [SEARCH] Searching for: "${query}"`);

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);
    console.log(
      `🔍 [SEARCH] Generated embedding with ${queryEmbedding.length} dimensions`
    );

    // Convert channel handle to database UUID if needed
    let channelDbId: string | undefined;
    if (channelId) {
      const dbId = await this.getChannelDbIdByHandle(channelId);
      if (!dbId) {
        console.log(`⚠️ [SEARCH] Channel not found: ${channelId}`);
        return [];
      }
      channelDbId = dbId;
    }

    // Log the search query
    await this.logSearchQuery(query, queryEmbedding, channelDbId);

    // Search for similar chunks using vector similarity
    let chunkSimilarities: { chunk: TranscriptChunk; similarity: number }[] =
      [];
    try {
      chunkSimilarities = await this.findSimilarChunks(
        queryEmbedding,
        channelDbId,
        limit * 2, // Get more results for keyword filtering
        similarityThreshold
      );
      console.log(
        `🔍 [SEARCH] Found ${chunkSimilarities.length} similar chunks via vector search`
      );
    } catch (error) {
      console.error("❌ [SEARCH] Vector search failed:", error);
      // Fall back to keyword search only
      chunkSimilarities = [];
    }

    // If no vector results, fallback to keyword search
    if (chunkSimilarities.length === 0) {
      console.log("🔄 [SEARCH] No vector results, trying keyword search...");
      try {
        return await this.keywordSearch(query, options);
      } catch (error) {
        console.error("❌ [SEARCH] Keyword search also failed:", error);
        return [];
      }
    }

    // Process results and add metadata
    const results: SearchResult[] = [];

    for (const { chunk, similarity } of chunkSimilarities) {
      try {
        const video = await this.getVideoById(chunk.videoId);
        if (!video) {
          console.log(`⚠️ [SEARCH] Video not found for chunk ${chunk.id}`);
          continue;
        }

        const channel = await this.getChannelById(video.channelId);
        if (!channel) {
          console.log(`⚠️ [SEARCH] Channel not found for video ${video.id}`);
          continue;
        }

        // Find matching keywords in this chunk
        const matchedKeywords = includeKeywords
          ? await this.findMatchingKeywords(chunk.id, query)
          : [];

        results.push({
          chunk,
          video,
          channel: {
            channelName: channel.channelName,
            channelUrl: channel.channelUrl,
          },
          relevanceScore: this.calculateRelevanceScore(
            chunk,
            query,
            matchedKeywords,
            similarity
          ),
          matchedKeywords,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        });
      } catch (error) {
        console.error(`❌ [SEARCH] Error processing chunk ${chunk.id}:`, error);
        // Continue with next chunk
      }
    }

    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private async findSimilarChunks(
    queryEmbedding: number[],
    channelDbId?: string,
    limit = 20,
    threshold = 0.5
  ): Promise<{ chunk: TranscriptChunk; similarity: number }[]> {
    let whereClause = sql`${transcriptChunk.embedding} IS NOT NULL`;

    if (channelDbId) {
      whereClause = sql`${whereClause} AND ${youtubeVideo.channelId} = ${channelDbId}`;
    }

    // Use pgvector cosine similarity - fix the vector casting
    const results = await db
      .select({
        chunk: transcriptChunk,
        similarity: sql<number>`1 - (${transcriptChunk.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'::vector`)})`,
      })
      .from(transcriptChunk)
      .innerJoin(youtubeVideo, eq(transcriptChunk.videoId, youtubeVideo.id))
      .where(
        sql`${whereClause} AND 1 - (${transcriptChunk.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'::vector`)}) > ${threshold}`
      )
      .orderBy(
        sql`${transcriptChunk.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'::vector`)}`
      )
      .limit(limit);

    return results.map((r: any) => ({
      chunk: r.chunk,
      similarity: r.similarity,
    }));
  }

  private async keywordSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { channelId, limit = 10 } = options;

    // Convert channel handle to database UUID if needed
    let channelDbId: string | undefined;
    if (channelId) {
      const dbId = await this.getChannelDbIdByHandle(channelId);
      if (!dbId) {
        console.log(`⚠️ [KEYWORD-SEARCH] Channel not found: ${channelId}`);
        return [];
      }
      channelDbId = dbId;
    }

    // Extract keywords from query
    const queryKeywords = this.extractKeywordsFromQuery(query);

    if (queryKeywords.length === 0) {
      return [];
    }

    // Search for chunks containing these keywords
    const keywordConditions = queryKeywords.map(
      (keyword) =>
        sql`LOWER(${videoKeyword.keyword}) LIKE LOWER(${`%${keyword}%`})`
    );

    let whereClause = sql`${sql.join(keywordConditions, sql` OR `)}`;

    if (channelDbId) {
      whereClause = sql`${whereClause} AND ${youtubeVideo.channelId} = ${channelDbId}`;
    }

    const results = await db
      .select({
        chunk: transcriptChunk,
        keyword: videoKeyword.keyword,
        confidence: videoKeyword.confidence,
      })
      .from(videoKeyword)
      .innerJoin(transcriptChunk, eq(videoKeyword.chunkId, transcriptChunk.id))
      .innerJoin(youtubeVideo, eq(transcriptChunk.videoId, youtubeVideo.id))
      .where(whereClause)
      .orderBy(desc(videoKeyword.confidence))
      .limit(limit * 2);

    // Group by chunk and process
    const chunkMap = new Map<
      string,
      { chunk: TranscriptChunk; keywords: string[] }
    >();

    for (const result of results) {
      const chunkId = result.chunk.id;
      if (!chunkMap.has(chunkId)) {
        chunkMap.set(chunkId, { chunk: result.chunk, keywords: [] });
      }
      const chunkData = chunkMap.get(chunkId);
      if (chunkData) {
        chunkData.keywords.push(result.keyword);
      }
    }

    // Convert to SearchResult format
    const searchResults: SearchResult[] = [];

    for (const [, data] of chunkMap) {
      const video = await this.getVideoById(data.chunk.videoId);
      if (!video) {
        continue;
      }

      const channel = await this.getChannelById(video.channelId);
      if (!channel) {
        continue;
      }

      searchResults.push({
        chunk: data.chunk,
        video,
        channel: {
          channelName: channel.channelName,
          channelUrl: channel.channelUrl,
        },
        relevanceScore: this.calculateKeywordRelevanceScore(
          data.keywords,
          queryKeywords
        ),
        matchedKeywords: data.keywords,
        startTime: data.chunk.startTime,
        endTime: data.chunk.endTime,
      });
    }

    return searchResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private async findMatchingKeywords(
    chunkId: string,
    query: string
  ): Promise<string[]> {
    const queryKeywords = this.extractKeywordsFromQuery(query);

    if (queryKeywords.length === 0) {
      return [];
    }

    // Create individual LIKE conditions for each keyword
    const keywordConditions = queryKeywords.map(
      (keyword) =>
        sql`LOWER(${videoKeyword.keyword}) LIKE LOWER(${`%${keyword}%`})`
    );

    const keywords = await db
      .select({ keyword: videoKeyword.keyword })
      .from(videoKeyword)
      .where(
        and(
          eq(videoKeyword.chunkId, chunkId),
          sql`${sql.join(keywordConditions, sql` OR `)}`
        )
      );

    return keywords.map((k: any) => k.keyword);
  }

  private extractKeywordsFromQuery(query: string): string[] {
    // Simple keyword extraction from query
    return query
      .toLowerCase()
      .split(QUERY_WORD_REGEX)
      .filter((word) => word.length > 2)
      .filter((word) => !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "her",
      "its",
      "our",
      "their",
    ]);
    return stopWords.has(word);
  }

  private calculateRelevanceScore(
    chunk: TranscriptChunk,
    query: string,
    matchedKeywords: string[],
    similarity: number
  ): number {
    // Start with the actual vector similarity score (0-1)
    let score = similarity;

    // Boost score based on matched keywords
    score += matchedKeywords.length * 0.05;

    // Boost score for exact phrase matches
    if (chunk.content.toLowerCase().includes(query.toLowerCase())) {
      score += 0.1;
    }

    // Boost score for partial matches
    const queryWords = query.toLowerCase().split(WORD_SPLIT_REGEX);
    const contentWords = chunk.content.toLowerCase().split(WORD_SPLIT_REGEX);
    const matchingWords = queryWords.filter((word) =>
      contentWords.some((contentWord: string) => contentWord.includes(word))
    );
    score += (matchingWords.length / queryWords.length) * 0.05;

    return Math.min(score, 1.0);
  }

  private calculateKeywordRelevanceScore(
    matchedKeywords: string[],
    queryKeywords: string[]
  ): number {
    if (matchedKeywords.length === 0) {
      return 0;
    }

    const intersection = queryKeywords.filter((qk) =>
      matchedKeywords.some((mk) => mk.toLowerCase().includes(qk.toLowerCase()))
    );

    return intersection.length / queryKeywords.length;
  }

  private async getVideoById(videoId: string): Promise<YouTubeVideo | null> {
    const [video] = await db
      .select()
      .from(youtubeVideo)
      .where(eq(youtubeVideo.id, videoId))
      .limit(1);

    return video || null;
  }

  private async getChannelById(
    channelId: string
  ): Promise<{ channelName: string; channelUrl: string } | null> {
    const [channel] = await db
      .select({
        channelName: youtubeChannel.channelName,
        channelUrl: youtubeChannel.channelUrl,
      })
      .from(youtubeChannel)
      .where(eq(youtubeChannel.id, channelId))
      .limit(1);

    return channel || null;
  }

  private async getChannelDbIdByHandle(
    channelHandle: string
  ): Promise<string | null> {
    const [channel] = await db
      .select({ id: youtubeChannel.id })
      .from(youtubeChannel)
      .where(eq(youtubeChannel.channelId, channelHandle))
      .limit(1);

    return channel?.id || null;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // In production, this would call OpenAI API
    // For now, return a mock embedding
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
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

  private async logSearchQuery(
    query: string,
    queryEmbedding: number[],
    channelId?: string
  ): Promise<void> {
    try {
      // Only log if we have a valid channelId
      if (channelId) {
        await db.insert(searchQuery).values({
          channelId,
          query,
          queryEmbedding,
          resultsCount: 0, // Will be updated after search
          executionTime: 0, // Will be calculated
        });
      }
    } catch (error) {
      console.error("Failed to log search query:", error);
    }
  }
}
