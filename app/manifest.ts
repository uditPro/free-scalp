import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "ReachFlow", short_name: "ReachFlow", description: "Discover jobs, prospective clients, and research across supported public sources.", start_url: "/", display: "standalone", background_color: "#faf9f6", theme_color: "#245d47", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
