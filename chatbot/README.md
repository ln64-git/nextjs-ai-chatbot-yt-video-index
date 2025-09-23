# AI Chatbot

A modern, full-featured AI chatbot built with Next.js and the AI SDK. This is the core chatbot template that provides the user interface and AI interaction capabilities.

## Features

- **Next.js 15** with App Router
- **AI SDK** with multiple model providers
- **Authentication** with Auth.js
- **Real-time Chat** with streaming responses
- **Artifacts** for code, documents, and more
- **Database Integration** with Drizzle ORM
- **Modern UI** with shadcn/ui and Tailwind CSS

## Architecture

```
chatbot/
├── app/                  # Next.js app directory
│   ├── (auth)/          # Authentication pages
│   └── (chat)/          # Chat interface
├── components/           # React components
├── lib/                  # Core libraries
│   ├── ai/              # AI models and tools
│   ├── db/              # Database schema and queries
│   └── artifacts/       # Artifact functionality
└── hooks/               # React hooks
```

## Getting Started

```bash
cd chatbot
pnpm install
pnpm dev
```

## Model Providers

- xAI (Grok) - Default
- OpenAI
- Fireworks
- And more via AI Gateway

## Database

- PostgreSQL with Neon
- Drizzle ORM
- Vector embeddings for semantic search

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run database migrations
pnpm db:migrate

# Run tests
pnpm test
```
