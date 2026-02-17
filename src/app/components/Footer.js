"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Suggestions", href: "/suggestions" },
  { label: "Saved Movies", href: "/profile/saved-movies" },
  { label: "Sign Up", href: "/signup" },
  { label: "Log In", href: "/login" },
];

const SOCIAL_LINKS = [
  { label: "Github", href: "https://github.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "TikTok", href: "https://tiktok.com" },
];

export default function Footer() {
  const router = useRouter();
  const [hoveredLink, setHoveredLink] = useState(null);

  return (
    <footer className="bg-fadedBlack border-t-4 border-white w-full">
      {/* Top strip — decorative ticker */}
      <div className="overflow-hidden border-b-4 border-white">
        <div className="flex animate-marquee whitespace-nowrap">
          {Array(6)
            .fill(null)
            .map((_, i) => (
              <span key={i} className="inline-block font-specialGothicExpandedOne text-white text-xs tracking-widest uppercase px-8 py-2 opacity-30">
                &nbsp;★&nbsp; find your next favorite film &nbsp;★&nbsp;
              </span>
            ))}
        </div>
      </div>

      {/* Main footer body */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b-4 border-white">
        {/* Col 2 — Navigation */}
        <div className="border-b-4 md:border-b-0 md:border-r-4 border-white p-8">
          <p className="text-white text-xs font-black uppercase tracking-widest mb-6 opacity-50 pl-6">site map</p>
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.label)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="group flex items-center gap-3 py-2 border-b border-white/10 last:border-0"
                >
                  {/* Arrow indicator */}
                  <span
                    className={`text-white font-black text-sm transition-all duration-150 ${
                      hoveredLink === link.label ? "opacity-100 translate-x-1" : "opacity-0 -translate-x-1"
                    }`}
                  >
                    →
                  </span>
                  <span
                    className={`font-black text-md uppercase transition-colors duration-150 ${
                      hoveredLink === link.label ? "text-yellow-300" : "text-white"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — CTA + Social */}
        <div className="p-8 flex flex-col justify-between gap-8">
          {/* CTA block */}
          <div>
            <p className="text-white text-xs font-black uppercase tracking-widest mb-4 opacity-50">Get Started</p>
            <p className="text-white font-black text-xl uppercase leading-snug mb-6">Ready to find your next watch?</p>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-white text-black border-4 border-white py-3 px-6 font-black text-sm uppercase tracking-widest hover:bg-yellow-300 hover:border-yellow-300 transition-colors duration-150"
            >
              Start Matching →
            </button>
          </div>

          {/* Social links */}
          <div>
            <p className="text-white text-xs font-black uppercase tracking-widest mb-4 opacity-50">Follow Us</p>
            <div className="flex gap-3">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-4 border-white text-white font-black text-xs uppercase px-3 py-2 hover:bg-white hover:text-black transition-colors duration-150"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-4 gap-2">
        <p className="text-white text-xs font-bold opacity-30 uppercase tracking-widest">© {new Date().getFullYear()} you should watch.</p>
        <p className="text-white text-xs font-bold opacity-30 uppercase tracking-widest">All rights reserved.</p>
        <div className="flex gap-6">
          {["Privacy Policy", "Terms of Use"].map((item) => (
            <Link
              key={item}
              href="#"
              className="text-white text-xs font-bold opacity-30 uppercase tracking-widest hover:opacity-100 hover:text-yellow-300 transition-all duration-150"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
