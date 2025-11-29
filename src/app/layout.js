import { Outfit, Poppins } from "next/font/google";
import "./globals.css";
import { MovieCollectionProvider } from "./context/MovieCollectionContext";

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
        url: "https://yourdomain.com/og-image.jpg", // Must be absolute URL
        width: 1200,
        height: 630,
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
        <MovieCollectionProvider>{children}</MovieCollectionProvider>
      </body>
    </html>
  );
}
