import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liga de Golf",
    short_name: "Liga Golf",
    description: "Resultados y clasificaciones de nuestra liga de golf entre amigos",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#1f6f4a",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
    ],
  };
}
