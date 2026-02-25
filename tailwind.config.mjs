/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#ebe7e2",
        fadedBlack: "#171717ff",
        fadedBlue: "#05479b",
        fadedGreen: "#65fb44",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-outft)"],
        poppins: ["var(--font-poppins)"],
        specialGothicExpandedOne: ["var(--font-special-gothic-expanded-one)"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 18s linear infinite",
      },
    },
  },
  plugins: [],
};
