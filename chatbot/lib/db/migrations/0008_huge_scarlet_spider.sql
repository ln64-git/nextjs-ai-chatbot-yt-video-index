-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "ChannelIndexStatus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" uuid NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SearchQuery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" uuid NOT NULL,
	"query" text NOT NULL,
	"queryEmbedding" vector(1536),
	"resultsCount" integer DEFAULT 0 NOT NULL,
	"executionTime" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TranscriptChunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" uuid NOT NULL,
	"chunkIndex" integer NOT NULL,
	"content" text NOT NULL,
	"startTime" integer NOT NULL,
	"endTime" integer NOT NULL,
	"tokenCount" integer NOT NULL,
	"embedding" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "VideoKeyword" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" uuid NOT NULL,
	"chunkId" uuid,
	"keyword" varchar(200) NOT NULL,
	"entityType" varchar(50),
	"confidence" integer NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"relevance" integer NOT NULL,
	"embedding" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "YouTubeChannel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" varchar(100) NOT NULL,
	"channelName" varchar(200) NOT NULL,
	"channelUrl" text NOT NULL,
	"description" text,
	"subscriberCount" integer,
	"videoCount" integer,
	"thumbnailUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"isIndexed" boolean DEFAULT false NOT NULL,
	"lastIndexedAt" timestamp,
	CONSTRAINT "YouTubeChannel_channelId_unique" UNIQUE("channelId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "YouTubeVideo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" varchar(20) NOT NULL,
	"channelId" uuid NOT NULL,
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
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "YouTubeVideo_videoId_unique" UNIQUE("videoId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChannelIndexStatus" ADD CONSTRAINT "ChannelIndexStatus_channelId_YouTubeChannel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_channelId_YouTubeChannel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_videoId_YouTubeVideo_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."YouTubeVideo"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VideoKeyword" ADD CONSTRAINT "VideoKeyword_videoId_YouTubeVideo_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."YouTubeVideo"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VideoKeyword" ADD CONSTRAINT "VideoKeyword_chunkId_TranscriptChunk_id_fk" FOREIGN KEY ("chunkId") REFERENCES "public"."TranscriptChunk"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_channelId_YouTubeChannel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
