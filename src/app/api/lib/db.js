import sqlite3 from "sqlite3";
import { open } from "sqlite";

export class DatabaseError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "DatabaseError";
  }
}

export async function openDb() {
  try {
    return await open({
      filename: "movies.db",
      driver: sqlite3.Database,
    });
  } catch (error) {
    throw new DatabaseError("Failed to connect to database", "DB_CONNECT_ERROR");
  }
}
