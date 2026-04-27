import localFont from "next/font/local";
import "./globals.css";
import { MovieCollectionProvider } from "./context/MovieCollectionContext";
import Footer from "./components/Footer";
import AuthProvider from "./components/AuthProvider";

const dmSerifDisplay = localFont({
  src: "../../design/fonts/dm-serif-display-v17-latin-regular.woff2",
  variable: "--font-dm-serif-display",
  display: "swap",
});

const bigShouldersDisplay = localFont({
  src: "../../design/fonts/big-shoulders-v4-latin-regular.woff2",
  variable: "--font-big-shoulders-display",
  display: "swap",
});

const dmSans = localFont({
  src: "../../design/fonts/dm-sans-v17-latin-regular.woff2",
  variable: "--font-dm-sans",
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
        url: "https://raw.githubusercontent.com/jakelawrence/you-should-watch/refs/heads/main/public/images/you-should-watch-meta-image.png",
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
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${bigShouldersDisplay.variable} ${dmSans.variable}`}
    >
      <body className={`${dmSans.className} antialiased bg-background text-fadedBlack`}>
        <AuthProvider>
          <MovieCollectionProvider>
            <div>{children}</div>
            <Footer />
          </MovieCollectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
