import { tool } from "ai";
import { z } from "zod";

// Define comprehensive keyword types
export type KeywordType =
  | "person"
  | "place"
  | "organization"
  | "topic"
  | "trend"
  | "concept"
  | "event"
  | "product"
  | "technology"
  | "emotion"
  | "action"
  | "noun";

export type ExtractedKeyword = {
  text: string;
  type: KeywordType;
  confidence: number;
  frequency: number;
  context: string[];
  relevance: number;
};

export type KeywordExtractionResult = {
  keywords: ExtractedKeyword[];
  summary: {
    totalKeywords: number;
    topCategories: { type: KeywordType; count: number }[];
    keyTopics: string[];
    sentiment: "positive" | "negative" | "neutral" | "mixed";
    complexity: "low" | "medium" | "high";
  };
};

// Define regex patterns at module level for performance
const PERSON_PATTERN = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
const PLACE_PATTERN =
  /\b(?:in|at|from|to|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
const ORG_PATTERN =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|LLC|Ltd|Company|Organization|Group|Team)\b/g;
const TREND_PATTERNS = [
  /\b(?:new|latest|current|recent|emerging|growing|increasing|popular)\s+(\w+)/gi,
  /\b(\w+)\s+(?:trend|trending|popular|hot|buzz)/gi,
  /\b(?:breakthrough|innovation|revolution|disruption)\s+(\w+)/gi,
];
const EMOTION_PATTERN =
  /\b(good|great|excellent|amazing|fantastic|wonderful|happy|joy|love|positive|success|benefit|advantage|optimistic|bad|worst|hate|terrible|awful|sad|angry|negative|problem|issue|challenge|difficulty|risk|threat)\b/gi;
const SENTENCE_SPLIT_PATTERN = /[.!?]+/;
const WORD_SPLIT_PATTERN = /\s+/;
const SENTIMENT_POSITIVE_PATTERN =
  /\b(good|great|excellent|amazing|fantastic|wonderful|happy|joy|love|positive|success|benefit|advantage|optimistic)\b/gi;
const SENTIMENT_NEGATIVE_PATTERN =
  /\b(bad|worst|hate|terrible|awful|sad|angry|negative|problem|issue|challenge|difficulty|risk|threat)\b/gi;
const COMPLEXITY_SENTENCE_PATTERN = /[.!?]+/;
const CAPITALIZED_PATTERN = /^[A-Z]/;
const LETTERS_ONLY_PATTERN = /^[a-zA-Z]+$/;

// Advanced keyword extraction using multiple NLP techniques
export const extractVideoKeywords = tool({
  description:
    "Extract comprehensive keywords from YouTube video transcripts including people, places, topics, trends, and other important entities using advanced NLP techniques.",
  inputSchema: z.object({
    transcript: z
      .string()
      .describe("The full transcript text to extract keywords from"),
    videoTitle: z
      .string()
      .optional()
      .describe("Optional video title for context"),
    maxKeywords: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of keywords to extract"),
  }),
  execute: ({ transcript, videoTitle, maxKeywords = 50 }) => {
    try {
      console.log("🔍 [KEYWORDS] Starting keyword extraction...");
      console.log("🔍 [KEYWORDS] Transcript length:", transcript.length);
      console.log("🔍 [KEYWORDS] Video title:", videoTitle || "Unknown");

      // Clean and preprocess transcript
      const cleanedTranscript = preprocessText(transcript);

      // Extract keywords using multiple methods
      const extractedKeywords = extractKeywordsComprehensive(
        cleanedTranscript,
        videoTitle,
        maxKeywords
      );

      // Analyze and categorize results
      const result = analyzeKeywords(extractedKeywords, cleanedTranscript);

      console.log("✅ [KEYWORDS] Extraction complete:", {
        totalKeywords: result.keywords.length,
        topCategories: result.summary.topCategories,
        keyTopics: result.summary.keyTopics.slice(0, 5),
      });

      return {
        success: true,
        message: `🎯 **Keyword Analysis Complete**\n\n**Video:** ${videoTitle || "Unknown"}\n**Total Keywords:** ${result.keywords.length}\n**Key Topics:** ${result.summary.keyTopics.slice(0, 10).join(", ")}\n\n**Top Keywords by Category:**\n${formatKeywordsByCategory(result.keywords)}\n\n**Detailed Analysis:**\n${formatDetailedAnalysis(result)}`,
        keywords: result.keywords,
        summary: result.summary,
        videoTitle: videoTitle || null,
      };
    } catch (error) {
      console.error("❌ [KEYWORDS] Extraction failed:", error);
      return {
        success: false,
        message: "❌ Failed to extract keywords from the transcript.",
        keywords: [],
        summary: {
          totalKeywords: 0,
          topCategories: [],
          keyTopics: [],
          sentiment: "neutral" as const,
          complexity: "low" as const,
        },
      };
    }
  },
});

