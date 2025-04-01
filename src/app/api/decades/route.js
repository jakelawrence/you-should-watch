import { NextResponse } from "next/server";
import { openDb } from "../lib/db";

export async function GET() {
  try {
    const db = await openDb();
    const decades = await db.all(`
      SELECT DISTINCT 
          CAST((year / 10) * 10 AS TEXT) AS decade
      FROM movies
      WHERE year GLOB '[0-9][0-9][0-9][0-9]'
      ORDER BY decade;
    `);
    await db.close();

    return NextResponse.json({
      decades: decades.map((d) => parseInt(d.decade)).filter((d) => !isNaN(d)),
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to fetch decades" }, { status: 500 });
  }
}
