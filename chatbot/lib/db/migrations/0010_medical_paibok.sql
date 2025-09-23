CREATE TABLE IF NOT EXISTS "ChannelIndexStatus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress" varchar(10) DEFAULT '0' NOT NULL,
	"totalVideos" varchar(10) DEFAULT '0' NOT NULL,
	"processedVideos" varchar(10) DEFAULT '0' NOT NULL,
	"totalChunks" varchar(10) DEFAULT '0' NOT NULL,
	"processedChunks" varchar(10) DEFAULT '0' NOT NULL,
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
	"queryEmbedding" text,
	"resultsCount" varchar(10) DEFAULT '0' NOT NULL,
	"executionTime" varchar(10),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TranscriptChunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" uuid NOT NULL,
	"content" text NOT NULL,
	"startTime" varchar(50) NOT NULL,
	"endTime" varchar(50) NOT NULL,
	"embedding" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "VideoKeyword" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"entity" varchar(100) NOT NULL,
	"score" varchar(10) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "YouTubeChannel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" varchar(255) NOT NULL,
	"channelName" varchar(255) NOT NULL,
	"channelUrl" varchar(500) NOT NULL,
	"description" text,
	"subscriberCount" varchar(50),
	"videoCount" varchar(50),
	"thumbnailUrl" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "YouTubeVideo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"videoId" varchar(255) NOT NULL,
	"channelId" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"duration" varchar(50),
	"viewCount" varchar(50),
	"likeCount" varchar(50),
	"uploadDate" timestamp NOT NULL,
	"thumbnailUrl" varchar(500),
	"videoUrl" varchar(500) NOT NULL,
	"transcript" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
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
 ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_channelId_YouTubeChannel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
