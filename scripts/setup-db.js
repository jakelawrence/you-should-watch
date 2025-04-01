const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Promisify database operations
const dbRun = (db, query) => {
  return new Promise((resolve, reject) => {
    db.run(query, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Create/connect to SQLite database
const initializeDB = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("movies.db", (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log("Connected to the SQLite database.");
      resolve(db);
    });
  });
};

// Create tables
const createTables = async (db) => {
  console.log("Creating tables...");
  try {
    await dbRun(
      db,
      `CREATE TABLE IF NOT EXISTS movies (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avgRating REAL,
      popularityRanking INTEGER,
      posterUrl TEXT,
      link TEXT,
      year INTEGER
    )`
    );

    await dbRun(
      db,
      `CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movieSlug TEXT,
      genre TEXT,
      FOREIGN KEY (movieSlug) REFERENCES movies(slug)
    )`
    );

    await dbRun(
      db,
      `CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      movieSlug TEXT,
      FOREIGN KEY (movieSlug) REFERENCES movies(slug)
    )`
    );
    await dbRun(
      db,
      `CREATE TABLE IF NOT EXISTS nanogenres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movieSlug TEXT,
      nanogenre TEXT,
      FOREIGN KEY (movieSlug) REFERENCES movies(slug)
    )`
    );

    await dbRun(
      db,
      `CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      movieSlug TEXT,
      FOREIGN KEY (movieSlug) REFERENCES movies(slug)
    )`
    );

    console.log("Tables created successfully.");
  } catch (error) {
    throw new Error(`Error creating tables: ${error.message}`);
  }
};

// Promisify prepared statement
const runPreparedStatement = (stmt, params) => {
  return new Promise((resolve, reject) => {
    stmt.run(params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Import data from JSON files
const importData = async (db) => {
  console.log("Starting data import...");
  try {
    // Read JSON files/
    const movies = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/films.json"), "utf8"));
    const genres = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/genres.json"), "utf8"));
    const likes = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/likes.json"), "utf8"));
    const favorites = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/favorites.json"), "utf8")
    );
    const nanogenres = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/nanogenres.json"), "utf8")
    );

    console.log("Importing movies...");
    const movieStmt = db.prepare(
      "INSERT OR REPLACE INTO movies (slug, name, avgRating, popularityRanking, posterUrl, link, year) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    let popularityRanking = 1;
    for (const movie of movies) {
      await runPreparedStatement(movieStmt, [
        movie.slug,
        movie.name,
        parseFloat(movie.avgRating),
        popularityRanking,
        movie.posterUrl,
        movie.link,
        movie.year,
      ]);
      popularityRanking++;
    }
    await new Promise((resolve, reject) => {
      movieStmt.finalize((err) => (err ? reject(err) : resolve()));
    });

    console.log("Importing genres...");
    const genreStmt = db.prepare("INSERT OR REPLACE INTO genres (movieSlug, genre) VALUES (?, ?)");
    for (const genre of genres) {
      await runPreparedStatement(genreStmt, [genre.filmSlug, genre.genre]);
    }
    await new Promise((resolve, reject) => {
      genreStmt.finalize((err) => (err ? reject(err) : resolve()));
    });

    console.log("Importing likes...");
    const likeStmt = db.prepare("INSERT OR REPLACE INTO likes (username, movieSlug) VALUES (?, ?)");
    const movieSlugs = new Set(movies.map((movie) => movie.slug));
    for (const like of likes) {
      if (movieSlugs.has(like.filmSlug)) {
        console.log(like.username, like.filmSlug);
        await runPreparedStatement(likeStmt, [like.username, like.filmSlug]);
      }
    }
    await new Promise((resolve, reject) => {
      likeStmt.finalize((err) => (err ? reject(err) : resolve()));
    });

    console.log("Importing favorites...");
    const favoriteStmt = db.prepare("INSERT OR REPLACE INTO favorites (username, movieSlug) VALUES (?, ?)");
    for (const favorite of favorites) {
      await runPreparedStatement(favoriteStmt, [favorite.username, favorite.filmSlug]);
    }
    await new Promise((resolve, reject) => {
      favoriteStmt.finalize((err) => (err ? reject(err) : resolve()));
    });

    console.log("Importing nanogenres...");
    const nanogenreStmt = db.prepare("INSERT OR REPLACE INTO nanogenres (movieSlug, nanogenre) VALUES (?, ?)");
    for (const nanogenre of nanogenres) {
      await runPreparedStatement(nanogenreStmt, [nanogenre.filmSlug, nanogenre.nanogenre]);
    }
    await new Promise((resolve, reject) => {
      nanogenreStmt.finalize((err) => (err ? reject(err) : resolve()));
    });

    console.log("Data import completed successfully.");
  } catch (error) {
    console.log(error);
    throw new Error(`Error importing data: ${error.message}`);
  }
};

// Create indexes
const createIndexes = async (db) => {
  console.log("Creating indexes...");
  try {
    await dbRun(db, "CREATE INDEX IF NOT EXISTS idx_genres_filmSlug ON genres(movieSlug)");
    await dbRun(db, "CREATE INDEX IF NOT EXISTS idx_likes_filmSlug ON likes(movieSlug)");
    await dbRun(db, "CREATE INDEX IF NOT EXISTS idx_likes_username ON likes(username)");
    await dbRun(db, "CREATE INDEX IF NOT EXISTS idx_favorites_filmSlug ON favorites(movieSlug)");
    await dbRun(db, "CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username)");
    console.log("Indexes created successfully.");
  } catch (error) {
    throw new Error(`Error creating indexes: ${error.message}`);
  }
};

const dropTable = async (tableName) => {
  db = await initializeDB();
  console.log(`Dropping ${tableName} table...`);
  try {
    await dbRun(db, `DROP TABLE ${tableName}`);

    console.log(`Dropped ${tableName} successfully.`);
  } catch (error) {
    console.log(error);
    throw new Error(`Error dropping ${tableName} table: ${error.message}`);
  } finally {
    if (db) {
      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            console.error("Error closing database:", err);
            reject(err);
          } else {
            console.log("Database connection closed.");
            resolve();
          }
        });
      });
    }
  }
};

