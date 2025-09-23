-- YouTube Channel Indexing Schema
-- This migration adds comprehensive YouTube channel indexing capabilities

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- YouTube Channel table
CREATE TABLE IF NOT EXISTS "YouTubeChannel" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channelId" varchar(100) NOT NULL UNIQUE,
  "channelName" varchar(200) NOT NULL,
  "channelUrl" text NOT NULL,
  "description" text,
  "subscriberCount" integer,
  "videoCount" integer,
  "thumbnailUrl" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "isIndexed" boolean DEFAULT false NOT NULL,
  "lastIndexedAt" timestamp
);

-- YouTube Video table
CREATE TABLE IF NOT EXISTS "YouTubeVideo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "videoId" varchar(20) NOT NULL UNIQUE,
  "channelId" uuid NOT NULL REFERENCES "YouTubeChannel"("id"),
  "title" varchar(500) NOT NULL,
  "description" text,
  "publishedAt" timestamp NOT NULL,
  "duration" integer,
  "viewCount" integer,
  "likeCount" integer,
  "thumbnailUrl" text,
  "videoUrl" text NOT NULL,
  "transcript" text,
  "transcriptLength" integer,
  "isTranscriptAvailable" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Transcript Chunks table - segmented transcript pieces with timestamps
CREATE TABLE IF NOT EXISTS "TranscriptChunk" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "videoId" uuid NOT NULL REFERENCES "YouTubeVideo"("id"),
  "chunkIndex" integer NOT NULL,
  "content" text NOT NULL,
  "startTime" integer NOT NULL,
  "endTime" integer NOT NULL,
  "tokenCount" integer NOT NULL,
  "embedding" vector(1536),
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Keywords table - extracted keywords with metadata
CREATE TABLE IF NOT EXISTS "VideoKeyword" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "videoId" uuid NOT NULL REFERENCES "YouTubeVideo"("id"),
  "chunkId" uuid REFERENCES "TranscriptChunk"("id"),
  "keyword" varchar(200) NOT NULL,
  "entityType" varchar(50),
  "confidence" integer NOT NULL,
  "frequency" integer DEFAULT 1 NOT NULL,
  "relevance" integer NOT NULL,
  "embedding" vector(1536),
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Channel Index Status - track indexing progress
CREATE TABLE IF NOT EXISTS "ChannelIndexStatus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channelId" uuid NOT NULL REFERENCES "YouTubeChannel"("id"),
  "status" varchar(50) DEFAULT 'pending' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "totalVideos" integer DEFAULT 0 NOT NULL,
  "processedVideos" integer DEFAULT 0 NOT NULL,
  "totalChunks" integer DEFAULT 0 NOT NULL,
  "processedChunks" integer DEFAULT 0 NOT NULL,
  "errorMessage" text,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Search Queries - track user queries for analytics
CREATE TABLE IF NOT EXISTS "SearchQuery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channelId" uuid NOT NULL REFERENCES "YouTubeChannel"("id"),
  "query" text NOT NULL,
  "queryEmbedding" vector(1536),
  "resultsCount" integer DEFAULT 0 NOT NULL,
  "executionTime" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_channel_id" ON "YouTubeChannel"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_is_indexed" ON "YouTubeChannel"("isIndexed");

CREATE INDEX IF NOT EXISTS "idx_youtube_video_video_id" ON "YouTubeVideo"("videoId");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_channel_id" ON "YouTubeVideo"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_published_at" ON "YouTubeVideo"("publishedAt");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_transcript_available" ON "YouTubeVideo"("isTranscriptAvailable");

CREATE INDEX IF NOT EXISTS "idx_transcript_chunk_video_id" ON "TranscriptChunk"("videoId");
CREATE INDEX IF NOT EXISTS "idx_transcript_chunk_chunk_index" ON "TranscriptChunk"("chunkIndex");

CREATE INDEX IF NOT EXISTS "idx_video_keyword_video_id" ON "VideoKeyword"("videoId");
CREATE INDEX IF NOT EXISTS "idx_video_keyword_chunk_id" ON "VideoKeyword"("chunkId");
CREATE INDEX IF NOT EXISTS "idx_video_keyword_keyword" ON "VideoKeyword"("keyword");
CREATE INDEX IF NOT EXISTS "idx_video_keyword_entity_type" ON "VideoKeyword"("entityType");

-- Create vector similarity indexes for fast semantic search
CREATE INDEX IF NOT EXISTS "idx_transcript_chunk_embedding_cosine" ON "TranscriptChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS "idx_video_keyword_embedding_cosine" ON "VideoKeyword" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS "idx_search_query_embedding_cosine" ON "SearchQuery" USING ivfflat ("queryEmbedding" vector_cosine_ops) WITH (lists = 100);
