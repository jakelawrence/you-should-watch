"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Clapperboard } from "lucide-react";

export function NavigationBar({ collectionItemsCount, onCollectionClick }) {
  const router = useRouter();

  return (
    <nav className="bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Logo />
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/browse")}
              className="text-text-secondary hover:text-text-primary px-3 py-2 rounded-md text-sm font-bold transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onCollectionClick}
              className="relative text-text-secondary hover:text-text-primary px-3 py-2 rounded-md transition-colors"
            >
              <Clapperboard size={24} className="text-purple-600" />
              {collectionItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs/4 font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {collectionItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
