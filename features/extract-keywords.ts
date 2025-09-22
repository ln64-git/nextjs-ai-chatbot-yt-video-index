import { pipeline } from "@xenova/transformers";

// Move regex to top level for performance
const ENTITY_PREFIX_REGEX = /^[BI]-/;

export type Keyword = {
  word: string;
  entity: string;
  score: number;
};

export type KeywordExtractionResult = {
  keywords: Keyword[];
  groupedKeywords: Record<string, Keyword[]>;
  totalCount: number;
};

export async function extractKeywordsFromTranscript(
  transcript: string
): Promise<KeywordExtractionResult> {
  console.log(
    `🔍 [NER] Starting keyword extraction for ${transcript.length} characters`
  );

  const ner = await pipeline("ner", "Xenova/bert-base-NER");

  // Process transcript in chunks to avoid length limitations
  const chunkSize = 1000;
  const chunks: string[] = [];

  for (let i = 0; i < transcript.length; i += chunkSize) {
    chunks.push(transcript.slice(i, i + chunkSize));
  }

  console.log(
    `🔍 [NER] Processing ${chunks.length} chunks of ${chunkSize} characters each`
  );

  let allResults: any[] = [];
  for (const chunkText of chunks) {
    if (chunkText) {
      const chunkResults = await ner(chunkText);
      allResults = allResults.concat(chunkResults);
    }
  }

  // Extract and process keywords from NER results
  const rawKeywords = allResults
    .filter((item: any) => item.score > 0.5) // Filter by confidence score
    .map((item: any) => ({
      word: item.word,
      entity: item.entity,
      score: item.score,
    }));

  // Group and deduplicate keywords
  const keywordMap = new Map();
  for (const keyword of rawKeywords) {
    const key = `${keyword.word.toLowerCase()}_${keyword.entity}`;
    if (!keywordMap.has(key) || keywordMap.get(key).score < keyword.score) {
      keywordMap.set(key, keyword);
    }
  }

  const keywords = Array.from(keywordMap.values()).sort(
    (a: any, b: any) => b.score - a.score
  ); // Sort by confidence

  // Group by entity type for better display
  const groupedKeywords = keywords.reduce((acc: any, keyword: any) => {
    const entityType = keyword.entity.replace(ENTITY_PREFIX_REGEX, ""); // Remove B-/I- prefix
    if (!acc[entityType]) {
      acc[entityType] = [];
    }
    acc[entityType].push(keyword);
    return acc;
  }, {});

  return {
    keywords,
    groupedKeywords,
    totalCount: keywords.length,
  };
}

export function logKeywords(result: KeywordExtractionResult): void {
  console.log(`🔍 [KEYWORDS] Found ${result.totalCount} unique keywords:`);

  for (const [entityType, entityKeywords] of Object.entries(
    result.groupedKeywords
  )) {
    console.log(`\n  📌 ${entityType.toUpperCase()}S:`);
    for (const [index, keyword] of entityKeywords.slice(0, 10).entries()) {
      console.log(
        `    ${index + 1}. "${keyword.word}" - ${(keyword.score * 100).toFixed(1)}%`
      );
    }
    if (entityKeywords.length > 10) {
      console.log(
        `    ... and ${entityKeywords.length - 10} more ${entityType.toLowerCase()}s`
      );
    }
  }
}
