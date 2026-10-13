import StatusCard from "../components/StatusCard.js";

export default function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return (
    <main
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
      <header style={{ marginBottom: "2.5rem" }}>
        <span
          style={{
            display: "inline-block",
            backgroundColor: "#1d4ed8",
            color: "#eff6ff",
            padding: "0.25rem 0.75rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          create-rapid-stack
        </span>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
          Your Fullstack App is Ready
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", margin: 0 }}>
          Next.js App Router frontend connected to Express &amp; Prisma ORM.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <StatusCard
          title="Frontend"
          value="Next.js"
          description="Running with App Router and standalone build output."
        />
        <StatusCard
          title="Backend API"
          value="Express"
          description={`Configured at ${apiUrl}`}
        />
        <StatusCard
          title="Database ORM"
          value="Prisma"
          description="Schema and seed script pre-configured."
        />
      </section>
    </main>
  );
}

