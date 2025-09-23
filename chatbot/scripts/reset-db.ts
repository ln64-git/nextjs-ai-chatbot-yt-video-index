import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
	path: ".env.local",
});

const resetDatabase = async () => {
	if (!process.env.POSTGRES_URL) {
		throw new Error("POSTGRES_URL is not defined");
	}

	const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
	const db = drizzle(connection);

	console.log("🗑️  Dropping all tables...");

	// Drop all tables in the correct order (respecting foreign key constraints)
	const dropQueries = [
		'DROP TABLE IF EXISTS "VideoKeyword" CASCADE;',
		'DROP TABLE IF EXISTS "TranscriptChunk" CASCADE;',
		'DROP TABLE IF EXISTS "YouTubeVideo" CASCADE;',
		'DROP TABLE IF EXISTS "YouTubeChannel" CASCADE;',
		'DROP TABLE IF EXISTS "SearchQuery" CASCADE;',
		'DROP TABLE IF EXISTS "ChannelIndexStatus" CASCADE;',
		'DROP TABLE IF EXISTS "Stream" CASCADE;',
		'DROP TABLE IF EXISTS "Suggestion" CASCADE;',
		'DROP TABLE IF EXISTS "Document" CASCADE;',
		'DROP TABLE IF EXISTS "Vote_v2" CASCADE;',
		'DROP TABLE IF EXISTS "Vote" CASCADE;',
		'DROP TABLE IF EXISTS "Message_v2" CASCADE;',
		'DROP TABLE IF EXISTS "Message" CASCADE;',
		'DROP TABLE IF EXISTS "Chat" CASCADE;',
		'DROP TABLE IF EXISTS "User" CASCADE;',
	];

	for (const query of dropQueries) {
		await connection.unsafe(query);
		console.log(`✅ Dropped table: ${query.split('"')[1] || "Unknown"}`);
	}

	console.log("⏳ Running fresh migrations...");

	const start = Date.now();
	await migrate(db, { migrationsFolder: "./lib/db/migrations" });
	const end = Date.now();

	console.log(
		"✅ Database reset and migrations completed in",
		end - start,
		"ms",
	);
	process.exit(0);
};

resetDatabase().catch((err) => {
	console.error("❌ Database reset failed");
	console.error(err);
	process.exit(1);
});
