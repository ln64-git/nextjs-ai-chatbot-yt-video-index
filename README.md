# YouTube Indexer with AI Chatbot

A comprehensive system that combines YouTube video indexing capabilities with an intelligent AI chatbot interface for content discovery and interaction.

## Architecture

This project is organized into two main components with clear separation of concerns:

```
├── chatbot/              # AI Chatbot Template
│   ├── app/             # Next.js application
│   ├── components/      # UI components
│   ├── lib/            # Core libraries
│   └── hooks/          # React hooks
├── youtube-indexer/     # YouTube Indexing System
│   ├── lib/            # Core services and tools
│   ├── features/       # Feature modules
│   └── api/           # API endpoints
└── package.json        # Workspace configuration
```

## Components

### 🤖 Chatbot (`/chatbot`)
The core AI chatbot interface built with Next.js 15 and the AI SDK. Provides:
- Modern chat interface with streaming responses
- Multiple AI model providers (xAI, OpenAI, etc.)
- Authentication and user management
- Artifact creation and management
- Database integration with Drizzle ORM

### 📺 YouTube Indexer (`/youtube-indexer`)
The YouTube content processing and search system. Provides:
- YouTube channel indexing
- Transcript extraction and processing
- Semantic search across video content
- Keyword extraction and analysis
- Vector embeddings for intelligent search

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start the chatbot development server
pnpm dev

# Run database migrations
pnpm db:migrate

# Run tests
pnpm test
```

## Development

This is a monorepo using pnpm workspaces. Each component can be developed independently:

```bash
# Work on chatbot only
cd chatbot
pnpm dev

# Work on YouTube indexer only
cd youtube-indexer
pnpm build
```

## Features

- **Clean Architecture**: Clear separation between chatbot UI and YouTube indexing logic
- **Modular Design**: Each component can be used independently
- **Type Safety**: Full TypeScript support across both components
- **Modern Stack**: Next.js 15, AI SDK, Drizzle ORM, PostgreSQL
- **Semantic Search**: Vector-based search across YouTube content
- **Real-time Processing**: Streaming responses and real-time indexing

## License

MIT License - see LICENSE file for details.