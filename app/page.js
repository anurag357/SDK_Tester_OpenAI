"use client";
import { useState } from "react";

export default function Home() {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoomedImg, setZoomedImg] = useState(null);

  async function runAutomation() {
    setLoading(true);
    setLogs(null);
    try {
      const res = await fetch("/api/automate");
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Error running automation:", error);
      setLogs({ 
        success: false, 
        error: "Failed to run automation" 
      });
    }
    setLoading(false);
  }

  return (
    <main className="p-10 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold mb-6 text-gray-800 tracking-tight">
        🚀 Automation Demo
      </h1>

      <button
        onClick={runAutomation}
        className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-3 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        disabled={loading}
      >
        {loading ? "⚙️ Running..." : "▶️ Run Signup Automation"}
      </button>

      {logs && (
        <div className="mt-10 space-y-8">
          {/* Error Message */}
          {!logs.success && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <h2 className="font-bold">❌ Error</h2>
              <p>{logs.error}</p>
            </div>
          )}

          {/* Dummy Data */}
          {logs.dummyData && (
            <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
              <h2 className="text-xl font-semibold mb-3 text-gray-800">
                📝 Dummy User Data
              </h2>
              <ul className="list-disc ml-6 space-y-1 text-gray-700">
                <li><strong>First Name:</strong> {logs.dummyData.firstName}</li>
                <li><strong>Last Name:</strong> {logs.dummyData.lastName}</li>
                <li><strong>Email:</strong> {logs.dummyData.email}</li>
                <li><strong>Password:</strong> {logs.dummyData.password}</li>
                <li><strong>Confirm Password:</strong> {logs.dummyData.confirmPassword}</li>
              </ul>
            </div>
          )}

          {/* Automation Result */}
          {logs.finalOutput && (
            <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
              <h2 className="text-xl font-semibold mb-3 text-gray-800">
                📊 Automation Result
              </h2>
              <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                {logs.finalOutput}
              </p>
            </div>
          )}

          {/* Screenshots */}
          {logs.screenshots && logs.screenshots.length > 0 && (
            <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                📸 Screenshots ({logs.screenshots.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {logs.screenshots.map((screenshot, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setZoomedImg(screenshot.data)}
                  >
                    <img
                      src={screenshot.data}
                      alt={`screenshot-${index}`}
                      className="w-full h-48 object-contain bg-gray-100 hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-3 text-sm bg-gray-50 text-gray-600 border-t border-gray-200">
                      <div className="font-medium">{screenshot.step}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {screenshot.filename}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Info */}
          {logs.environment && (
            <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-600">
              <strong>Environment:</strong> {logs.environment}
            </div>
          )}
        </div>
      )}

      {/* Zoom Modal */}
      {zoomedImg && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomedImg(null)}
        >
          <div className="relative max-w-6xl max-h-full">
            <button
              className="absolute top-4 right-4 bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center z-10"
              onClick={() => setZoomedImg(null)}
            >
              ✕
            </button>
            <img
              src={zoomedImg}
              alt="Zoomed screenshot"
              className="max-w-full max-h-full rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
            <span className="text-gray-700">Running automation...</span>
          </div>
        </div>
      )}
    </main>
  );
}