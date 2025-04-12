import { Search } from "lucide-react";
import React from "react";

export const SearchBar = ({ searchQuery, setSearchQuery }) => {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="relative">
      <div className="relative">
        <Search className="text-purple-600 absolute left-4 top-1/2 -translate-y-1/2" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for movies..."
          className="w-full pl-12 pr-4 py-4 font-bold rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg transition-all"
        />
      </div>
    </form>
  );
};
