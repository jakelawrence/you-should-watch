import React from "react";

export const Loading = () => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    </div>
  );
};
