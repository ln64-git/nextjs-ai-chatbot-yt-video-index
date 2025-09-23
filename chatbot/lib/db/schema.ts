import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	json,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable("User", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	email: varchar("email", { length: 64 }).notNull(),
	password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	createdAt: timestamp("createdAt").notNull(),
	title: text("title").notNull(),
	userId: uuid("userId")
		.notNull()
		.references(() => user.id),
	visibility: varchar("visibility", { enum: ["public", "private"] })
		.notNull()
		.default("private"),
	lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	chatId: uuid("chatId")
		.notNull()
		.references(() => chat.id),
	role: varchar("role").notNull(),
	content: json("content").notNull(),
	createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	chatId: uuid("chatId")
		.notNull()
		.references(() => chat.id),
	role: varchar("role").notNull(),
	parts: json("parts").notNull(),
	attachments: json("attachments").notNull(),
	createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
	"Vote",
	{
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id),
		messageId: uuid("messageId")
			.notNull()
			.references(() => messageDeprecated.id),
		isUpvoted: boolean("isUpvoted").notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		};
	},
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
	"Vote_v2",
	{
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id),
		messageId: uuid("messageId")
			.notNull()
			.references(() => message.id),
		isUpvoted: boolean("isUpvoted").notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		};
	},
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
	"Document",
	{
		id: uuid("id").notNull().defaultRandom(),
		createdAt: timestamp("createdAt").notNull(),
		title: text("title").notNull(),
		content: text("content"),
		kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
			.notNull()
			.default("text"),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.id, table.createdAt] }),
		};
	},
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
	"Suggestion",
	{
		id: uuid("id").notNull().defaultRandom(),
		documentId: uuid("documentId").notNull(),
		documentCreatedAt: timestamp("documentCreatedAt").notNull(),
		originalText: text("originalText").notNull(),
		suggestedText: text("suggestedText").notNull(),
		description: text("description"),
		isResolved: boolean("isResolved").notNull().default(false),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		documentRef: foreignKey({
			columns: [table.documentId, table.documentCreatedAt],
			foreignColumns: [document.id, document.createdAt],
		}),
	}),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
	"Stream",
	{
		id: uuid("id").notNull().defaultRandom(),
		chatId: uuid("chatId").notNull(),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		chatRef: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
		}),
	}),
);

export type Stream = InferSelectModel<typeof stream>;

// YouTube-related tables
export const youtubeChannel = pgTable("YouTubeChannel", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	channelId: varchar("channelId", { length: 255 }).notNull(),
	channelName: varchar("channelName", { length: 255 }).notNull(),
	channelUrl: varchar("channelUrl", { length: 500 }).notNull(),
	description: text("description"),
	subscriberCount: varchar("subscriberCount", { length: 50 }),
	videoCount: varchar("videoCount", { length: 50 }),
	thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const youtubeVideo = pgTable("YouTubeVideo", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	videoId: varchar("videoId", { length: 255 }).notNull(),
	channelId: uuid("channelId")
		.notNull()
		.references(() => youtubeChannel.id),
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),
	duration: varchar("duration", { length: 50 }),
	viewCount: varchar("viewCount", { length: 50 }),
	likeCount: varchar("likeCount", { length: 50 }),
	uploadDate: timestamp("uploadDate").notNull(),
	thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
	videoUrl: varchar("videoUrl", { length: 500 }).notNull(),
	transcript: text("transcript"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const transcriptChunk = pgTable("TranscriptChunk", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	videoId: uuid("videoId")
		.notNull()
		.references(() => youtubeVideo.id),
	content: text("content").notNull(),
	startTime: varchar("startTime", { length: 50 }).notNull(),
	endTime: varchar("endTime", { length: 50 }).notNull(),
	embedding: text("embedding"), // vector(1536) - stored as text for now
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const videoKeyword = pgTable("VideoKeyword", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	videoId: uuid("videoId")
		.notNull()
		.references(() => youtubeVideo.id),
	keyword: varchar("keyword", { length: 255 }).notNull(),
	entity: varchar("entity", { length: 100 }).notNull(),
	score: varchar("score", { length: 10 }).notNull(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const channelIndexStatus = pgTable("ChannelIndexStatus", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	channelId: uuid("channelId")
		.notNull()
		.references(() => youtubeChannel.id),
	status: varchar("status", { length: 50 }).notNull().default("pending"),
	progress: varchar("progress", { length: 10 }).notNull().default("0"),
	totalVideos: varchar("totalVideos", { length: 10 }).notNull().default("0"),
	processedVideos: varchar("processedVideos", { length: 10 })
		.notNull()
		.default("0"),
	totalChunks: varchar("totalChunks", { length: 10 }).notNull().default("0"),
	processedChunks: varchar("processedChunks", { length: 10 })
		.notNull()
		.default("0"),
	errorMessage: text("errorMessage"),
	startedAt: timestamp("startedAt").notNull().defaultNow(),
	completedAt: timestamp("completedAt"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const searchQuery = pgTable("SearchQuery", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	channelId: uuid("channelId")
		.notNull()
		.references(() => youtubeChannel.id),
	query: text("query").notNull(),
	queryEmbedding: text("queryEmbedding"), // vector(1536) - stored as text for now
	resultsCount: varchar("resultsCount", { length: 10 }).notNull().default("0"),
	executionTime: varchar("executionTime", { length: 10 }),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type YouTubeChannel = InferSelectModel<typeof youtubeChannel>;
export type YouTubeVideo = InferSelectModel<typeof youtubeVideo>;
export type TranscriptChunk = InferSelectModel<typeof transcriptChunk>;
export type VideoKeyword = InferSelectModel<typeof videoKeyword>;
export type ChannelIndexStatus = InferSelectModel<typeof channelIndexStatus>;
export type SearchQuery = InferSelectModel<typeof searchQuery>;
