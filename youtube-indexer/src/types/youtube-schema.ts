import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// YouTube Channel table
export const youtubeChannel = pgTable("YouTubeChannel", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  channelId: varchar("channelId", { length: 100 }).notNull().unique(),
  channelName: varchar("channelName", { length: 200 }).notNull(),
  channelUrl: text("channelUrl").notNull(),
  description: text("description"),
  subscriberCount: integer("subscriberCount"),
  videoCount: integer("videoCount"),
  thumbnailUrl: text("thumbnailUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  isIndexed: boolean("isIndexed").notNull().default(false),
  lastIndexedAt: timestamp("lastIndexedAt"),
});

// YouTube Video table
export const youtubeVideo = pgTable("YouTubeVideo", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  videoId: varchar("videoId", { length: 20 }).notNull().unique(),
  channelId: uuid("channelId")
    .notNull()
    .references(() => youtubeChannel.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  publishedAt: timestamp("publishedAt").notNull(),
  duration: integer("duration"), // in seconds
  viewCount: integer("viewCount"),
  likeCount: integer("likeCount"),
  thumbnailUrl: text("thumbnailUrl"),
  videoUrl: text("videoUrl").notNull(),
  transcript: text("transcript"),
  transcriptLength: integer("transcriptLength"),
  isTranscriptAvailable: boolean("isTranscriptAvailable")
    .notNull()
    .default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Transcript Chunks table - segmented transcript pieces with timestamps
export const transcriptChunk = pgTable("TranscriptChunk", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  videoId: uuid("videoId")
    .notNull()
    .references(() => youtubeVideo.id),
  chunkIndex: integer("chunkIndex").notNull(), // order within video
  content: text("content").notNull(),
  startTime: integer("startTime").notNull(), // in seconds
  endTime: integer("endTime").notNull(), // in seconds
  tokenCount: integer("tokenCount").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-large
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Keywords table - extracted keywords with metadata
export const videoKeyword = pgTable("VideoKeyword", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  videoId: uuid("videoId")
    .notNull()
    .references(() => youtubeVideo.id),
  chunkId: uuid("chunkId").references(() => transcriptChunk.id), // optional - keyword can be video-level or chunk-level
  keyword: varchar("keyword", { length: 200 }).notNull(),
  entityType: varchar("entityType", { length: 50 }), // PERSON, ORG, LOCATION, etc.
  confidence: integer("confidence").notNull(), // 0-100
  frequency: integer("frequency").notNull().default(1), // how many times it appears
  relevance: integer("relevance").notNull(), // 0-100
  embedding: vector("embedding", { dimensions: 1536 }), // optional keyword embedding
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Channel Index Status - track indexing progress
export const channelIndexStatus = pgTable("ChannelIndexStatus", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  channelId: uuid("channelId")
    .notNull()
    .references(() => youtubeChannel.id),
  status: varchar("status", {
    enum: [
      "pending",
      "indexing_videos",
      "extracting_transcripts",
      "processing_chunks",
      "generating_embeddings",
      "completed",
      "failed",
    ],
  })
    .notNull()
    .default("pending"),
  progress: integer("progress").notNull().default(0), // 0-100
  totalVideos: integer("totalVideos").notNull().default(0),
  processedVideos: integer("processedVideos").notNull().default(0),
  totalChunks: integer("totalChunks").notNull().default(0),
  processedChunks: integer("processedChunks").notNull().default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").notNull().defaultNow(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Search Queries - track user queries for analytics
export const searchQuery = pgTable("SearchQuery", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  channelId: uuid("channelId")
    .notNull()
    .references(() => youtubeChannel.id),
  query: text("query").notNull(),
  queryEmbedding: vector("queryEmbedding", { dimensions: 1536 }),
  resultsCount: integer("resultsCount").notNull().default(0),
  executionTime: integer("executionTime"), // in milliseconds
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Type exports
export type YouTubeChannel = InferSelectModel<typeof youtubeChannel>;
export type YouTubeVideo = InferSelectModel<typeof youtubeVideo>;
export type TranscriptChunk = InferSelectModel<typeof transcriptChunk>;
export type VideoKeyword = InferSelectModel<typeof videoKeyword>;
export type ChannelIndexStatus = InferSelectModel<typeof channelIndexStatus>;
export type SearchQuery = InferSelectModel<typeof searchQuery>;

// Indexes for performance
export const youtubeChannelIndexes = {
  channelId: youtubeChannel.channelId,
  isIndexed: youtubeChannel.isIndexed,
};

export const youtubeVideoIndexes = {
  videoId: youtubeVideo.videoId,
  channelId: youtubeVideo.channelId,
  publishedAt: youtubeVideo.publishedAt,
  isTranscriptAvailable: youtubeVideo.isTranscriptAvailable,
};

export const transcriptChunkIndexes = {
  videoId: transcriptChunk.videoId,
  chunkIndex: transcriptChunk.chunkIndex,
  // Vector similarity search will use the embedding column
};

export const videoKeywordIndexes = {
  videoId: videoKeyword.videoId,
  chunkId: videoKeyword.chunkId,
  keyword: videoKeyword.keyword,
  entityType: videoKeyword.entityType,
  // Vector similarity search will use the embedding column
};
