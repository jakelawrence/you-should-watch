"use client";

import React from "react";
import { Heart } from "lucide-react";

export default function Scenarios({ isLoaded }) {
  const scenariosArr = [
    {
      id: "date-night",
      title: "Date Night",
      description: "Find the perfect movie for a romantic evening with your partner.",
      icon: Heart,
      color: "bg-pink-300",
      route: "/scenario/date-night",
    },
    {
      id: "date-night2",
      title: "Date Night",
      description: "Find the perfect movie for a romantic evening with your partner.",
      icon: Heart,
      color: "bg-pink-300",
      route: "/scenario/date-night",
    },
  ];
  return (
    <div
      className={`px-6 pb-10 transition-all duration-700 relative z-1 ${isLoaded ? "opacity-500 translate-y-0" : "opacity-0 translate-y-10"}`}
      style={{ transitionDelay: "400ms" }}
    >
      {/* Mobile Carousel */}
      <div className="block md:hidden">
        <div className="overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          <div className="flex gap-6 pb-4" style={{ width: `${scenariosArr.length * 100}%`, minWidth: `${scenariosArr.length * 280}px` }}>
            {scenariosArr.map((scenario, index) => {
              const Icon = scenario.icon;
              return (
                <div key={scenario.id} className="flex-shrink-0 w-full max-w-xs snap-center">
                  <button
                    onClick={() => router.push(scenario.route)}
                    className={`${scenario.color} border-4 border-black p-8 text-left transition-all duration-300 group w-full`}
                    style={{
                      transitionDelay: `${400 + index * 100}ms`,
                    }}
                  >
                    <Icon className="mb-4 text-black" size={48} strokeWidth={3} />
                    <h3 className="text-3xl font-black uppercase mb-3 text-black">{scenario.title}</h3>
                    <p className="text-lg font-bold text-black">{scenario.description}</p>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        {/* Carousel Indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {scenariosArr.map((_, index) => (
            <div key={index} className="w-2 h-2 bg-gray-400 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid grid-cols-2 gap-6">
        {scenariosArr.map((scenario, index) => {
          const Icon = scenario.icon;
          return (
            <button
              key={scenario.id}
              onClick={() => router.push(scenario.route)}
              className={`${scenario.color} border-4 border-black p-8 lg:p-12 text-left transition-all duration-300 group`}
              style={{
                transitionDelay: `${400 + index * 100}ms`,
              }}
            >
              <Icon className="mb-4 text-black" size={48} strokeWidth={3} />
              <h3 className="text-3xl lg:text-4xl font-black uppercase mb-3 text-black">{scenario.title}</h3>
              <p className="text-lg font-bold text-black">{scenario.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
