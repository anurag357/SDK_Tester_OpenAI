"use client";
import { useState } from "react";

export default function Home() {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);

  // 👉 New state for zoom modal
  const [zoomedImg, setZoomedImg] = useState(null);

  async function runAutomation() {
    setLoading(true);
    const res = await fetch("/api/automate");
    const data = await res.json();
    setLogs(data);
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
          {/* ✅ Dummy Data */}
          <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              📝 Dummy User Data
            </h2>
            <ul className="list-disc ml-6 space-y-1 text-gray-700">
              <li><strong>First Name:</strong> {logs.dummyData?.firstName}</li>
              <li><strong>Last Name:</strong> {logs.dummyData?.lastName}</li>
              <li><strong>Email:</strong> {logs.dummyData?.email}</li>
              <li><strong>Password:</strong> {logs.dummyData?.password}</li>
              <li><strong>Confirm Password:</strong> {logs.dummyData?.confirmPassword}</li>
            </ul>
          </div>

          {/* ✅ Automation Result */}
          <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              📊 Automation Result
            </h2>
            <p className="whitespace-pre-line text-gray-700 leading-relaxed">
              {logs.finalOutput}
            </p>
          </div>

          {/* ✅ Screenshots */}
          <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              📸 Screenshots
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {logs.history
                ?.filter((h) => h.name === "take_screenshot" && h.output?.text)
                .map((h, i) => {
                  let url;
                  try {
                    url = JSON.parse(h.output.text).url;
                  } catch {
                    url = null;
                  }
                  return (
                    url && (
                      <div
                        key={i}
                        className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setZoomedImg(url)} // 👉 open zoom modal
                      >
                        <img
                          src={url}
                          alt={`screenshot-${i}`}
                          className="w-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="p-2 text-sm text-center bg-gray-50 text-gray-600">
                          Step {i + 1}
                        </div>
                      </div>
                    )
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Zoom Modal */}
      {zoomedImg && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setZoomedImg(null)}
        >
          <img
            src={zoomedImg}
            alt="Zoomed screenshot"
            className="max-w-5xl max-h-[90%] rounded-lg shadow-lg"
          />
        </div>
      )}
    </main>
  );
}
