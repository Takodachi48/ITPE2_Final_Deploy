import { useState } from "react";

export default function ImageViewer({ src, alt = "Submission image" }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => {
    setScale(1);
    setRotation(0);
  };
  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  if (!src) {
    return <div style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>No image available.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 12, padding: "4px 8px" }} onClick={zoomIn}>
          Zoom In (+)
        </button>
        <button type="button" className="btn" style={{ fontSize: 12, padding: "4px 8px" }} onClick={zoomOut}>
          Zoom Out (-)
        </button>
        <button type="button" className="btn" style={{ fontSize: 12, padding: "4px 8px" }} onClick={rotateRight}>
          Rotate (90°)
        </button>
        <button type="button" className="btn" style={{ fontSize: 12, padding: "4px 8px" }} onClick={resetZoom}>
          Reset
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{ fontSize: 12, padding: "4px 8px", textDecoration: "none", color: "inherit" }}
        >
          Open Full Size ↗
        </a>
      </div>

      {/* Image container */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#1f2937",
          padding: 16,
          overflow: "auto",
          maxHeight: 520,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.15s ease",
            maxWidth: "100%",
            maxHeight: 480,
            objectFit: "contain",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </div>
  );
}

