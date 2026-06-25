import "server-only";

const DEFAULT_DIMENSIONS = 384;
const DEFAULT_MAX_QUERY_LENGTH = 500;
const DEFAULT_CACHE_LIMIT = 250;

const embeddingCache = new Map();

export class QueryEmbeddingError extends Error {
  constructor(message, code = "QUERY_EMBEDDING_ERROR") {
    super(message);
    this.name = "QueryEmbeddingError";
    this.code = code;
  }
}

export function normalizeSemanticQuery(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedDimensions() {
  const parsed = Number.parseInt(process.env.QUERY_EMBEDDING_DIMENSIONS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DIMENSIONS;
}

function maxQueryLength() {
  const parsed = Number.parseInt(process.env.SEMANTIC_SEARCH_MAX_QUERY_LENGTH || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_QUERY_LENGTH;
}

function cacheLimit() {
  const parsed = Number.parseInt(process.env.QUERY_EMBEDDING_CACHE_LIMIT || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_LIMIT;
}

function validateSemanticQuery(query) {
  if (!query) {
    throw new QueryEmbeddingError("Semantic search query is required.", "EMPTY_QUERY");
  }

  if (query.length > maxQueryLength()) {
    throw new QueryEmbeddingError(
      `Semantic search query must be ${maxQueryLength()} characters or fewer.`,
      "QUERY_TOO_LONG",
    );
  }
}

function cacheKey(query) {
  return `openai:${process.env.QUERY_EMBEDDING_MODEL || ""}:${query.toLowerCase()}`;
}

function getCachedEmbedding(key) {
  const cached = embeddingCache.get(key);
  if (!cached) return null;

  embeddingCache.delete(key);
  embeddingCache.set(key, cached);
  return cached;
}

function setCachedEmbedding(key, value) {
  embeddingCache.set(key, value);

  while (embeddingCache.size > cacheLimit()) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }
}

function normalizeEmbedding(value) {
  if (!Array.isArray(value)) {
    throw new QueryEmbeddingError("Embedding provider did not return an array.", "INVALID_EMBEDDING_RESPONSE");
  }

  const embedding = value.map((item) => Number(item));
  if (embedding.some((item) => !Number.isFinite(item))) {
    throw new QueryEmbeddingError("Embedding provider returned non-numeric values.", "INVALID_EMBEDDING_RESPONSE");
  }

  const dimensions = expectedDimensions();
  if (embedding.length !== dimensions) {
    throw new QueryEmbeddingError(
      `Embedding provider returned ${embedding.length} dimensions; expected ${dimensions}.`,
      "INVALID_EMBEDDING_DIMENSIONS",
    );
  }

  return embedding;
}

function extractEmbedding(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.embedding)) return body.embedding;
  if (Array.isArray(body?.data?.[0]?.embedding)) return body.data[0].embedding;
  if (Array.isArray(body?.result?.embedding)) return body.result.embedding;

  throw new QueryEmbeddingError("Embedding provider response did not include an embedding.", "INVALID_EMBEDDING_RESPONSE");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new QueryEmbeddingError(
      `Embedding provider returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      "EMBEDDING_PROVIDER_FAILED",
    );
  }

  return response.json();
}

async function embedWithOpenAI(query) {
  if (!process.env.OPENAI_API_KEY) {
    throw new QueryEmbeddingError("OPENAI_API_KEY is not set.", "EMBEDDING_PROVIDER_NOT_CONFIGURED");
  }

  const model = process.env.QUERY_EMBEDDING_MODEL;
  if (!model) {
    throw new QueryEmbeddingError(
      "QUERY_EMBEDDING_MODEL is required for the OpenAI provider. Only use this if your movie vectors were created in the same embedding space.",
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
    );
  }

  const json = await fetchJson("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: query,
      dimensions: expectedDimensions(),
    }),
  });

  return normalizeEmbedding(extractEmbedding(json));
}

export function vectorToPostgresLiteral(embedding) {
  const normalized = normalizeEmbedding(embedding);
  return `[${normalized.map((value) => (Object.is(value, -0) ? 0 : value)).join(",")}]`;
}

export async function generateQueryEmbedding(queryInput) {
  const query = normalizeSemanticQuery(queryInput);
  validateSemanticQuery(query);

  const key = cacheKey(query);
  const cached = getCachedEmbedding(key);
  if (cached) return cached;

  const provider = (process.env.QUERY_EMBEDDING_PROVIDER || "openai").toLowerCase();
  if (provider !== "openai") {
    throw new QueryEmbeddingError(
      `Unsupported QUERY_EMBEDDING_PROVIDER "${provider}". Only "openai" is supported.`,
      "UNSUPPORTED_EMBEDDING_PROVIDER",
    );
  }

  const embedding = await embedWithOpenAI(query);

  const result = {
    query,
    embedding,
    vector: vectorToPostgresLiteral(embedding),
    dimensions: embedding.length,
    provider,
    model: process.env.QUERY_EMBEDDING_MODEL || null,
  };

  setCachedEmbedding(key, result);
  return result;
}
