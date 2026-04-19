"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCENARIOS } from "../api/lib/scenarios";
import { Search } from "lucide-react";

export default function Scenarios({ isLoaded }) {
  const router = useRouter();
  const NUM_SCENARIOS_SHOWN = 6;
  const totalCards = useMemo(() => NUM_SCENARIOS_SHOWN + 1, [NUM_SCENARIOS_SHOWN]);
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardMetricsRef = useRef({ cardWidth: 0, gap: 0 });

  const handleScenarioClick = (scenario) => {
    router.push(scenario.route);
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const measure = () => {
      const firstCard = scroller.querySelector("[data-scenario-card]");
      if (!firstCard) return;
      const cardRect = firstCard.getBoundingClientRect();
      const flexContainer = firstCard.parentElement;
      const flexStyles = window.getComputedStyle(flexContainer);
      const gap = parseFloat(flexStyles.columnGap || flexStyles.gap || "0");
      cardMetricsRef.current = { cardWidth: cardRect.width, gap };
    };

    const updateActive = () => {
      const { cardWidth, gap } = cardMetricsRef.current;
      const step = cardWidth + gap;
      if (step <= 0) return;
      const rawIndex = Math.round(scroller.scrollLeft / step);
      const clamped = Math.max(0, Math.min(totalCards - 1, rawIndex));
      setActiveIndex(clamped);
    };

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateActive();
      });
    };

    measure();
    updateActive();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [totalCards]);

  return (
    <div
      className={`px-4 sm:px-6 pb-8 sm:pb-10 transition-all relative z-1 duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      style={{ transitionDelay: "400ms" }}
    >
      {/* Mobile Carousel */}
      <div className="block md:hidden">
        <div ref={scrollerRef} className="overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          <div className="flex gap-6 pb-4">
            {SCENARIOS.slice(0, NUM_SCENARIOS_SHOWN).map((scenario) => {
              const Icon = scenario.icon;
              return (
                <div key={scenario.key} className="flex-shrink-0 w-72 snap-center" data-scenario-card>
                  <button
                    onClick={() => handleScenarioClick(scenario)}
                    aria-label={`Open ${scenario.label} scenario`}
                    className="bg-background hover:bg-fadedBlack border border-fadedBlack/15 p-6 text-left transition-colors duration-200 group w-full h-56 flex flex-col"
                  >
                    <Icon className="mb-3 text-fadedBlack group-hover:text-background transition-colors" size={40} strokeWidth={3} />
                    <h3 className="text-2xl sm:text-3xl font-black uppercase mb-2 text-fadedBlack group-hover:text-background transition-colors">{scenario.label}</h3>
                    <p className="text-base sm:text-lg font-bold text-fadedBlack group-hover:text-background transition-colors">{scenario.description}</p>
                  </button>
                </div>
              );
            })}
            <div key={NUM_SCENARIOS_SHOWN + 1} className="flex-shrink-0 w-72 snap-center" data-scenario-card>
              <button
                onClick={() => router.push("/scenarios")}
                aria-label={`Explore more scenarios`}
                className="bg-fadedBlack border border-fadedBlack p-6 text-left transition-colors duration-200 hover:bg-fadedBlue hover:border-fadedBlue group w-full h-56 flex flex-col"
              >
                <Search className="mb-3 text-background" size={40} strokeWidth={3} />
                <h3 className="text-2xl sm:text-3xl font-black uppercase mb-2 text-background">All Scenarios</h3>
                <p className="text-base sm:text-lg font-bold text-background">Browse every viewing mood</p>
              </button>
            </div>
          </div>
        </div>
        {/* Carousel Indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalCards }).map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${index === activeIndex ? "bg-fadedBlack" : "bg-fadedBlack/30"}`}
              aria-hidden="true"
            ></div>
          ))}
        </div>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid grid-cols-2 gap-6">
        {SCENARIOS.slice(0, NUM_SCENARIOS_SHOWN).map((scenario, index) => {
          return (
            <button
              key={scenario.key}
              onClick={() => handleScenarioClick(scenario)}
              className="bg-background hover:bg-fadedBlack border border-fadedBlack/15 p-6 flex flex-col items-start gap-4 transition-colors duration-200 group"
            >
              <scenario.icon size={48} className="text-fadedBlack group-hover:text-background transition-colors" />
              <p className="font-specialGothicExpandedOne text-fadedBlack text-xl font-bold uppercase group-hover:text-background transition-colors">{scenario.label}</p>
              <p className="font-bold text-fadedBlack text-sm text-left group-hover:text-background transition-colors">{scenario.description}</p>
            </button>
          );
        })}
        <div className="col-span-2 flex justify-end items-center pt-2 pb-1">
          <button
            onClick={() => router.push("/scenarios")}
            aria-label="Explore more scenarios"
            className="text-fadedBlack font-black text-xs uppercase tracking-widest hover:text-fadedBlue transition-colors border-b border-fadedBlack hover:border-fadedBlue pb-0.5"
          >
            All Scenarios →
          </button>
        </div>
      </div>
    </div>
  );
}
