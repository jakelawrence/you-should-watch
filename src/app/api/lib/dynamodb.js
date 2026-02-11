import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { logger } from "../lib/logger";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

// Simple in-memory cache
const queryCache = new Map();

/**
 * Enhanced query function that supports caching and getting all results with pagination
 * @param {string} tableName - DynamoDB table name
 * @param {Array<string>} filters - Filter expressions
 * @param {object} params - ExpressionAttributeValues
 * @param {object} names - ExpressionAttributeNames
 * @param {object} options - Extra options { ttl: number in ms, forceRefresh: boolean }
 */

export async function queryAllItems(tableName, filters = [], params = {}, names = {}, options = {}) {
  const { ttl = 5 * 60 * 1000, forceRefresh = false } = options; // default: 5 min cache
  const cacheKey = JSON.stringify({ tableName, filters, params, names });

  // Check cache
  if (!forceRefresh && queryCache.has(cacheKey)) {
    const { data, expiry } = queryCache.get(cacheKey);
    if (Date.now() < expiry) {
      logger.debug(`📦 Cache hit for ${tableName}`);
      return data;
    } else {
      queryCache.delete(cacheKey); // expired
    }
  }

  let allItems = [];
  let lastEvaluatedKey = null;
  let scanCount = 0;

  do {
    scanCount++;
    logger.debug(`🔍 Querying ${tableName} - batch ${scanCount}`);

    const queryParams = {
      TableName: tableName,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
      ...(Object.keys(params).length > 0 && { ExpressionAttributeValues: params }),
    };

    if (filters.length > 0) {
      queryParams.FilterExpression = filters.join(" AND ");
    }

    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
    const command = new ScanCommand(queryParams);
    const result = await dynamodb.send(command);

    allItems = allItems.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (scanCount % 10 === 0) {
      logger.info(`🔍 Progress: ${allItems.length} items from ${tableName} so far...`);
    }
  } while (lastEvaluatedKey);

  logger.info(`🔍 Retrieved ${allItems.length} total items from ${tableName} in ${scanCount} batches`);

  // Store in cache
  queryCache.set(cacheKey, {
    data: allItems,
    expiry: Date.now() + ttl,
  });

  return allItems;
}

