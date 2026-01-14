"use client";

import { useState, useEffect } from "react";

export default function RateLimitWarning({ remaining, total, resetAt, onCreateAccount }) {
  const [timeUntilReset, setTimeUntilReset] = useState("");

  useEffect(() => {
    if (!resetAt) return;

    const updateTime = () => {
      const now = Date.now();
      const reset = new Date(resetAt).getTime();
      const diff = reset - now;

      if (diff <= 0) {
        setTimeUntilReset("now");
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);

      if (hours > 0) {
        setTimeUntilReset(`${hours}h ${minutes}m`);
      } else {
        setTimeUntilReset(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [resetAt]);

  if (remaining === total) return null; // Don't show if unused

  const isLow = remaining <= 1;
  const isExhausted = remaining === 0;

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 border-4 border-black ${isExhausted ? "bg-red-400" : isLow ? "bg-yellow-300" : "bg-blue-200"} max-w-sm`}
    >
      <div className="text-sm font-black uppercase mb-2">{isExhausted ? "Limit Reached" : "Free Uses"}</div>

      {!isExhausted && (
        <div className="text-2xl font-black mb-2">
          {remaining} / {total}
        </div>
      )}

      <div className="text-sm font-bold mb-3">
        {isExhausted ? `Resets in ${timeUntilReset}` : `${remaining} ${remaining === 1 ? "suggestion" : "suggestions"} left`}
      </div>

      {isLow && (
        <button
          onClick={onCreateAccount}
          className="w-full bg-black text-white px-4 py-2 font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
        >
          Create Account for More
        </button>
      )}
    </div>
  );
}
