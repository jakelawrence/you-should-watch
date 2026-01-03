import { useState, useEffect } from "react";
import { X, HelpCircle } from "lucide-react";

export default function HowToUsePopup() {
  const [showPopup, setShowPopup] = useState(false);

  // Show popup on first visit in session
  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem("hasSeenHowToPopup");
    if (!hasSeenPopup) {
      setShowPopup(true);
      sessionStorage.setItem("hasSeenHowToPopup", "true");
    }
  }, []);

  const closePopup = () => {
    setShowPopup(false);
  };

  const openPopup = () => {
    setShowPopup(true);
  };

  return (
    <>
      {/* Help Button - Top Right */}
      <button onClick={openPopup} className="fixed top-4 right-4 z-50 w-12 h-12 flex items-center justify-center" aria-label="How to use this site">
        <HelpCircle className="text-black" size={24} strokeWidth={2.5} />
      </button>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closePopup} />

          {/* Modal Content */}
          <div className="relative bg-white border-4 border-black p-8 max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={closePopup}
              className="absolute top-0 right-0 bg-red-500 border-b-4 border-l-4 border-black p-2 hover:bg-red-600 transition-colors"
            >
              <X className="text-black" size={24} strokeWidth={3} />
            </button>

            {/* Title */}
            <h2 className="text-2xl font-black text-black uppercase mb-6 pr-8">How It Works</h2>

            {/* Steps */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center flex-shrink-0">
                  <span className="font-black text-black">1</span>
                </div>
                <p className="font-bold text-black pt-1">Add movies you love</p>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center flex-shrink-0">
                  <span className="font-black text-black">2</span>
                </div>
                <p className="font-bold text-black pt-1">Build your collection</p>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center flex-shrink-0">
                  <span className="font-black text-black">3</span>
                </div>
                <p className="font-bold text-black pt-1">Get personalized suggestions</p>
              </div>
            </div>

            {/* Got It Button */}
            <button
              onClick={closePopup}
              className="w-full mt-8 bg-yellow-300 border-4 border-black p-4 font-black text-black uppercase hover:bg-yellow-400 transition-colors"
              style={{
                boxShadow: "4px 4px 0px 0px #000000",
              }}
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