export async function query(table, filters, params, names = null) {
  console.log(table, filters, params, names);

  const queryParams = {
    TableName: table,
    ...(filters.length && {
      FilterExpression: filters.join(" AND "),
      ExpressionAttributeValues: params,
    }),
    ...(names && Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
  };

  let allItems = [];
  let lastEvaluatedKey = null;

  try {
    do {
      // Add pagination parameters if we have a key from previous scan
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const command = new ScanCommand(queryParams);
      const result = await dynamodb.send(command);

      // Add items from this scan to our collection
      if (result.Items) {
        allItems = allItems.concat(result.Items);
      }

      // Update the key for next iteration
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey); // Continue while there are more items

    return allItems;
  } catch (error) {
    console.error("DynamoDB query error:", error);
    throw error;
  }
}

export async function getMovie(movieSlug) {
  console.log("movieSlug=" + movieSlug);
  try {
    const command = new GetCommand({
      TableName: "movies",
      Key: {
        slug: movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Item || null;
  } catch (error) {
    console.error("DynamoDB get error:", error);
    throw error;
  }
}

export async function getMovies(movieSlugs) {
  if (!movieSlugs || movieSlugs.length === 0) {
    return new Map();
  }

  try {
    const movieMap = new Map();

    // DynamoDB BatchGet can only handle 100 items at a time
    const batchSize = 100;

    for (let i = 0; i < movieSlugs.length; i += batchSize) {
      const batch = movieSlugs.slice(i, i + batchSize);

      const command = new BatchGetCommand({
        RequestItems: {
          movies: {
            Keys: batch.map((slug) => ({ slug })),
          },
        },
      });

      const result = await dynamodb.send(command);

      // Add results to our map
      if (result.Responses && result.Responses.movies) {
        result.Responses.movies.forEach((movie) => {
          movieMap.set(movie.slug, movie);
        });
      }

      // Handle unprocessed keys (rare, but good to handle)
      if (result.UnprocessedKeys && result.UnprocessedKeys.movies) {
        console.warn("Some keys were unprocessed:", result.UnprocessedKeys.movies.Keys);
        // You could implement retry logic here if needed
      }
    }

    return movieMap;
  } catch (error) {
    console.error("DynamoDB batch get error:", error);
    throw error;
  }
}

export async function getMoviesByFilter(filters = {}, options = {}) {
  const { limit = null, ttl = 5 * 60 * 1000, forceRefresh = true } = options;

  try {
    const filterExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    // Reserved words in DynamoDB that need attribute name mapping
    const reservedWords = ["year", "duration", "name", "date", "timestamp", "status"];

    // Build filter expressions dynamically
    Object.entries(filters).forEach(([field, condition]) => {
      const attributeName = reservedWords.includes(field.toLowerCase()) ? `#${field}` : field;

      if (reservedWords.includes(field.toLowerCase())) {
        expressionAttributeNames[`#${field}`] = field;
      }

      if (typeof condition === "object" && !Array.isArray(condition)) {
        // Handle operators: { operator: '<', value: 100 }
        const { operator, value } = condition;
        const paramKey = `:${field}`;

        if (operator === "BETWEEN" && Array.isArray(value)) {
          const paramKey1 = `:${field}1`;
          const paramKey2 = `:${field}2`;
          filterExpressions.push(`${attributeName} BETWEEN ${paramKey1} AND ${paramKey2}`);
          expressionAttributeValues[paramKey1] = value[0];
          expressionAttributeValues[paramKey2] = value[1];
        } else {
          filterExpressions.push(`${attributeName} ${operator} ${paramKey}`);
          expressionAttributeValues[paramKey] = value;
        }
      } else if (Array.isArray(condition)) {
        // Handle IN operator: ['action', 'comedy']
        const paramKeys = condition.map((_, idx) => `:${field}${idx}`);
        filterExpressions.push(`${attributeName} IN (${paramKeys.join(", ")})`);
        condition.forEach((val, idx) => {
          expressionAttributeValues[`:${field}${idx}`] = val;
        });
      } else {
        // Handle equality: { year: 2020 }
        const paramKey = `:${field}`;
        filterExpressions.push(`${attributeName} = ${paramKey}`);
        expressionAttributeValues[paramKey] = condition;
      }
    });

    const allMovies = [];
    let lastEvaluatedKey = null;

    // Scan with pagination
    do {
      const scanParams = {
        TableName: "movies",
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      // Only add filter expressions if we have filters
      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(" AND ");
        scanParams.ExpressionAttributeValues = expressionAttributeValues;

        if (Object.keys(expressionAttributeNames).length > 0) {
          scanParams.ExpressionAttributeNames = expressionAttributeNames;
        }
      }

      const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
      const command = new ScanCommand(scanParams);
      const result = await dynamodb.send(command);

      allMovies.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;

      // Early exit if we've hit the limit
      if (limit && allMovies.length >= limit) {
        break;
      }
    } while (lastEvaluatedKey);

    // Apply limit if specified
    const results = limit ? allMovies.slice(0, limit) : allMovies;

    return results;
  } catch (error) {
    console.error("DynamoDB filter query error:", error);
    throw error;
  }
}

export async function getMovieGenres(movieSlug) {
  try {
    const command = new ScanCommand({
      TableName: "genres",
      FilterExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.genre) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getGenresOfMovies(movieSlugs) {
  console.log("getGenresOfMovies called with:", movieSlugs);
  if (!movieSlugs || movieSlugs.length === 0) {
    return [];
  }

  try {
    const genres = new Map();
    const batchSize = 25; // Keep batches small to avoid expression size limit

    // Process movie slugs in batches
    for (let i = 0; i < movieSlugs.length; i += batchSize) {
      const batch = movieSlugs.slice(i, i + batchSize);

      let lastEvaluatedKey = null;

      do {
        // Build OR condition for this batch
        const filterExpression = batch.map((_, index) => `movieSlug = :movieSlug${index}`).join(" OR ");
        const expressionAttributeValues = {};
        batch.forEach((movieSlug, index) => {
          expressionAttributeValues[`:movieSlug${index}`] = movieSlug;
        });

        const command = new ScanCommand({
          TableName: "genres",
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        });

        const result = await dynamodb.send(command);

        if (result.Items && result.Items.length > 0) {
          result.Items.forEach((item) => {
            if (item.genre) {
              if (!genres.has(item.movieSlug)) {
                genres.set(item.movieSlug, []);
              }
              const movieGenres = genres.get(item.movieSlug);
              if (!movieGenres.includes(item.genre)) {
                movieGenres.push(item.genre);
              }
            }
          });
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    return genres;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMoviesOfGenres(genres) {
  if (!genres || genres.length === 0) {
    return [];
  }
  ///console.log(genres);
  try {
    const movieSlugs = new Set();
    let lastEvaluatedKey = null;

    // Build OR condition for multiple genres
    const filterExpression = genres.map((_, index) => `genreLower = :genre${index}`).join(" OR ");
    const expressionAttributeValues = {};
    genres.forEach((genre, index) => {
      expressionAttributeValues[`:genre${index}`] = genre.toLowerCase();
    });

    do {
      const command = new ScanCommand({
        TableName: "genres",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      });

      const result = await dynamodb.send(command);
      //console.log(result);
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach((item) => {
          if (item.movieSlug) {
            movieSlugs.add(item.movieSlug);
          }
        });
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Array.from(movieSlugs);
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMovieNanogenres(movieSlug) {
  try {
    const command = new ScanCommand({
      TableName: "nanogenres",
      FilterExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.nanogenre) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMovieDirectors(movieSlug) {
  try {
    const command = new ScanCommand({
      TableName: "directors",
      FilterExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.directorSlug) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMovieActors(movieSlug) {
  try {
    const command = new ScanCommand({
      TableName: "actors",
      FilterExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.actorSlug) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMovieFavoritedUsers(movieSlug) {
  try {
    let allUsers = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: "favorites-by-movie",
        KeyConditionExpression: "movieSlug = :movieSlug",
        ExpressionAttributeValues: {
          ":movieSlug": movieSlug,
        },
        ProjectionExpression: "username",
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      });

      const result = await dynamodb.send(command);

      if (result.Items && result.Items.length > 0) {
        const users = result.Items.map((item) => item.username).filter(Boolean);
        allUsers.push(...users);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allUsers;
  } catch (error) {
    console.error("DynamoDB getMovieFavoritesUsers error:", error);
    throw error;
  }
}

export async function getMovieLikedUsers(movieSlug) {
  try {
    let allUsers = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: "likes-by-movie",
        KeyConditionExpression: "movieSlug = :movieSlug",
        ExpressionAttributeValues: {
          ":movieSlug": movieSlug,
        },
        ProjectionExpression: "username",
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      });

      const result = await dynamodb.send(command);

      if (result.Items && result.Items.length > 0) {
        const users = result.Items.map((item) => item.username).filter(Boolean);
        allUsers.push(...users);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allUsers;
  } catch (error) {
    console.error("DynamoDB getMovieLikedUsers error:", error);
    throw error;
  }
}

export async function getUsersLikes(usernames) {
  if (!usernames || usernames.length === 0) {
    return new Map();
  }

  const results = new Map();

  // Process users in parallel (DynamoDB can handle concurrent queries)
  const chunkSize = 50; // Process 50 users at a time
  for (let i = 0; i < usernames.length; i += chunkSize) {
    const chunk = usernames.slice(i, i + chunkSize);

    const promises = chunk.map(async (username) => {
      try {
        let allMovies = [];
        let lastEvaluatedKey = null;

        do {
          const command = new QueryCommand({
            TableName: "likes-by-user",
            KeyConditionExpression: "username = :username",
            ExpressionAttributeValues: {
              ":username": username,
            },
            ProjectionExpression: "movieSlug",
            ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
          });

          const result = await dynamodb.send(command);

          if (result.Items && result.Items.length > 0) {
            const movies = result.Items.map((item) => item.movieSlug).filter(Boolean);
            allMovies.push(...movies);
          }

          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return [username, allMovies];
      } catch (error) {
        console.error(`Error getting likes for ${username}:`, error);
        return [username, []];
      }
    });

    const responses = await Promise.all(promises);

    responses.forEach(([username, likes]) => {
      results.set(username, likes);
    });
  }

  return results;
}

export async function getUsersFavorites(usernames) {
  if (!usernames || usernames.length === 0) {
    return new Map();
  }

  const results = new Map();

  // Process users in parallel (DynamoDB can handle concurrent queries)
  const chunkSize = 50; // Process 50 users at a time
  for (let i = 0; i < usernames.length; i += chunkSize) {
    const chunk = usernames.slice(i, i + chunkSize);

    const promises = chunk.map(async (username) => {
      try {
        let allMovies = [];
        let lastEvaluatedKey = null;

        do {
          const command = new QueryCommand({
            TableName: "favorites-by-user",
            KeyConditionExpression: "username = :username",
            ExpressionAttributeValues: {
              ":username": username,
            },
            ProjectionExpression: "movieSlug",
            ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
          });

          const result = await dynamodb.send(command);

          if (result.Items && result.Items.length > 0) {
            const movies = result.Items.map((item) => item.movieSlug).filter(Boolean);
            allMovies.push(...movies);
          }

          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return [username, allMovies];
      } catch (error) {
        console.error(`Error getting likes for ${username}:`, error);
        return [username, []];
      }
    });

    const responses = await Promise.all(promises);

    responses.forEach(([username, likes]) => {
      results.set(username, likes);
    });
  }

  return results;
}

export async function getUserLikes(username) {
  const command = new QueryCommand({
    TableName: "likes-by-user",
    KeyConditionExpression: "username = :username",
    ExpressionAttributeValues: marshall({
      ":username": username,
    }),
    ProjectionExpression: "movieSlug, movieTitle, createdAt",
  });

  const result = await dynamodb.send(command);

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  return result.Items.map((item) => unmarshall(item));
}

// Helper function to scan a batch of users
async function scanUsersBatch(usernames, tableName, options = {}) {
  const { limit = 1000, consistentRead = false } = options;

  let allResults = [];
  let lastEvaluatedKey = null;
  let totalScanned = 0;

  do {
    // Build the filter expression dynamically for this batch
    const filterConditions = usernames.map((_, index) => `username = :username${index}`);
    const filterExpression = filterConditions.join(" OR ");

    // Build expression attribute values
    const expressionAttributeValues = {};
    usernames.forEach((username, index) => {
      expressionAttributeValues[`:username${index}`] = username;
    });

    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression: "username, movieSlug",
      ...(consistentRead && { ConsistentRead: consistentRead }),
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    });

    const result = await dynamodb.send(command);

    if (result.Items && result.Items.length > 0) {
      allResults.push(...result.Items);
    }

    totalScanned += result.ScannedCount || 0;

    if (totalScanned >= limit) {
      //console.warn(`Reached scan limit of ${limit} items for batch`);
      break;
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return {
    results: allResults,
    scannedCount: totalScanned,
  };
}

export async function getDirectorsOfMovies(movieSlugs) {
  if (!movieSlugs || movieSlugs.length === 0) {
    return [];
  }

  try {
    const directors = new Map();
    const batchSize = 25; // Keep batches small to avoid expression size limit

    // Process movie slugs in batches
    for (let i = 0; i < movieSlugs.length; i += batchSize) {
      const batch = movieSlugs.slice(i, i + batchSize);

      let lastEvaluatedKey = null;

      do {
        // Build OR condition for this batch
        const filterExpression = batch.map((_, index) => `movieSlug = :movieSlug${index}`).join(" OR ");
        const expressionAttributeValues = {};
        batch.forEach((movieSlug, index) => {
          expressionAttributeValues[`:movieSlug${index}`] = movieSlug;
        });

        const command = new ScanCommand({
          TableName: "directors",
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        });

        const result = await dynamodb.send(command);

        if (result.Items && result.Items.length > 0) {
          result.Items.forEach((item) => {
            if (item.genre) {
              if (!directors.has(item.movieSlug)) {
                directors.set(item.movieSlug, []);
              }
              const movieDirectors = directors.get(item.movieSlug);
              if (!movieDirectors.includes(item.genre)) {
                movieDirectors.push(item.genre);
              }
            }
          });
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    return directors;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getActorsOfMovies(movieSlugs) {
  if (!movieSlugs || movieSlugs.length === 0) {
    return [];
  }

  try {
    const actors = new Map();
    const batchSize = 25; // Keep batches small to avoid expression size limit

    // Process movie slugs in batches
    for (let i = 0; i < movieSlugs.length; i += batchSize) {
      const batch = movieSlugs.slice(i, i + batchSize);

      let lastEvaluatedKey = null;

      do {
        // Build OR condition for this batch
        const filterExpression = batch.map((_, index) => `movieSlug = :movieSlug${index}`).join(" OR ");
        const expressionAttributeValues = {};
        batch.forEach((movieSlug, index) => {
          expressionAttributeValues[`:movieSlug${index}`] = movieSlug;
        });

        const command = new ScanCommand({
          TableName: "actors",
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        });

        const result = await dynamodb.send(command);

        if (result.Items && result.Items.length > 0) {
          result.Items.forEach((item) => {
            if (item.genre) {
              if (!actors.has(item.movieSlug)) {
                actors.set(item.movieSlug, []);
              }
              const movieActors = actors.get(item.movieSlug);
              if (!movieActors.includes(item.genre)) {
                movieActors.push(item.genre);
              }
            }
          });
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    return actors;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getTableCount(tableName) {
  let count = 0;
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: tableName,
      Select: "COUNT",
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const command = new ScanCommand(params);
    const data = await dynamodb.send(command);
    console.log(`Scanned ${data.Count} items from ${tableName}`);
    count += data.Count;
    lastEvaluatedKey = data.LastEvaluatedKey;
  } while (lastEvaluatedKey); // Continue scanning if there are more results

  return count;
}

export async function getProviderCount() {
  try {
    const command = new ScanCommand({
      TableName: "providers",
      Select: "COUNT",
    });

    const result = await dynamodb.send(command);
    return result.Count;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getUserCount() {
  try {
    const command = new ScanCommand({
      TableName: "users",
      Select: "COUNT",
    });

    const result = await dynamodb.send(command);
    return result.Count;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getUserByUsername(username) {
  try {
    const command = new ScanCommand({
      TableName: "users",
      FilterExpression: "username = :username",
      ExpressionAttributeValues: {
        ":username": username,
      },
    });

    const result = await dynamodb.send(command);
    return result.Items[0];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getUserByEmail(email) {
  try {
    const command = new ScanCommand({
      TableName: "users",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    });

    const result = await dynamodb.send(command);
    return result.Items[0];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function saveProvider(provider) {
  try {
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const command = new PutCommand({
      TableName: "providers",
      Item: provider,
    });
    await dynamodb.send(command);
  } catch (error) {
    console.error("DynamoDB put error:", error);
    throw error;
  }
}

export async function getProviders({ type, limit } = {}) {
  try {
    const command = new ScanCommand({
      TableName: "providers",
    });

    const result = await dynamodb.send(command);
    return result.Items || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function updateProvider(providerId, updates) {
  try {
    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");

    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (key === "provider_id") {
        // Skip updating the primary key
        return;
      }
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;
      updateExpressions.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = value;
    });

    //Convert providerId and updated providerId to integer if they are numeric strings
    if (!isNaN(providerId)) {
      providerId = parseInt(providerId, 10);
    }
    if (updates.provider_id && !isNaN(updates.provider_id)) {
      updates.provider_id = parseInt(updates.provider_id, 10);
    }
    console.log("Updating providerId:", providerId, "with updates:", updateExpressions);
    const command = new UpdateCommand({
      TableName: "providers",
      Key: { provider_id: providerId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });
    console.log("providerId:", typeof providerId, "updates:", updates);

    await dynamodb.send(command);
  } catch (error) {
    console.error("DynamoDB update error:", error);
    throw error;
  }
}

export async function deleteProvider(provider_id) {
  try {
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");

    //Convert provider_id to integer if it's a numeric string
    if (!isNaN(provider_id)) {
      provider_id = parseInt(provider_id, 10);
    }

    console.log("Deleting provider_id:", provider_id);
    const command = new DeleteCommand({
      TableName: "providers",
      Key: { provider_id: provider_id },
    });

    await dynamodb.send(command);
  } catch (error) {
    console.error("DynamoDB delete error:", error);
    throw error;
  }
}

export async function getUserSelectedStreamingServces(email) {
  try {
    const command = new ScanCommand({
      TableName: "users",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    });

    const result = await dynamodb.send(command);
    console.log("DynamoDB scan result:", result.Items[0]?.streamingServices);
    return result.Items[0]?.streamingServices || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}
