import { Raleway, Special_Gothic_Expanded_One, Syne } from "next/font/google";
import "./globals.css";
import { MovieCollectionProvider } from "./context/MovieCollectionContext";
import Footer from "./components/Footer";

const syne = Syne({ subsets: ["latin"], weight: ["800"], variable: "--font-syne", display: "swap" });
const raleway = Raleway({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-raleway", display: "swap" });

const specialGothicExpandedOne = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special-gothic-expanded-one",
  display: "swap",
});

export const metadata = {
  title: "You Should Watch",
  description: "Find your next favorite movie",
  openGraph: {
    title: "You Should Watch",
    description: "Find your next favorite movie",
    url: "https://you-should-watch.vercel.app/",
    siteName: "You Should Watch",
    images: [
      {
        url: "https://raw.githubusercontent.com/jakelawrence/you-should-watch/refs/heads/main/public/images/you-should-watch-meta-image.png", // Must be absolute URL
        width: 1748,
        height: 2480,
        alt: "You Should Watch",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${raleway.variable} ${specialGothicExpandedOne.variable} ${syne.variable}`}>
      <body className={`${raleway.className} antialiased bg-background text-fadedBlack`}>
        <MovieCollectionProvider>
          <div>{children}</div>
          <Footer />
        </MovieCollectionProvider>
      </body>
    </html>
  );
}
