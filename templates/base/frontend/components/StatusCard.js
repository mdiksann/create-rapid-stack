export default function StatusCard({ title, value, description }) {
  return (
    <div
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "0.75rem",
        padding: "1.25rem",
      }}
    >
      <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
        {title}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.875rem", color: "#cbd5e1" }}>{description}</div>
    </div>
  );
}

