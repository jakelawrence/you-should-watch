/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f6f1ea",
        backgroundSecondary: "#efe7dd",
        fadedBlack: "#1f1b17",
        fadedBlue: "#4f6f8a",
        fadedGreen: "#5b7c66",
        fadedGold: "#d7c7a3",
        danger: "#b25b5b",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)"],
        dmSans: ["var(--font-dm-sans)"],
        dmSerifDisplay: ["var(--font-dm-serif-display)"],
        bigShouldersDisplay: ["var(--font-big-shoulders-display)"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-50%, 0, 0)" },
        },
      },
      animation: {
        marquee: "marquee 18s linear infinite",
      },
    },
  },
  plugins: [],
};
