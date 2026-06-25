#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value = "") {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .trim()
  );
}

function firstMatch(value, pattern, fallback = null) {
  const match = value.match(pattern);
  return match ? decodeHtml(match[1]).trim() : fallback;
}

function parseInteger(value) {
  if (!value) return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRating(ratingLabel) {
  if (!ratingLabel) return null;

  let score = 0;
  for (const char of ratingLabel) {
    if (char === "★") score += 1;
    if (char === "½") score += 0.5;
  }

  return score || null;
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function extractArticles(html) {
  return html.match(/<article\b[^>]*class="[^"]*\bproduction-viewing\b[^"]*"[\s\S]*?<\/article>/g) || [];
}

function parseReviewArticle(article, options = {}) {
  const reviewBodyMatch = article.match(/<div\b[^>]*class="[^"]*\bjs-review-body\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="viewing-actions">/);
  if (!reviewBodyMatch) return null;

  const text = stripTags(reviewBodyMatch[1]);
  if (!text) return null;

  const reviewBodyOpenTag = article.match(/<div\b[^>]*class="[^"]*\bjs-review-body\b[^"]*"[^>]*>/)?.[0] || "";
  const fullTextUrl = firstMatch(reviewBodyOpenTag, /data-full-text-url="([^"]+)"/);
  const language = firstMatch(reviewBodyOpenTag, /lang="([^"]+)"/);
  const reviewUid = firstMatch(article, /&quot;uid&quot;:&quot;(viewing:\d+)&quot;/) || firstMatch(fullTextUrl || "", /viewing:(\d+)/);
  const reviewId = reviewUid?.startsWith("viewing:") ? reviewUid : reviewUid ? `viewing:${reviewUid}` : null;
  const displayName = firstMatch(article, /<strong class="displayname">([\s\S]*?)<\/strong>/);
  const profilePath = firstMatch(article, /<a class="avatar[^"]*" href="([^"]+)"/);
  const username = profilePath?.split("/").filter(Boolean)[0] || null;
  const reviewPath = firstMatch(article, /<a href="([^"]+\/film\/[^"]+?)" class="context">/);
  const watchedAt = firstMatch(article, /<time class="timestamp" datetime="([^"]+)"/);
  const ratingLabel = firstMatch(article, /<svg[^>]*class="glyph -rating"[^>]*aria-label="([^"]+)"/);
  const likeDataCount = firstMatch(article, /data-count="([^"]+)"/);
  const commentLabel = firstMatch(article, /<span class="glyph -comment"[\s\S]*?<\/svg><\/span><span class="label">([^<]+)<\/span>/);
  const containsSpoilers = /js-spoiler-container/.test(article);
  const likedByAuthor = /inline-liked -like/.test(article);

  return {
    reviewId,
    movieSlug: options.movieSlug ?? null,
    source: "letterboxd-html",
    sourceUrl: options.sourceUrl ?? null,
    author: {
      username,
      displayName,
      profilePath
    },
    reviewPath,
    fullTextUrl,
    rating: parseRating(ratingLabel),
    ratingLabel,
    likedByAuthor,
    likes: parseInteger(likeDataCount),
    comments: parseInteger(commentLabel),
    containsSpoilers,
    language,
    watchedAt,
    text,
    textHash: hashText(text),
    usefulCharCount: text.length
  };
}

export function parseReviewsFromHtml(html, options = {}) {
  const articles = extractArticles(html);
  const reviews = articles
    .map((article) => parseReviewArticle(article, options))
    .filter(Boolean);

  return {
    source: "letterboxd-html",
    sourceUrl: options.sourceUrl ?? null,
    movieSlug: options.movieSlug ?? null,
    parsedAt: new Date().toISOString(),
    articleCount: articles.length,
    reviewCount: reviews.length,
    reviews
  };
}

async function main() {
  if (hasArg("--help") || process.argv.length <= 2) {
    console.log(`
Usage:
  node scripts/reviews/parse-letterboxd-reviews.mjs --input page.html --movie beau-is-afraid --source-url https://letterboxd.com/film/beau-is-afraid/reviews/by/activity/
  pbpaste | node scripts/reviews/parse-letterboxd-reviews.mjs --input - --movie beau-is-afraid
  node scripts/reviews/parse-letterboxd-reviews.mjs --input page.html --output data/review-pilot/raw/beau-is-afraid-page-1.json

Options:
  --input       Path to a saved Letterboxd review page HTML file, or "-" to read HTML from stdin.
  --output      Optional output JSON path. Prints to stdout when omitted.
  --movie       Optional app movie slug to attach to each parsed review.
  --source-url  Optional source URL to attach to the parse result.
`);
    return;
  }

  const inputPath = getArg("--input");
  if (!inputPath) {
    throw new Error("Missing required --input path.");
  }

  const outputPath = getArg("--output");
  const movieSlug = getArg("--movie");
  const sourceUrl = getArg("--source-url");
  const html = inputPath === "-" ? await readStdin() : await fs.readFile(inputPath, "utf8");
  const result = parseReviewsFromHtml(html, { movieSlug, sourceUrl });
  const json = `${JSON.stringify(result, null, 2)}\n`;

  if (outputPath) {
    await fs.mkdir(new URL(".", pathToFileURL(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, json, "utf8");
    console.log(`Parsed ${result.reviewCount} reviews from ${result.articleCount} articles -> ${outputPath}`);
  } else {
    process.stdout.write(json);
  }
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
