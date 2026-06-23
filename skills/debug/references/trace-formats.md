# Supported Stack Trace Formats

`debug` parses two trace formats when given `--trace` or when `--repro`
output contains a trace.

## JavaScript / TypeScript (V8 style)

```
TypeError: Cannot read property 'id' of undefined
    at getUser (src/user.ts:42:18)
    at handleRequest (src/routes/login.ts:12:5)
```

Matched via: `at\s+(?:.*\()?([^\s():]+\.(?:ts|js|tsx|jsx)):(\d+):\d+\)?`

## Python

```
Traceback (most recent call last):
  File "src/auth.py", line 88, in login
    user = get_user(token)
```

Matched via: `File "([^"]+\.py)", line (\d+)`

## Formats Not Currently Supported

- Minified/sourcemapped JS without sourcemap resolution (frames will point
  at the bundled file, not original source).
- Java/JVM stack traces.
- Rust panics.

If a trace format isn't recognized, `debug` falls back to static grep
search using identifiers extracted from `--symptom`, reported at
`confidence: "low"`.
