{
  "envVars": {
    "referenced": ["DATABASE_URL", "JWT_SECRET", "PORT"],
    "undocumented": ["JWT_SECRET"]
  },
  "buildScript": true,
  "docker": {
    "present": true,
    "issues": [
      "No USER directive found — container likely runs as root by default."
    ]
  },
  "checklist": [
    "Run the build locally and confirm it succeeds (this skill does not execute builds).",
    "Run smoke tests against a staging environment before production deploy.",
    "Confirm a rollback plan exists and has been tested.",
    "Confirm secrets are provisioned in the target environment (this skill only checks .env.example documentation, not actual secret values)."
  ]
}
