import {
  Heart,
  Baby,
  Laugh,
  Popcorn,
  Droplets,
  Zap,
  Coffee,
  Moon,
  Smile,
  Ghost,
  Sparkles,
  Clock,
  Sofa,
  Film,
  Music4,
  Trophy,
  Lightbulb,
  Timer,
  Globe,
} from "lucide-react";

function buildRoute(filters) {
  const params = new URLSearchParams();
  if (filters.genres?.length) params.set("genres", filters.genres.join(","));
  if (filters.vibes?.length) params.set("vibes", filters.vibes.join(","));
  if (filters.durations?.length) params.set("duration", filters.durations[0]);
  if (filters.decades?.length) params.set("decade", filters.decades[0]);
  return `/search?${params.toString()}`;
}

export const SCENARIOS = [
  {
    key: "date-night",
    label: "Date Night",
    description: "Romantic and easy to watch",
    icon: Heart,
    filters: {
      genres: ["Romance"],
      durations: ["medium"],
    },
  },
  {
    key: "movie-night-with-kids",
    label: "Movie Night with Kids",
    description: "Fun and safe for the whole family",
    icon: Baby,
    filters: {
      genres: ["Animation", "Family"],
      vibes: ["light", "funny"],
      durations: ["short", "medium"],
    },
  },
  {
    key: "game-night-warmup",
    label: "Game Night Warmup",
    description: "Light and fun before the games begin",
    icon: Laugh,
    filters: {
      genres: ["Comedy"],
      vibes: ["light", "funny", "fast-pace"],
      durations: ["short"],
    },
  },
  {
    key: "need-a-good-cry",
    label: "Need a Good Cry",
    description: "Emotional and moving stories",
    icon: Droplets,
    filters: {
      genres: ["Drama", "Romance"],
      vibes: ["dark", "slow-burn"],
      durations: ["medium", "long"],
    },
  },
  {
    key: "adrenaline-rush",
    label: "Adrenaline Rush",
    description: "High octane and non-stop action",
    icon: Zap,
    filters: {
      genres: ["Action", "Thriller"],
      vibes: ["intense", "fast-pace"],
      durations: ["medium"],
    },
  },
  {
    key: "cozy-sunday",
    label: "Cozy Sunday",
    description: "Warm and relaxing watch",
    icon: Coffee,
    filters: {
      genres: ["Comedy", "Romance", "Drama"],
      vibes: ["light", "chill"],
      durations: ["medium"],
    },
  },
  {
    key: "cant-sleep",
    label: "Can't Sleep",
    description: "Gripping enough to keep you up",
    icon: Moon,
    filters: {
      genres: ["Horror", "Thriller", "Mystery"],
      vibes: ["dark", "intense"],
      durations: ["medium"],
    },
  },
  {
    key: "feel-good-fix",
    label: "Feel Good Fix",
    description: "Guaranteed to lift your mood",
    icon: Smile,
    filters: {
      genres: ["Comedy", "Family"],
      vibes: ["light", "funny"],
      durations: ["short", "medium"],
    },
  },
  {
    key: "halloween-night",
    label: "Halloween Night",
    description: "Scary and atmospheric horror",
    icon: Ghost,
    filters: {
      genres: ["Horror", "Thriller"],
      vibes: ["dark", "intense"],
      durations: ["medium"],
    },
  },
  {
    key: "new-years-eve",
    label: "New Year's Eve",
    description: "Celebratory and fun",
    icon: Sparkles,
    filters: {
      genres: ["Comedy", "Drama"],
      vibes: ["light", "funny"],
      durations: ["short"],
    },
  },
  {
    key: "long-haul-flight",
    label: "Long Haul Flight",
    description: "Epic stories worth the runtime",
    icon: Clock,
    filters: {
      genres: ["Drama", "Adventure"],
      vibes: ["chill", "slow-burn"],
      durations: ["long"],
    },
  },
  {
    key: "sick-day",
    label: "Sick Day",
    description: "Easy and comforting on a rough day",
    icon: Sofa,
    filters: {
      genres: ["Comedy", "Animation", "Fantasy"],
      vibes: ["light", "funny", "chill"],
      durations: ["short", "medium"],
    },
  },
  {
    key: "golden-age-hollywood",
    label: "Golden Age Hollywood",
    description: "Timeless classics from the golden era",
    icon: Film,
    filters: {
      genres: ["Drama", "Romance", "Comedy"],
      decades: ["classic"],
      durations: ["medium"],
    },
  },
  {
    key: "80s-nostalgia",
    label: "80s Nostalgia",
    description: "Big hair, big fun, big decade",
    icon: Music4,
    filters: {
      genres: ["Action", "Comedy", "Adventure"],
      decades: ["1980s"],
    },
  },
  {
    key: "prestige-cinema",
    label: "Prestige Cinema",
    description: "Award-worthy, thought-provoking films",
    icon: Trophy,
    filters: {
      genres: ["Drama", "History", "War"],
      vibes: ["dark", "slow-burn"],
      durations: ["long"],
    },
  },
  {
    key: "popcorn-blockbuster",
    label: "Popcorn Blockbuster",
    description: "Big budget, big screen energy",
    icon: Popcorn,
    filters: {
      genres: ["Action", "Adventure", "Science Fiction"],
      vibes: ["intense", "fast-pace"],
      durations: ["medium", "long"],
    },
  },
  {
    key: "hidden-gems",
    label: "Hidden Gems",
    description: "Underseen films that deserve more love",
    icon: Lightbulb,
    filters: {
      genres: ["Drama", "Crime", "Mystery"],
      vibes: ["slow-burn"],
      decades: ["1990s", "2000s"],
    },
  },
  {
    key: "quick-lunch-break",
    label: "Quick Lunch Break",
    description: "Short enough to finish on your break",
    icon: Timer,
    filters: {
      vibes: ["fast-pace"],
      durations: ["short"],
    },
  },
  {
    key: "world-cinema-night",
    label: "World Cinema Night",
    description: "Acclaimed films from around the globe",
    icon: Globe,
    filters: {
      genres: ["Drama", "History", "War"],
      vibes: ["dark", "slow-burn"],
      decades: ["classic", "1980s", "1990s"],
    },
  },
].map((scenario) => ({ ...scenario, route: buildRoute(scenario.filters) }));
