export default function Footer() {
  return (
    <footer className="bg-white border-t-4 border-black">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left - Brand */}
          <p className="text-black font-bold text-sm">© 2024 You Should Watch</p>

          {/* Right - Links */}
          <div className="flex gap-6">
            <a href="/" className="text-black font-bold text-sm hover:underline">
              Home
            </a>
            <a href="/suggested-movies" className="text-black font-bold text-sm hover:underline">
              Suggestions
            </a>
            <a href="#" className="text-black font-bold text-sm hover:underline">
              About
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
