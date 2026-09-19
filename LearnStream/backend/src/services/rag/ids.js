import { createHash } from "node:crypto";

// Qdrant point IDs must be an unsigned integer or a valid UUID — an
// arbitrary string like "<lectureId>:<chunkIndex>" is rejected outright, so
// chunk identity has to be derived into UUID shape rather than used as-is.
// UUIDv5 (RFC 4122, name-based/SHA-1) is exactly "turn a name into a stable
// UUID": the same lectureId + chunkIndex always produces the same point id,
// which is what lets re-ingesting a lecture overwrite its old points instead
// of accumulating duplicates on every edit.
//
// This namespace is our own, generated once (`crypto.randomUUID()`) and
// fixed forever after — changing it would silently orphan every point
// already written, since every derived id would shift.
const NAMESPACE = "859792cf-4960-41d4-9688-30f4dfde27e1";

function uuidv5(name, namespace = NAMESPACE) {
    const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
    const hash = createHash("sha1").update(namespaceBytes).update(name, "utf8").digest();
    const bytes = hash.subarray(0, 16);

    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function chunkPointId(lectureId, chunkIndex) {
    return uuidv5(`${lectureId}:${chunkIndex}`);
}
