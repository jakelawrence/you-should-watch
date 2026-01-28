import { Outfit, Poppins } from "next/font/google";
import "./globals.css";
import { MovieCollectionProvider } from "./context/MovieCollectionContext";
import Navbar from "./components/Navbar";

const outfit = Outfit({ weight: "200", subsets: ["latin"] });

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-poppins",
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
    <html lang="en" className={`${outfit.variable} ${poppins.variable}`}>
      <body className={`${outfit.className} antialiased`}>
        <MovieCollectionProvider>
          <Navbar />
          {/* Add padding-top to account for fixed navbar */}
          <div className="pt-16">{children}</div>
        </MovieCollectionProvider>
      </body>
    </html>
  );
}
