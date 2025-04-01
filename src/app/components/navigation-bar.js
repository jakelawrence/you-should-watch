"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";

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
              className="text-text-secondary hover:text-text-primary px-3 py-2 rounded-md text-sm transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onCollectionClick}
              className="relative text-text-secondary hover:text-text-primary px-3 py-2 rounded-md text-sm transition-colors"
            >
              Collection
              {collectionItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
