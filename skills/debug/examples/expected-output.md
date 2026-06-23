{
  "reproduced": true,
  "confidence": "high",
  "rootCause": "Failure traced to src/user.ts:42. See evidence for surrounding code.",
  "evidence": [
    "src/user.ts:42\n39   export function getUser(id) {\n40     const record = db.find(id);\n41     return {\n42 >     name: record.name,\n43     id: record.id,\n44   };\n45 }"
  ],
  "suggestedNextSkill": "code-generation or refactoring, scoped to the evidence above"
}
