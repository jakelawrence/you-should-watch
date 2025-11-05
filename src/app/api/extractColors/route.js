// pages/api/extract-colors.js (or app/api/extract-colors/route.js for App Router)

import { createCanvas, loadImage } from "canvas";
const DARKNESS_MULTIPLIER = 0.2;

// For App Router (app/api/extract-colors/route.js)
export async function POST(request) {
  try {
    const { imageUrls } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json({ error: "Image URLs array is required" }, { status: 400 });
    }

    const results = {};

    // Process all images concurrently
    const promises = imageUrls.map(async (item) => {
      const { slug, url } = item;
      try {
        const colors = await extractColorsFromImage(url);
        return { slug, colors };
      } catch (error) {
        console.error(`Error extracting colors for image ${slug}:`, error);
        return { slug, colors: getDefaultColors() };
      }
    });

    const colorResults = await Promise.all(promises);

    // Convert array to object with id as key
    colorResults.forEach(({ slug, colors }) => {
      results[slug] = colors;
    });

    return Response.json({ results });
  } catch (error) {
    console.error("Error processing color extraction requests:", error);
    return Response.json(
      {
        error: "Failed to extract colors",
        results: {},
      },
      { status: 500 }
    );
  }
}

async function extractColorsFromImage(imageUrl) {
  try {
    // Load the image using canvas
    const img = await loadImage(imageUrl);

    // Create canvas and get image data
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    // Color extraction algorithm focused on vibrant colors
    const colorMap = new Map();
    const sampleSize = 10; // Sample every 10th pixel for performance

    for (let i = 0; i < pixels.length; i += 4 * sampleSize) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      // Calculate saturation and brightness
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = max / 255;

      // Skip colors that aren't vibrant enough
      // We want high saturation (colorful) and moderate to high brightness
      if (saturation < 0.3) continue; // Skip dull/grayish colors
      if (brightness < 0.2 || brightness > 0.95) continue; // Skip too dark or too bright

      // Group similar colors (wider grouping for better color clusters)
      const key = `${Math.floor(r / 20) * 20}-${Math.floor(g / 20) * 20}-${Math.floor(b / 20) * 20}`;

      // Store color data with vibrancy score
      if (!colorMap.has(key)) {
        colorMap.set(key, {
          r: Math.floor(r / 20) * 20,
          g: Math.floor(g / 20) * 20,
          b: Math.floor(b / 20) * 20,
          count: 0,
          saturation: 0,
          brightness: 0,
        });
      }

      const colorData = colorMap.get(key);
      colorData.count += 1;
      colorData.saturation += saturation;
      colorData.brightness += brightness;
    }

    // Calculate vibrancy score for each color
    const colorScores = Array.from(colorMap.values()).map((data) => {
      const avgSaturation = data.saturation / data.count;
      const avgBrightness = data.brightness / data.count;

      // Vibrancy score combines frequency, saturation, and brightness
      // Higher saturation = more vibrant
      // Moderate brightness is ideal (0.4-0.8 range)
      const brightnessScore = 1 - Math.abs(0.6 - avgBrightness) / 0.6;
      const vibrancyScore = data.count * avgSaturation * 2 * brightnessScore;

      return {
        rgb: [data.r, data.g, data.b],
        score: vibrancyScore,
        saturation: avgSaturation,
        count: data.count,
      };
    });

    // Sort by vibrancy score (highest first)
    const sortedColors = colorScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.rgb);

    if (sortedColors.length === 0) {
      return getDefaultColors();
    }

    const dominantColor = sortedColors[0];
    const dominantHex = rgbToHex(dominantColor);

    // Create darker background variation
    const darkerBg = `rgb(${Math.floor(dominantColor[0] * DARKNESS_MULTIPLIER)}, ${Math.floor(dominantColor[1] * DARKNESS_MULTIPLIER)}, ${Math.floor(
      dominantColor[2] * DARKNESS_MULTIPLIER
    )})`;

    const palette = sortedColors.map((color) => rgbToHex(color));

    return {
      dominant: dominantHex,
      palette: palette,
      background: darkerBg,
      accent: dominantHex,
      button: dominantHex,
    };
  } catch (error) {
    console.error("Color extraction failed:", error);
    return getDefaultColors();
  }
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb;
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.max(0, Math.min(255, x)).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

function getDefaultColors() {
  return {
    dominant: "#3b82f6",
    palette: ["#3b82f6", "#1e40af", "#60a5fa"],
    background: "rgb(30, 64, 175)",
    accent: "#3b82f6",
    button: "#3b82f6",
  };
}
