# Diagram Syntax and Capacity Formulas

## Component Diagram Input

```
--node "API:service" --node "DB:database" --edge "API->DB:reads/writes"
```

`--node` format: `Name` or `Name:type` (type rendered as italic subtext).
`--edge` format: `From->To` or `From->To:label`. Every name referenced in
an `--edge` must have been declared via a prior `--node`, or generation
fails with an explicit error rather than rendering a dangling arrow.

## Sequence Diagram Input

```
--actor Client --actor API --actor DB --message "Client->API: POST /upload" --message "API->DB: INSERT row"
```

`--message` format: `From->To: label` (the colon and space before label
are required). Message order in the diagram matches `--message` argument
order exactly — this is how sequence is conveyed, since Mermaid sequence
diagrams render messages top-to-bottom in declaration order.

## Capacity Formulas Used

| Metric | Formula |
|---|---|
| Requests/day | `QPS × 86,400` |
| New data/day (MB) | `QPS × 86,400 × avg_item_size_KB / 1024` |
| New data/year (GB) | `new_data_per_day_MB × 365 / 1024` |
| Peak bandwidth (Mbps) | `QPS × avg_item_size_KB × 8 / 1024` |

These are standard order-of-magnitude back-of-envelope formulas used in
system design interviews and early-stage capacity planning. They assume
peak load ≈ average load (a simplification — real peak/average ratios are
often 2-10x depending on traffic pattern) and do not account for
replication factor, compression, or index overhead on storage. Treat
worksheet output as a starting sanity check, not a sizing specification.

## Why Unfilled Values Stay as Placeholders

If `--qps` or `--avg-item-size-kb` aren't provided, every formula that
depends on them renders as `_(estimate)_` with the formula shown in
parentheses, rather than being silently omitted or filled with a guessed
number. The point is to make clear exactly what input is still needed to
turn the worksheet into real numbers.
