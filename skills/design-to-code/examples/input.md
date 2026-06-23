{
  "name": "Card",
  "props": { "title": "string", "count": 4 },
  "children": [
    { "name": "h2", "children": ["{{ title }}"] },
    { "name": "p", "children": ["Count: {{ count }}"] }
  ]
}
