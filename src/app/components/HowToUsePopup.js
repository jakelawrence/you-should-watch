"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function HowToUsePopup({ open, onClose }) {
  const [visible, setVisible] = useState(false);

  // Auto-show on first-ever visit (localStorage persists across sessions)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeen = localStorage.getItem("ysw-intro-seen");
    if (!hasSeen) {
      setVisible(true);
      localStorage.setItem("ysw-intro-seen", "true");
    }
  }, []);

  // Show when parent explicitly requests it
  useEffect(() => {
    if (open === true) setVisible(true);
  }, [open]);

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 cursor-pointer" onClick={close} aria-hidden="true" />
      <div
        className="relative bg-background border border-fadedBlack/15 p-8 max-w-sm w-full"
        role="dialog"
        aria-modal="true"
        aria-label="How it works"
      >
        <button
          onClick={close}
          className="absolute top-0 right-0 bg-background border-b border-l border-fadedBlack/15 p-2 hover:bg-backgroundSecondary transition-colors"
          aria-label="Close"
        >
          <X className="text-fadedBlack" size={20} strokeWidth={3} />
        </button>

        <p className="text-xs font-black uppercase tracking-widest text-fadedBlack/40 mb-6">How it works</p>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <span className="font-bigShouldersDisplay text-fadedBlack/20 text-2xl leading-none mt-0.5 flex-shrink-0 tabular-nums">01</span>
            <div>
              <p className="font-black text-fadedBlack uppercase text-sm mb-1">Search a film you love</p>
              <p className="font-bold text-fadedBlack/60 text-sm leading-snug">Type any title — something you've seen and want more like.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="font-bigShouldersDisplay text-fadedBlack/20 text-2xl leading-none mt-0.5 flex-shrink-0 tabular-nums">02</span>
            <div>
              <p className="font-black text-fadedBlack uppercase text-sm mb-1">See your matches</p>
              <p className="font-bold text-fadedBlack/60 text-sm leading-snug">We find films with the same tone, mood, and feel — not just the same genre.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="font-bigShouldersDisplay text-fadedBlack/20 text-2xl leading-none mt-0.5 flex-shrink-0 tabular-nums">03</span>
            <div>
              <p className="font-black text-fadedBlack uppercase text-sm mb-1">Save what appeals</p>
              <p className="font-bold text-fadedBlack/60 text-sm leading-snug">Bookmark films to your profile. Sign up to keep them.</p>
            </div>
          </div>
        </div>

        <button
          onClick={close}
          className="w-full mt-8 bg-fadedBlack border-2 border-fadedBlack py-3 font-black text-background uppercase text-sm tracking-widest hover:bg-fadedBlue transition-colors"
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}
