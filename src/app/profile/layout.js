// Signed-in pages depend on who is asking, so they must never be served from a shared CDN cache.
// force-dynamic makes Next.js send "Cache-Control: private, no-cache, no-store" for every page here.
export const dynamic = "force-dynamic";

export default function PrivateLayout({ children }) {
  return children;
}
