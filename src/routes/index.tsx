import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Synthetic Nature" },
      { name: "description", content: "An odyssey through delicate living forms, revealed by lens and curiosity." },
      { property: "og:title", content: "Synthetic Nature" },
      { property: "og:description", content: "An odyssey through delicate living forms, revealed by lens and curiosity." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Hero />;
}
