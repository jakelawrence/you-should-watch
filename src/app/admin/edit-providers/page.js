"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";

export default function EditProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/providers");
      if (!response.ok) throw new Error("Failed to fetch providers");
      const data = await response.json();
      console.log("Fetched providers:", data.providers);
      setProviders(data.providers);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    setFormData({
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      type: provider.type,
      logo_path: provider.logo_path,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    try {
      console.log("Updating provider:", selectedProvider);
      const response = await fetch(`/api/admin/providers/${selectedProvider.provider_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to update provider");
      setMessage({ type: "success", text: `Successfully updated ${formData.provider_name}` });
      await fetchProviders();
      setTimeout(() => {
        setSelectedProvider(null);
        setFormData({});
        setMessage({ type: "", text: "" });
      }, 2000);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-black font-bold text-xl">Loading providers...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 lg:py-16">
      <div className="max-w-5xl mx-auto">
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
            edit providers
          </h1>
          <p className="text-lg font-bold text-black mt-4">Update streaming service provider information</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-4 border-black bg-red-200 p-6 mb-8 flex items-center">
            <X className="mr-3" size={24} strokeWidth={3} />
            <p className="text-black font-black">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          {/* Providers List */}
          <div>
            <h2 className="text-2xl lg:text-3xl font-black text-black uppercase mb-6">Select Provider</h2>
            <div className="space-y-3">
              {providers.map((provider) => (
                <button
                  key={provider.provider_id}
                  onClick={() => handleSelectProvider(provider)}
                  className={`w-full text-left border-4 border-black p-4 font-black uppercase transition-all duration-300 ${
                    selectedProvider?.provider_id === provider.provider_id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {provider.provider_name}
                </button>
              ))}
            </div>
          </div>

          {/* Edit Form */}
          {selectedProvider && (
            <div className="border-4 border-black bg-white p-8">
              <h2 className="text-2xl lg:text-3xl font-black text-black uppercase mb-6">Edit: {selectedProvider.provider_name}</h2>

              {message.text && (
                <div className={`border-4 border-black p-4 mb-6 ${message.type === "success" ? "bg-green-200" : "bg-red-400"}`}>
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

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-black font-black uppercase mb-2">Provider Name</label>
                  <input
                    type="text"
                    name="provider_name"
                    value={formData.provider_name || ""}
                    onChange={handleInputChange}
                    className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  />
                </div>

                {/* <div>
                  <label className="block text-black font-black uppercase mb-2">Provider ID</label>
                  <input
                    type="number"
                    name="provider_id"
                    value={formData.provider_id || ""}
                    onChange={handleInputChange}
                    className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ MozAppearance: "textfield" }}
                  />
                </div> */}

                <div>
                  <label className="block text-black font-black uppercase mb-2">Type</label>
                  <select
                    name="type"
                    value={formData.type || ""}
                    onChange={handleInputChange}
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
                    name="logo_path"
                    value={formData.logo_path || ""}
                    onChange={handleInputChange}
                    className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  />
                  <p className="text-sm font-bold text-gray-600 mt-2">TMDB logo path (starts with /)</p>
                </div>

                {formData.logo_path && (
                  <div className="border-4 border-black p-4">
                    <p className="text-sm font-black uppercase mb-2">Preview:</p>
                    <img
                      src={`https://image.tmdb.org/t/p/original${formData.logo_path}`}
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
                  className="w-full bg-black text-white px-8 py-6 text-xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200"
                  style={{
                    boxShadow: "8px 8px 0px 0px #000000",
                  }}
                >
                  Save Changes
                </button>
                {/* Delete Provider Button */}
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete ${selectedProvider.provider_name}? This action cannot be undone.`)) {
                      try {
                        const response = await fetch(`/api/admin/providers/${selectedProvider.provider_id}`, {
                          method: "DELETE",
                        });
                        if (!response.ok) throw new Error("Failed to delete provider");
                        setMessage({ type: "success", text: `Successfully deleted ${selectedProvider.provider_name}` });
                        setSelectedProvider(null);
                        setFormData({});
                        await fetchProviders();
                      } catch (err) {
                        setMessage({ type: "error", text: err.message });
                      }
                    }
                  }}
                  className="w-full bg-red-600 text-white px-8 py-6 text-xl font-black uppercase border-4 border-black hover:bg-white hover:text-red-600 transition-all duration-200 mt-4"
                  style={{
                    boxShadow: "8px 8px 0px 0px #000000",
                  }}
                >
                  Delete Provider
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
