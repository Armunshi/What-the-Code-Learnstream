import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

// @langchain/community is deprecated upstream (no new integrations accepted,
// limited maintenance — see github.com/langchain-ai/langchainjs-community/
// issue 61) and pulls in a large, mostly-irrelevant peer-dependency surface
// (.npmrc's legacy-peer-deps note). It's used here anyway because its
// PDFLoader is, as of this writing, the only actively-usable PDF text
// extractor in the LangChain JS ecosystem — the successor package
// (@langchain/classic) carries text/json/buffer/directory loaders but no PDF
// one yet. Only this one submodule is imported; nothing else from the
// package's surface is ever loaded.
//
// Import path deliberately scoped to the PDF loader alone
// (@langchain/community/document_loaders/fs/pdf), not the package root —
// pulling in the root would eagerly resolve every other integration's
// (unused) code.

/** Extracts a PDF's full text as one string. `bytes` is the raw file content. */
export async function extractPdfText(bytes) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    // splitPages: false — a transcript PDF has no time alignment either way,
    // so treating it as one block (fed to chunkSegments.js's plain-text path,
    // same as a .txt transcript) is simpler than per-page Documents this
    // pipeline has nowhere to put (no `page` field in collections.js's schema).
    const loader = new PDFLoader(blob, { splitPages: false });
    const [doc] = await loader.load();
    return doc?.pageContent ?? "";
}