//Drop like row from likes table if movieSlug is not in movies table
const dropLikeRow = async () => {
  db = await initializeDB();
  await dbRun(db, "DELETE FROM likes WHERE movieSlug not in (select distinct slug from movies)");
};

// const importFile = async (db, fileName) => {
//   console.log(`Importing data from ${fileName}...`);
//   try {
//     // Read JSON file
//     const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../FILES/code/GiveMeAMovieToWatch/json_files/", fileName), "utf8"));
//     // Determine table name from file name (remove .json extension)
//     const tableName = fileName.replace(".json", "");

//     // Create appropriate prepared statement based on table
//     let stmt;
//     switch (tableName) {
//       case "movies":
//         stmt = db.prepare(
//           "INSERT OR REPLACE INTO movies (slug, name, avgRating, popularityRanking, posterUrl, link, year) VALUES (?, ?, ?, ?, ?, ?, ?)"
//         );
//         let popularityRanking = 1;
//         for (const item of data) {
//           await runPreparedStatement(stmt, [
//             item.slug,
//             item.name,
//             parseFloat(item.avgRating),
//             popularityRanking,
//             item.posterUrl,
//             item.link,
//             item.year,
//           ]);
//           popularityRanking++;
//         }
//         break;
//       case "genres":
//         stmt = db.prepare("INSERT OR REPLACE INTO genres (movieSlug, genre) VALUES (?, ?)");
//         for (const item of data) {
//           await runPreparedStatement(stmt, [item.movieSlug, item.genre]);
//         }
//         break;
//       case "likes":
//         stmt = db.prepare("INSERT OR REPLACE INTO likes (username, movieSlug) VALUES (?, ?)");
//         for (const item of data) {
//           await runPreparedStatement(stmt, [item.username, item.filmSlug]);
//         }
//         break;
//       case "favorites":
//         stmt = db.prepare("INSERT OR REPLACE INTO favorites (username, movieSlug) VALUES (?, ?)");
//         for (const item of data) {
//           await runPreparedStatement(stmt, [item.username, item.movieSlug]);
//         }
//         break;
//       case "nanogenres":
//         stmt = db.prepare("INSERT OR REPLACE INTO nanogenres (movieSlug, nanogenre) VALUES (?, ?)");
//         for (const item of data) {
//           console.log(item);
//           await runPreparedStatement(stmt, [item.filmSlug, item.nanogenre]);
//         }
//         break;
//       default:
//         throw new Error(`Unknown table type: ${tableName}`);
//     }

//     // Finalize the prepared statement
//     await new Promise((resolve, reject) => {
//       stmt.finalize((err) => (err ? reject(err) : resolve()));
//     });

//     console.log(`Successfully imported data from ${fileName}`);
//   } catch (error) {
//     console.error(`Error importing ${fileName}:`, error);
//     throw new Error(`Error importing data from ${fileName}: ${error.message}`);
//   }
// };

// const createTableAndInsertData = async (tableName, fileName) => {
//   db = await initializeDB();
//   try {
//     await createTables(db);
//     await importFile(db, fileName);
//     await createIndexes(db);
//   } catch (error) {
//     console.log(error);
//     throw new Error(`Error dropping ${tableName} table: ${error.message}`);
//   } finally {
//     if (db) {
//       await new Promise((resolve, reject) => {
//         db.close((err) => {
//           if (err) {
//             console.error("Error closing database:", err);
//             reject(err);
//           } else {
//             console.log("Database connection closed.");
//             resolve();
//           }
//         });
//       });
//     }
//   }
// };

// const deleteMoviesWithNoGenre = async (db) => {
//   db = await initializeDB();
//   console.log("Delete Movies With No Genre...");
//   try {
//     await dbRun(db, "DELETE FROM movies WHERE slug not in (select distinct movieSlug from genres )");

//     console.log("Dropped movies successfully.");
//   } catch (error) {
//     console.log(error);
//     throw new Error(`Error creating indexes: ${error.message}`);
//   } finally {
//     if (db) {
//       await new Promise((resolve, reject) => {
//         db.close((err) => {
//           if (err) {
//             console.error("Error closing database:", err);
//             reject(err);
//           } else {
//             console.log("Database connection closed.");
//             resolve();
//           }
//         });
//       });
//     }
//   }
// };

// Main execution

const main = async () => {
  let db;
  try {
    db = await initializeDB();

    await createTables(db);
    await importData(db);
    await createIndexes(db);
    console.log("Database setup completed successfully.");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  } finally {
    if (db) {
      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            console.error("Error closing database:", err);
            reject(err);
          } else {
            console.log("Database connection closed.");
            resolve();
          }
        });
      });
    }
  }
};

main();
// deleteMoviesWithNoGenre();
// dropTable("movies");
// dropLikeRow();
// createTableAndInsertData("movies", "movies.json");
