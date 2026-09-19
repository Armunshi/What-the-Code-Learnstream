import { InferenceClient } from "@huggingface/inference";
import { env } from "./env.js";

// Client construction only, same split as config/cloudinary.js and
// config/qdrant.js — what we do with it (embedding transcript chunks and
// questions) lives in services/rag/embed.js, not here.
export const hf = new InferenceClient(env.huggingFace.apiToken || undefined);