// Text preprocessing
function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\-'.,!?]/g, " ") // Remove special chars except basic punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Comprehensive keyword extraction using multiple NLP techniques
function extractKeywordsComprehensive(
  text: string,
  videoTitle?: string,
  maxKeywords = 50
): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  // Method 1: Named Entity Recognition (simulated) - highest priority
  const namedEntities = extractNamedEntities(text);
  keywords.push(
    ...namedEntities.map((k) => ({ ...k, relevance: k.relevance * 1.3 }))
  );

  // Method 2: Topic modeling (simulated) - high priority
  const topics = extractTopics(text);
  keywords.push(...topics.map((k) => ({ ...k, relevance: k.relevance * 1.2 })));

  // Method 3: Context-aware extraction - medium-high priority
  const contextualKeywords = extractContextualKeywords(text, videoTitle);
  keywords.push(
    ...contextualKeywords.map((k) => ({ ...k, relevance: k.relevance * 1.1 }))
  );

  // Method 4: Sentiment and emotion analysis - medium priority
  const emotionalKeywords = extractEmotionalKeywords(text);
  keywords.push(
    ...emotionalKeywords.map((k) => ({ ...k, relevance: k.relevance * 1.0 }))
  );

  // Method 5: Trend and concept detection - medium priority
  const trendKeywords = extractTrendKeywords(text);
  keywords.push(
    ...trendKeywords.map((k) => ({ ...k, relevance: k.relevance * 0.9 }))
  );

  // Early termination if we have enough high-quality keywords
  if (keywords.length >= maxKeywords) {
    const uniqueKeywords = deduplicateKeywords(keywords);
    const rankedKeywords = rankKeywords(uniqueKeywords);
    return rankedKeywords
      .filter(
        (k) =>
          k.relevance > 0.6 &&
          k.text.length > 3 &&
          !isStopWord(k.text.toLowerCase())
      )
      .slice(0, maxKeywords);
  }

  // Only add frequent terms if we don't have enough high-quality keywords
  if (keywords.length < maxKeywords * 0.7) {
    const frequentTerms = extractFrequentTerms(text);
    keywords.push(
      ...frequentTerms.map((k) => ({ ...k, relevance: k.relevance * 0.7 }))
    );
  }

  // Quick deduplication and ranking
  const uniqueKeywords = deduplicateKeywords(keywords);
  const rankedKeywords = rankKeywords(uniqueKeywords);

  // Return top results with quality filter
  return rankedKeywords
    .filter(
      (k) =>
        k.relevance > 0.6 &&
        k.text.length > 3 &&
        !isStopWord(k.text.toLowerCase())
    )
    .slice(0, maxKeywords);
}

// Named Entity Recognition (simulated with pattern matching)
function extractNamedEntities(text: string): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  // Person names (capitalized words that could be names)
  const personMatches = text.match(PERSON_PATTERN) || [];
  for (const match of personMatches) {
    const name = match.trim();
    if (
      name.length > 2 &&
      !isStopWord(name.toLowerCase()) &&
      CAPITALIZED_PATTERN.test(name)
    ) {
      keywords.push({
        text: name,
        type: "person",
        confidence: 0.9,
        frequency: 1,
        context: [],
        relevance: 0.95,
      });
    }
  }

  // Places (common place indicators)
  let placeMatch: RegExpExecArray | null;
  placeMatch = PLACE_PATTERN.exec(text);
  while (placeMatch !== null) {
    keywords.push({
      text: placeMatch[1],
      type: "place",
      confidence: 0.7,
      frequency: 1,
      context: [],
      relevance: 0.6,
    });
    placeMatch = PLACE_PATTERN.exec(text);
  }

  // Organizations (common org indicators)
  let orgMatch: RegExpExecArray | null;
  orgMatch = ORG_PATTERN.exec(text);
  while (orgMatch !== null) {
    keywords.push({
      text: orgMatch[1],
      type: "organization",
      confidence: 0.9,
      frequency: 1,
      context: [],
      relevance: 0.8,
    });
    orgMatch = ORG_PATTERN.exec(text);
  }

  return keywords;
}

