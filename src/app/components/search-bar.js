import { Search } from "lucide-react";
import React from "react";

export const SearchBar = ({ searchQuery, setSearchQuery }) => {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search for movies..."
        className="w-full px-6 py-4 border-4 border-black text-black placeholder-gray-600 font-bold text-lg outline-none transition-all"
      />
      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-black" size={24} strokeWidth={3} />
    </form>
  );
};
