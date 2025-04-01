import React from "react";
import Link from "next/link";
import { Plug } from "lucide-react";

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Plug size={20} className="text-purple-600 rotate-90 mt-0.5" />
      <h1 className="text-lg font-bold">the movie plug</h1>
    </Link>
  );
};