// Topic extraction using keyword density and context
function extractTopics(text: string): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  // Enhanced topic indicators and patterns
  const topicPatterns = [
    // Political/ideological terms
    {
      pattern: /\b(left-wing|right-wing|liberal|conservative|political)\b/gi,
      type: "topic",
    },
    { pattern: /\b(ideology|orthodoxy|beliefs|opinions)\b/gi, type: "concept" },
    {
      pattern: /\b(threats|violence|threats of violence)\b/gi,
      type: "concept",
    },

    // Entertainment industry terms
    {
      pattern: /\b(entertainment|music|concert|album|industry)\b/gi,
      type: "topic",
    },
    { pattern: /\b(artist|musician|singer|band)\b/gi, type: "concept" },
    { pattern: /\b(concert|shows|tours|performances)\b/gi, type: "concept" },

    // Social/political concepts
    {
      pattern: /\b(sell out|selling out|pressure|behind the scenes)\b/gi,
      type: "concept",
    },
    {
      pattern: /\b(attention|fame|popularity|mainstream)\b/gi,
      type: "concept",
    },
    { pattern: /\b(activism|protest|movement|cause)\b/gi, type: "concept" },

    // General topic indicators
    {
      pattern: /\b(about|regarding|concerning|discussing|talking about)\b/gi,
      type: "topic",
    },
  ];

  // Extract topics using patterns
  for (const { pattern, type } of topicPatterns) {
    let match: RegExpExecArray | null;
    match = pattern.exec(text);
    while (match !== null) {
      const topic = match[0].trim();
      if (topic.length > 3 && !isStopWord(topic.toLowerCase())) {
        keywords.push({
          text: topic,
          type: type as KeywordType,
          confidence: 0.8,
          frequency: 1,
          context: [],
          relevance: 0.9,
        });
      }
      match = pattern.exec(text);
    }
  }

  // Extract multi-word topics from context
  const sentences = text.split(SENTENCE_SPLIT_PATTERN);
  for (const sentence of sentences) {
    // Look for meaningful phrases
    const meaningfulPhrases = [
      /\b(concert cancellations?|show cancellations?)\b/gi,
      /\b(death threats?|threats? of violence)\b/gi,
      /\b(political pressure|ideological pressure)\b/gi,
      /\b(entertainment industry|music industry)\b/gi,
      /\b(conservative podcast|right-wing podcast)\b/gi,
    ];

    for (const phrasePattern of meaningfulPhrases) {
      let match: RegExpExecArray | null;
      match = phrasePattern.exec(sentence);
      while (match !== null) {
        const phrase = match[0].trim();
        if (phrase.length > 5) {
          keywords.push({
            text: phrase,
            type: "concept",
            confidence: 0.9,
            frequency: 1,
            context: [sentence.trim()],
            relevance: 0.95,
          });
        }
        match = phrasePattern.exec(sentence);
      }
    }
  }

  return keywords;
}

// Frequency-based term extraction
function extractFrequentTerms(text: string): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];
  const words = text.split(WORD_SPLIT_PATTERN);
  const wordCount: Record<string, number> = {};

  // Count word frequencies with stricter filtering
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, "");
    // Only include meaningful words: longer than 4 chars, not stop words, contains letters, not numbers
    if (
      cleanWord.length > 4 &&
      !isStopWord(cleanWord) &&
      LETTERS_ONLY_PATTERN.test(cleanWord)
    ) {
      wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
    }
  }

  // Convert to keywords with higher frequency threshold
  for (const [word, count] of Object.entries(wordCount)) {
    if (count >= 3) {
      // Only words that appear at least 3 times
      keywords.push({
        text: word,
        type: "noun",
        confidence: Math.min(0.9, count / 8), // Higher confidence threshold
        frequency: count,
        context: [],
        relevance: Math.min(0.9, count / 6), // Higher relevance threshold
      });
    }
  }

  // Sort by relevance and return top keywords
  return keywords.sort((a, b) => b.relevance - a.relevance).slice(0, 8); // Limit to top 8 most relevant
}

