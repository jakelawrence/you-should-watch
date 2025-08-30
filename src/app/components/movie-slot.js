import React from "react";
import { Plus } from "lucide-react";

export const MovieSlot = ({ index }) => {
  return (
    <div
      key={`placeholder-${index}`}
      className="w-36 h-52 sm:w-34 sm:h-54 md:w-36 md:h-52 lg:w-40 lg:h-56 xl:w-44 xl:h-64 flex items-center justify-center rounded-lg text-text-secondary text-xs sm:text-sm bg-foreground"
    >
      <div className="text-center">
        <Plus size={12} className="size-14 sm:size-18 md:size-14 lg:size-18 xl:size-20 mx-auto mb-1 opacity-50" />
        <span className="text-xs">Add Movie</span>
      </div>
    </div>
  );
};
