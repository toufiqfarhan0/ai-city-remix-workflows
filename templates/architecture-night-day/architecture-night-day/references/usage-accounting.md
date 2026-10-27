# SandBase usage and cost accounting

When the user requests model-assisted generation through SandBase, verify the available model identifier and API contract from the operator's current tools or documentation. The sample was originally authored with `minimax/minimax-m3.1-flash`; availability, pricing, and response fields may change. Use environment-provided credentials and never place keys in the project, Skill, prompt, or logs.

For each real API request, retain a private evidence record with the provider request/run identifier, timestamp, model, returned usage fields, outcome, and settled billed amount. Preserve input, output, and cache counters as the provider defines them; do not add a cache counter to total tokens again when it is already included in input. Preserve currency and decimal precision as strings.

Distinguish these states:

| State | Report |
| --- | --- |
| Provider returned usage and settled billing | Exact API tokens and billed cost |
| Usage returned, billing still pending | Exact tokens; cost pending |
| Price-based calculation only | Estimated cost, with date and rate source |
| Failed request with no returned usage or billing evidence | Unknown, not automatically zero |
| Local-only edit/render with no API calls | Zero additional SandBase tokens and API cost |

An aggregate should identify its scope and sum only verified requests in that scope. Report retries and failed billed calls when evidence shows a charge. Keep historical sample totals separate from the new run. Do not derive token counts from code size, video duration, or model output characters. Do not include invisible assistant/Codex conversation usage in a SandBase API total.

Example aggregate structure, using illustrative values rather than a claim of a real call:

```json
{
  "scope": "new run: SandBase API only; excludes local render and assistant conversation",
  "requests": [],
  "inputTokens": 0,
  "outputTokens": 0,
  "totalTokens": 0,
  "settledCost": { "currency": "USD", "amount": "0" },
  "pendingRequests": 0
}
```

Do not redistribute private account consoles or credentials as evidence. A delivered project's sanitized ledger can contain model, aggregate token fields, actual cost, scope, and a clear historical/new-run label.
