import films from "../../../../json_files/films.json"; // Adjust the path as needed

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.toLowerCase() || "";

  // If the query is empty, return an empty array
  if (!query) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Filter films based on the query
  const suggestions = films.filter((film) => film.name.toLowerCase().includes(query)).slice(0, 10); // Limit suggestions to 10 results

  return new Response(JSON.stringify(suggestions), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
