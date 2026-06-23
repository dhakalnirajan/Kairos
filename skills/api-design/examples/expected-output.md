{
  "checked": 3,
  "findings": [
    {
      "endpoint": "POST /user -> 200",
      "severity": "warning",
      "issue": "Path segment \"user\" looks singular; REST convention favors plural collection names (e.g. \"users\" not \"user\")."
    },
    {
      "endpoint": "POST /user -> 200",
      "severity": "warning",
      "issue": "POST typically returns 201; got 200. Confirm this is intentional."
    },
    {
      "endpoint": "DELETE /users/{id} -> 200",
      "severity": "warning",
      "issue": "DELETE typically returns 204; got 200. Confirm this is intentional."
    }
  ]
}
