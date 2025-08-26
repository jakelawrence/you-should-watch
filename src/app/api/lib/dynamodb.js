import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

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
    const command = new ScanCommand({
      TableName: "favorites",
      FilterExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": movieSlug,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.username) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getMovieLikedUsers(movieSlug) {
  try {
    let allUsers = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: "likes",
        IndexName: "movieSlug-index", // Replace with your actual GSI name
        KeyConditionExpression: "movieSlug = :movieSlug",
        ExpressionAttributeValues: {
          ":movieSlug": movieSlug,
        },
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      });

      const result = await dynamodb.send(command);

      // Add users from this page to our collection
      if (result.Items && result.Items.length > 0) {
        const users = result.Items.map((row) => row.username).filter(Boolean);
        allUsers.push(...users);
      }

      // Check if there are more pages
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    //console.log(`Found ${allUsers.length} users who liked ${movieSlug}`);
    return allUsers;
  } catch (error) {
    console.error("DynamoDB query error:", error);
    throw error;
  }
}

export async function getUserFavorites(username) {
  try {
    const command = new ScanCommand({
      TableName: "favorites",
      FilterExpression: "username = :username",
      ExpressionAttributeValues: {
        ":username": username,
      },
    });
    const result = await dynamodb.send(command);
    return result.Items.map((row) => row.movieSlug) || [];
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

export async function getUsersLikes(usernames, options = {}) {
  // Input validation
  if (!Array.isArray(usernames)) {
    throw new Error("usernames must be an array");
  }

  if (usernames.length === 0) {
    return new Map();
  }

  // Validate and deduplicate usernames
  const validUsernames = [...new Set(usernames.filter((username) => username && typeof username === "string"))];

  if (validUsernames.length === 0) {
    throw new Error("No valid usernames provided");
  }

  if (validUsernames.length !== usernames.length) {
    console.warn("Some invalid or duplicate usernames were filtered out");
  }

  const {
    limit = 1000,
    consistentRead = false,
    batchSize = 50, // Maximum usernames per scan to avoid expression size limit
  } = options;

  try {
    const userLikesMap = new Map();

    // Initialize map with empty arrays for all requested users
    validUsernames.forEach((username) => {
      userLikesMap.set(username, []);
    });

    let totalMovies = 0;
    let totalScanned = 0;

    // Process usernames in batches to avoid FilterExpression size limit
    for (let i = 0; i < validUsernames.length; i += batchSize) {
      const usernameBatch = validUsernames.slice(i, i + batchSize);

      // console.log(
      //   `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validUsernames.length / batchSize)} (${usernameBatch.length} users)`
      // );

      const batchResults = await scanUsersBatch(usernameBatch, "likes", { limit, consistentRead });

      // Merge results from this batch
      batchResults.results.forEach((item) => {
        const { username, movieSlug } = item;
        if (username && movieSlug && typeof movieSlug === "string") {
          if (userLikesMap.has(username)) {
            userLikesMap.get(username).push(movieSlug);
          }
        }
      });

      totalScanned += batchResults.scannedCount;

      // Optional: Add small delay between batches to be nice to DynamoDB
      if (i + batchSize < validUsernames.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    totalMovies = Array.from(userLikesMap.values()).reduce((sum, movies) => sum + movies.length, 0);

    //console.log(`Found ${totalMovies} total movies across ${validUsernames.length} users (scanned ${totalScanned} items)`);

    return userLikesMap;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw new Error(`Failed to get likes for users: ${error.message}`);
  }
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

export async function getUsersFavorites(usernames, options = {}) {
  // Input validation
  if (!Array.isArray(usernames)) {
    throw new Error("usernames must be an array");
  }

  if (usernames.length === 0) {
    return new Map();
  }

  // Validate and deduplicate usernames
  const validUsernames = [...new Set(usernames.filter((username) => username && typeof username === "string"))];

  if (validUsernames.length === 0) {
    throw new Error("No valid usernames provided");
  }

  if (validUsernames.length !== usernames.length) {
    console.warn("Some invalid or duplicate usernames were filtered out");
  }

  const {
    limit = 1000,
    consistentRead = false,
    batchSize = 50, // Maximum usernames per scan to avoid expression size limit
  } = options;

  try {
    const userFavoritesMap = new Map();

    // Initialize map with empty arrays for all requested users
    validUsernames.forEach((username) => {
      userFavoritesMap.set(username, []);
    });

    let totalMovies = 0;
    let totalScanned = 0;

    // Process usernames in batches to avoid FilterExpression size limit
    for (let i = 0; i < validUsernames.length; i += batchSize) {
      const usernameBatch = validUsernames.slice(i, i + batchSize);

      // console.log(
      //   `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validUsernames.length / batchSize)} (${usernameBatch.length} users)`
      // );

      const batchResults = await scanUsersBatch(usernameBatch, "likes", { limit, consistentRead });

      // Merge results from this batch
      batchResults.results.forEach((item) => {
        const { username, movieSlug } = item;
        if (username && movieSlug && typeof movieSlug === "string") {
          if (userFavoritesMap.has(username)) {
            userFavoritesMap.get(username).push(movieSlug);
          }
        }
      });

      totalScanned += batchResults.scannedCount;

      // Optional: Add small delay between batches to be nice to DynamoDB
      if (i + batchSize < validUsernames.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    totalMovies = Array.from(userFavoritesMap.values()).reduce((sum, movies) => sum + movies.length, 0);

    //console.log(`Found ${totalMovies} total movies across ${validUsernames.length} users (scanned ${totalScanned} items)`);

    return userFavoritesMap;
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw new Error(`Failed to get likes for users: ${error.message}`);
  }
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