// Context-aware keyword extraction
function extractContextualKeywords(
  text: string,
  videoTitle?: string
): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  // Extract keywords from video title if available
  if (videoTitle) {
    const titleWords = videoTitle.toLowerCase().split(WORD_SPLIT_PATTERN);
    for (const word of titleWords) {
      if (word.length > 3 && !isStopWord(word)) {
        keywords.push({
          text: word,
          type: "concept",
          confidence: 0.9,
          frequency: 1,
          context: [videoTitle],
          relevance: 0.9,
        });
      }
    }
  }

  // Extract keywords from important sentences (longer sentences)
  const sentences = text.split(SENTENCE_SPLIT_PATTERN);
  for (const sentence of sentences) {
    if (sentence.length > 50) {
      // Important sentences are longer
      const words = sentence.split(WORD_SPLIT_PATTERN);
      for (const word of words) {
        if (word.length > 4 && !isStopWord(word)) {
          keywords.push({
            text: word,
            type: "concept",
            confidence: 0.7,
            frequency: 1,
            context: [sentence.trim()],
            relevance: 0.6,
          });
        }
      }
    }
  }

  return keywords;
}

// Emotional keyword extraction
function extractEmotionalKeywords(text: string): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  // Use the module-level emotion pattern for better performance
  const matches = text.match(EMOTION_PATTERN);
  if (matches) {
    for (const match of matches) {
      keywords.push({
        text: match,
        type: "emotion",
        confidence: 0.8,
        frequency: 1,
        context: [],
        relevance: 0.7,
      });
    }
  }

  return keywords;
}

// Trend and concept detection
function extractTrendKeywords(text: string): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  for (const pattern of TREND_PATTERNS) {
    let match: RegExpExecArray | null;
    match = pattern.exec(text);
    while (match !== null) {
      const keyword = match[1];
      if (keyword.length > 3) {
        keywords.push({
          text: keyword,
          type: "trend",
          confidence: 0.8,
          frequency: 1,
          context: [],
          relevance: 0.8,
        });
      }
      match = pattern.exec(text);
    }
  }

  return keywords;
}

// Check if word is a stop word
function isStopWord(word: string): boolean {
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
  return stopWords.has(word.toLowerCase());
}

// Deduplicate keywords
function deduplicateKeywords(keywords: ExtractedKeyword[]): ExtractedKeyword[] {
  const seen = new Map<string, ExtractedKeyword>();

  for (const keyword of keywords) {
    const key = keyword.text.toLowerCase();
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (existing) {
        // Merge frequencies and contexts
        existing.frequency += keyword.frequency;
        existing.context.push(...keyword.context);
        existing.confidence = Math.max(existing.confidence, keyword.confidence);
        existing.relevance = Math.max(existing.relevance, keyword.relevance);
      }
    } else {
      seen.set(key, { ...keyword });
    }
  }

  return Array.from(seen.values());
}

