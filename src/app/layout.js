import { Outfit, Poppins, Special_Gothic_Expanded_One } from "next/font/google";
import "./globals.css";
import { MovieCollectionProvider } from "./context/MovieCollectionContext";
import Footer from "./components/Footer";
const outfit = Outfit({ weight: "200", subsets: ["latin"] });

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-poppins",
});

const specialGothicExpandedOne = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special-gothic-expanded-one",
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
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${specialGothicExpandedOne.variable}`}>
      <body className={`${outfit.className} antialiased bg-fadedBlack`}>
        <MovieCollectionProvider>
          <div>{children}</div>
          <Footer />
        </MovieCollectionProvider>
      </body>
    </html>
  );
}
