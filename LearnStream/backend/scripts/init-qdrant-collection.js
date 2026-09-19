// Creates (or brings up to date) the Qdrant collection the lecture-transcript
// RAG chat assistant reads from — see src/services/rag/collections.js for
// the schema and src/services/rag/ensureCollection.js for what this actually
// runs. Safe to re-run: creating an already-existing collection or index is
// a no-op, not an error.
//
// Usage:
//   docker compose up -d       # start the local Qdrant container first
//   npm run qdrant:init        # or: node scripts/init-qdrant-collection.js

import dotenv from "dotenv";
dotenv.config();

import { ensureTranscriptChunksCollection } from "../src/services/rag/ensureCollection.js";
import { env } from "../src/config/env.js";

async function main() {
    console.log(`Connecting to Qdrant at ${env.qdrant.url} ...`);
    const { created, collection } = await ensureTranscriptChunksCollection();
    console.log(
        created
            ? `Created collection "${collection}" (vector size ${env.qdrant.embeddingDim}, cosine distance).`
            : `Collection "${collection}" already existed — indexes verified.`
    );
}

main().catch((error) => {
    console.error("Failed to set up the Qdrant collection:");
    console.error(error?.data?.status?.error ?? error?.message ?? error);
    process.exit(1);
});
