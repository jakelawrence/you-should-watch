// app/admin/add-providers/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, X } from "lucide-react";

export default function AddProvidersPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [type, setType] = useState("flatrate");
  const [logoPath, setLogoPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: parseInt(providerId),
          provider_name: providerName,
          type,
          logo_path: logoPath,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to add provider" });
        setIsSubmitting(false);
        return;
      }

      setMessage({
        type: "success",
        text: `Successfully added provider: ${providerName}`,
      });
      setProviderId("");
      setProviderName("");
      setType("flatrate");
      setLogoPath("");
      setIsSubmitting(false);
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8 lg:py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button onClick={() => router.push("/admin")} className="mb-6 text-black font-bold text-lg hover:underline flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Back to Dashboard
          </button>

          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-black text-black leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            add streaming service
          </h1>
          <p className="text-lg font-bold text-black mt-4">Add new streaming service providers from TMDB</p>
        </div>

        {/* Form */}
        <div
          className={`bg-white border-4 border-black p-8 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {message.text && (
              <div className={`border-4 border-black p-4 ${message.type === "success" ? "bg-green-200" : "bg-red-400"}`}>
                <div className="flex items-center">
                  {message.type === "success" ? (
                    <Check className="mr-2" size={24} strokeWidth={3} />
                  ) : (
                    <X className="mr-2" size={24} strokeWidth={3} />
                  )}
                  <p className="text-black font-black">{message.text}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-black font-black uppercase mb-2">Provider ID</label>
              <input
                type="number"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                required
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ MozAppearance: "textfield" }}
                placeholder="8"
              />
              <p className="text-sm font-bold text-gray-600 mt-2">TMDB provider ID (e.g., 8 for Netflix)</p>
            </div>

            <div>
              <label className="block text-black font-black uppercase mb-2">Provider Name</label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                required
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder="Netflix"
              />
            </div>

            <div>
              <label className="block text-black font-black uppercase mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                <option value="flatrate">Flatrate (Subscription)</option>
                <option value="free">Free (Ad-supported)</option>
                <option value="rent">Rent</option>
                <option value="buy">Buy</option>
              </select>
            </div>

            <div>
              <label className="block text-black font-black uppercase mb-2">Logo Path</label>
              <input
                type="text"
                value={logoPath}
                onChange={(e) => setLogoPath(e.target.value)}
                required
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder="/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg"
              />
              <p className="text-sm font-bold text-gray-600 mt-2">TMDB logo path (starts with /)</p>
            </div>

            {logoPath && (
              <div className="border-4 border-black p-4">
                <p className="text-sm font-black uppercase mb-2">Preview:</p>
                <img
                  src={`https://image.tmdb.org/t/p/original${logoPath}`}
                  alt="Provider logo"
                  className="h-16 border-2 border-black"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black text-white px-8 py-6 text-xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50"
              style={{
                boxShadow: "8px 8px 0px 0px #000000",
              }}
            >
              {isSubmitting ? (
                "Adding Provider..."
              ) : (
                <>
                  <Plus className="inline mr-2" size={24} strokeWidth={3} />
                  Add Provider
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
