# YouTube Indexer

A comprehensive YouTube video indexing and semantic search system that extracts transcripts, generates embeddings, and enables intelligent content discovery.

## Features

- **Channel Indexing**: Automatically index entire YouTube channels
- **Transcript Extraction**: Extract and process video transcripts
- **Semantic Search**: Vector-based search across video content
- **Keyword Extraction**: Advanced NLP-based keyword analysis
- **Batch Processing**: Efficient parallel processing of multiple videos

## Architecture

```
youtube-indexer/
├── lib/
│   ├── services/          # Core indexing services
│   ├── tools/            # AI tools for YouTube operations
│   └── youtube-schema.ts # Database schema
├── features/             # Feature-specific modules
└── api/                  # API endpoints
```

## Core Services

- `YouTubeChannelIndexer`: Main indexing service
- `SemanticSearch`: Vector search functionality
- `extractKeywords`: NLP keyword extraction

## Usage

```typescript
import { YouTubeChannelIndexer } from './lib/services/youtube-indexer';

const indexer = new YouTubeChannelIndexer(channelId);
await indexer.initialize();
await indexer.indexChannel(channelUrl, channelName);
```

## Dependencies

- Google APIs for YouTube data
- Transformers.js for NLP
- Drizzle ORM for database operations
- PostgreSQL with pgvector for embeddings
