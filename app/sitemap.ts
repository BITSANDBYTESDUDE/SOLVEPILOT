import type { MetadataRoute } from "next";

import { getAppBaseUrl } from "@/lib/config/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppBaseUrl();
  const lastModified = new Date();

  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/register`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
