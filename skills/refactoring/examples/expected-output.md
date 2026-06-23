--- src/upload.ts
+++ src/upload.ts (refactored)
 // existing code above
+function validateUploadPayload() {
+  if (!payload.name) throw new Error("missing name");
+  if (!payload.size) throw new Error("missing size");
+}
+
-  if (!payload.name) throw new Error("missing name");
-  if (!payload.size) throw new Error("missing size");
+  validateUploadPayload();
 // existing code below

{
  "op": "extract-function",
  "file": "src/upload.ts",
  "linesChanged": 4
}
