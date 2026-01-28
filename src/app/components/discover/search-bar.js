import { Search } from "lucide-react";
import { React, useRef } from "react";

export const SearchBar = ({ searchQuery, setSearchQuery, disabled }) => {
  const searchInputRef = useRef(null);

  const handleFocus = () => {
    setTimeout(() => {
      searchInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center", // Changed from 'start'
      });
    }, 300);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="relative w-[270px] lg:w-[320px]">
      <input
        type="text"
        value={searchQuery}
        ref={searchInputRef}
        onFocus={handleFocus}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search for movies..."
        className={`w-full px-6 py-4 border-4 border-black text-black placeholder-gray-600 font-bold text-lg outline-none transition-all ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      />
      <Search
        className={`absolute right-4 top-1/2 -translate-y-1/2 text-black ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        size={24}
        strokeWidth={3}
      />
    </form>
  );
};
