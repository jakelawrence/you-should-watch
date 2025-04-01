import NodeCache from "node-cache";

// Cache with 5 minute TTL by default
export const cache = new NodeCache({ stdTTL: 300 });
