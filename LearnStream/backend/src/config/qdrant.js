import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env.js";

// Client construction only, same split as config/cloudinary.js — what we do
// with it (create collections, upsert chunks, search) lives in
// services/rag/*, not here.
export const qdrant = new QdrantClient({
    url: env.qdrant.url,
    // The client treats "" as "no key" correctly, but being explicit here
    // avoids ever sending an empty Api-Key header to a real deployment.
    apiKey: env.qdrant.apiKey || undefined,
});
