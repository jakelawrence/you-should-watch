# You Should Watch 🎬

A modern web application that helps users discover their next favorite movie through AI-powered recommendations and mood-based filtering.

**Live Site:** [https://you-should-watch.vercel.app/](https://you-should-watch.vercel.app/)

## Overview

YouShouldWatch provides personalized movie recommendations based on multiple discovery methods. Users can find movies similar to ones they love, discover hidden gems based on their current mood, or get surprising recommendations from across the popularity spectrum.

## Features

### 🎯 Multiple Discovery Scenarios

- **Find Similar** - Get recommendations based on a single movie you love
- **Date Night** - Find the perfect compromise between two people's tastes
- **Surprise Me** - Discover curated picks from different popularity tiers
- **Mood Match** - Filter movies by tone, style, pace, intensity, and emotion

### 🎨 User Experience

- Clean, minimalist black-and-white design aesthetic
- Bold lowercase typography with smooth animations
- Fully responsive layout optimized for mobile and desktop
- Touch gesture support for mobile navigation
- Real-time search with autocomplete suggestions

### 🧠 Intelligent Recommendations

- Collaborative filtering algorithm using viewer overlap analysis
- Custom mood metrics: darkness, funniness, slowness, and intensity levels
- Genre-based scoring with keyword modifiers
- Popularity-based diversity to balance mainstream and hidden gems

## Tech Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **React** - UI component library
- **TailwindCSS** - Utility-first CSS framework
- **Lucide React** - Icon library

### Backend

- **Next.js API Routes** - Serverless API endpoints
- **AWS DynamoDB** - NoSQL database for movie data
- **AWS SDK** - DynamoDB client integration

### Data Processing

- **Puppeteer** - Web scraping for movie data collection
- **Custom algorithms** - Collaborative filtering and mood analysis

### Deployment

- **Vercel** - Hosting and deployment platform
- **AWS** - Database infrastructure

## Architecture

### Data Flow

```
User Input → Scenario Selection → Movie Collection → API Request →
DynamoDB Query → Recommendation Algorithm → AI Enhancement → Results Display
```

### Project Structure

```
├── app/
│   ├── page.js                    # Landing page
│   ├── scenario/                  # Scenario selection
│   ├── add-movies/                # Movie collection builder
│   ├── movie-mood/                # Mood preference selector
│   ├── suggestions/               # Recommendations display
│   └── api/
│       └── suggestions/           # Unified suggestions endpoint
├── components/
│   ├── discover/                  # Movie search components
│   └── landing/                   # Landing page components
├── context/
│   └── MovieCollectionContext.js  # Global state management
├── lib/
│   ├── dynamodb.js               # Database operations
│   └── logger.js                 # Logging utilities
└── scripts/
    └── add-mood-levels.js        # Mood metric calculation
```

## Recommendation Algorithm

### Collaborative Filtering

1. Identifies users who liked the input movies
2. Calculates overlap scores between user lists
3. Finds movies with high overlap but not in original set
4. Ranks by weighted popularity and rating

### Mood-Based Filtering

Movies are scored on four metrics (0-10 scale):

- **Darkness Level** - Light/wholesome to dark/disturbing
- **Funniness Level** - Serious to comedic
- **Slowness Level** - Fast-paced to contemplative
- **Intensity Level** - Relaxed to intense/stressful

Each metric is calculated from:

- Genre-based base scores
- Keyword modifiers from title/description
- User-selected mood preferences

### Surprise Me Algorithm

Provides diversity by selecting one movie from each popularity tier:

- 0-200 (Ultra Popular)
- 200-400 (Very Popular)
- 400-600 (Popular)
- 600-800 (Moderately Popular)
- 800-1000 (Less Popular)
- 1000+ (Hidden Gems)

## Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- AWS Account (for DynamoDB)

### Environment Variables

Create a `.env.local` file:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Database
DYNAMODB_TABLE_NAME=movies
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/youshouldwatch.git
cd youshouldwatch

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
# Navigate to http://localhost:3000
```

### Database Setup

1. Create a DynamoDB table named `movies` with primary key `slug` (String)
2. Run the mood metrics calculation script:

```bash
node scripts/add-mood-levels.js
```

## Data Collection

Movie data is scraped from Letterboxd using Puppeteer:

## API Endpoints

### POST `/api/suggestions`

Unified endpoint for all recommendation types.

**Request Body:**

```json
{
  "mode": "collaborative" | "surprise" | "mood",
  "inputSlugs": ["movie-slug-1", "movie-slug-2"],  // for collaborative
  "moodParams": {                                   // for mood
    "tone": "dark",
    "style": "serious",
    "popularity": "hidden-gem",
    "duration": "long",
    "pace": "slow",
    "emotion": "intense"
  }
}
```

**Response:**

```json
{
  "recommendations": [
    {
      "slug": "movie-slug",
      "title": "Movie Title",
      "year": 2024,
      "director": "Director Name",
      "genres": ["Drama", "Thriller"],
      "posterUrl": "https://...",
      "averageRating": 4.2,
      "popularity": 450,
      "darknessLevel": 7.5,
      "funninessLevel": 2.0,
      "slownessLevel": 6.0,
      "intensenessLevel": 8.0
    }
  ]
}
```

## Future Enhancements

- [ ] User authentication and accounts
- [ ] Save and share recommendation lists
- [ ] Social features (follow users, see friends' ratings)
- [ ] Personalized recommendation history
- [ ] Watchlist management
- [ ] Integration with streaming service availability
- [ ] Advanced filters (decade, country, language)
- [ ] Rate limiting and usage quotas
- [ ] Movie reviews and ratings

## Performance Optimizations

- Server-side rendering for fast initial page loads
- Client-side caching of movie data
- Lazy loading of images
- Request interception to block unnecessary resources
- DynamoDB query optimization with batch operations
- In-memory caching for frequent queries

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Movie data sourced from Letterboxd
- Icons from Lucide React
- Hosted on Vercel
- Database powered by AWS DynamoDB

---

**Built by Jake Lawrence**
