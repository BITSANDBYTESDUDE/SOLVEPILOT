import type { MetadataRoute } from "next";

import { getAppBaseUrl } from "@/lib/config/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Workspace routes and share links must never be indexed.
        disallow: ["/dashboard", "/api", "/share", "/login", "/register"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