// Rank keywords by relevance and frequency
function rankKeywords(keywords: ExtractedKeyword[]): ExtractedKeyword[] {
  return keywords
    .map((keyword) => {
      // Calculate final relevance score
      const relevanceScore =
        keyword.confidence * 0.3 +
        keyword.relevance * 0.3 +
        Math.min(keyword.frequency / 10, 1) * 0.2 +
        (keyword.context.length > 0 ? 0.2 : 0);

      return {
        ...keyword,
        relevance: relevanceScore,
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

// Analyze keywords and generate summary
function analyzeKeywords(
  keywords: ExtractedKeyword[],
  text: string
): KeywordExtractionResult {
  // Count keywords by type
  const typeCount: Record<KeywordType, number> = {} as Record<
    KeywordType,
    number
  >;
  for (const keyword of keywords) {
    typeCount[keyword.type] = (typeCount[keyword.type] || 0) + 1;
  }

  // Get top categories
  const topCategories = Object.entries(typeCount)
    .map(([type, count]) => ({ type: type as KeywordType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get key topics (top keywords)
  const keyTopics = keywords.slice(0, 10).map((k) => k.text);

  // Analyze sentiment
  const sentiment = analyzeSentiment(text);

  // Analyze complexity
  const complexity = analyzeComplexity(keywords, text);

  return {
    keywords,
    summary: {
      totalKeywords: keywords.length,
      topCategories,
      keyTopics,
      sentiment,
      complexity,
    },
  };
}

// Simple sentiment analysis
function analyzeSentiment(
  text: string
): "positive" | "negative" | "neutral" | "mixed" {
  const positiveMatches = text.match(SENTIMENT_POSITIVE_PATTERN);
  const positiveCount = positiveMatches ? positiveMatches.length : 0;

  const negativeMatches = text.match(SENTIMENT_NEGATIVE_PATTERN);
  const negativeCount = negativeMatches ? negativeMatches.length : 0;

  if (positiveCount > negativeCount * 1.5) {
    return "positive";
  }
  if (negativeCount > positiveCount * 1.5) {
    return "negative";
  }
  if (positiveCount > 0 && negativeCount > 0) {
    return "mixed";
  }
  return "neutral";
}

// Analyze text complexity
function analyzeComplexity(
  keywords: ExtractedKeyword[],
  text: string
): "low" | "medium" | "high" {
  const words = text.split(WORD_SPLIT_PATTERN);
  const avgWordLength =
    words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const uniqueKeywords = new Set(keywords.map((k) => k.text)).size;
  const sentenceCount = text.split(COMPLEXITY_SENTENCE_PATTERN).length;
  const avgSentenceLength = words.length / sentenceCount;

  let complexityScore = 0;
  if (avgWordLength > 5) {
    complexityScore += 1;
  }
  if (uniqueKeywords > 30) {
    complexityScore += 1;
  }
  if (avgSentenceLength > 15) {
    complexityScore += 1;
  }
  if (keywords.some((k) => k.type === "concept")) {
    complexityScore += 1;
  }

  if (complexityScore >= 3) {
    return "high";
  }
  if (complexityScore >= 2) {
    return "medium";
  }
  return "low";
}

// Format keywords by category for display
function formatKeywordsByCategory(keywords: ExtractedKeyword[]): string {
  const byCategory: Record<KeywordType, ExtractedKeyword[]> = {} as Record<
    KeywordType,
    ExtractedKeyword[]
  >;

  for (const keyword of keywords) {
    if (!byCategory[keyword.type]) {
      byCategory[keyword.type] = [];
    }
    byCategory[keyword.type].push(keyword);
  }

  let result = "";
  for (const [type, categoryKeywords] of Object.entries(byCategory)) {
    const topKeywords = categoryKeywords
      .slice(0, 5)
      .map((k) => k.text)
      .join(", ");
    result += `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${topKeywords}\n`;
  }

  return result;
}

// Format detailed analysis for display
function formatDetailedAnalysis(result: KeywordExtractionResult): string {
  const { keywords, summary } = result;

  let output = "🔍 **Keyword Analysis Results**\n\n";

  output += "**Summary:**\n";
  output += `- Total Keywords: ${summary.totalKeywords}\n`;
  output += `- Sentiment: ${summary.sentiment.charAt(0).toUpperCase() + summary.sentiment.slice(1)}\n`;
  output += `- Complexity: ${summary.complexity.charAt(0).toUpperCase() + summary.complexity.slice(1)}\n`;
  output += `- Top Categories: ${summary.topCategories.map((cat) => `${cat.type} (${cat.count})`).join(", ")}\n\n`;

  // Group keywords by category
  const byCategory: Record<KeywordType, ExtractedKeyword[]> = {} as Record<
    KeywordType,
    ExtractedKeyword[]
  >;
  for (const keyword of keywords) {
    if (!byCategory[keyword.type]) {
      byCategory[keyword.type] = [];
    }
    byCategory[keyword.type].push(keyword);
  }

  // Display top keywords by category
  output += "**Key Topics by Category:**\n";
  for (const [type, categoryKeywords] of Object.entries(byCategory)) {
    if (categoryKeywords.length > 0) {
      const topKeywords = categoryKeywords
        .slice(0, 5)
        .map((k) => k.text)
        .join(", ");
      output += `- **${type.charAt(0).toUpperCase() + type.slice(1)}:** ${topKeywords}\n`;
    }
  }

  output += "\n**Top 10 Most Relevant Keywords:**\n";
  keywords.slice(0, 10).forEach((keyword, index) => {
    output += `${index + 1}. **${keyword.text}** (${keyword.type}, relevance: ${keyword.relevance.toFixed(2)})\n`;
  });

  return output;
}
