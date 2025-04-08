import { useState, useEffect, useRef } from "react";

export default function addedToCollectionAlert() {
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    type: "success", // 'success', 'error', 'warning', 'info'
    isLeaving: false,
  });

  const timeoutRef = useRef(null);

  useEffect(() => {
    if (alert.show && !alert.isLeaving) {
      // Set timer to start fade-out animation
      timeoutRef.current = setTimeout(() => {
        setAlert((prev) => ({ ...prev, isLeaving: true }));

        // Actually remove the alert from DOM after animation completes
        const animationTimeout = setTimeout(() => {
          setAlert((prev) => ({ ...prev, show: false, isLeaving: false }));
        }, 300); // Match this with the CSS transition duration

        return () => clearTimeout(animationTimeout);
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [alert.show, alert.isLeaving]);

  // Function to trigger the alert
  const showCollectionAlert = (message, type = "success") => {
    // If there's already an alert, clear it first
    if (alert.show) {
      setAlert((prev) => ({ ...prev, show: false, isLeaving: false }));
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Small delay before showing new alert
      setTimeout(() => {
        setAlert({ show: true, message, type, isLeaving: false });
      }, 300);
    } else {
      setAlert({ show: true, message, type, isLeaving: false });
    }
  };

  // Component to render the alert
  const CollectionAlert = () => {
    if (!alert.show) return null;

    const alertStyles = {
      success: "bg-green-100 border-t-4 border-green-500 text-green-700",
      error: "bg-red-100 border-t-4 border-red-500 text-red-700",
      warning: "bg-yellow-100 border-t-4 border-yellow-500 text-yellow-700",
      info: "bg-blue-100 border-t-4 border-blue-500 text-blue-700",
    };

    const opacityClass = alert.isLeaving ? "opacity-0" : "opacity-100";
    const transformClass = alert.isLeaving ? "translate-y-6" : "translate-y-0";

    return (
      <div className="fixed bottom-6 left-0 right-0 flex justify-center items-center pointer-events-none z-50">
        <div
          className={`p-4 rounded shadow-lg pointer-events-auto max-w-md transition-all duration-300 ease-in-out ${opacityClass} ${transformClass} ${
            alertStyles[alert.type]
          }`}
        >
          <div className="flex items-center">
            {alert.type === "success" && (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {alert.type === "error" && (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {alert.type === "warning" && (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {alert.type === "info" && (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <p>{alert.message}</p>
          </div>
        </div>
      </div>
    );
  };
  return { showCollectionAlert, CollectionAlert };
}
