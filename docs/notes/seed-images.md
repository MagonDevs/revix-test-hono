# Seed image provider verification

Verified 2026-07-25 from this sandbox (network reachable).

| Provider                     | URL shape from spec §5.2                                    | Result                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placedog.net`               | `https://placedog.net/{w}/{h}?id={lock % 200}`              | Works. `GET` → 200, `image/jpg`. `HEAD` also 200.                                                                                                                               |
| `cataas.com`                 | `https://cataas.com/cat?width={w}&height={h}&seed={lock}`   | `HEAD` → 404 (HEAD unsupported), `GET` → 200, `image/jpeg`. Ingest code must use `GET`, not `HEAD`, for the reachability/retry check.                                           |
| `loremflickr.com`            | `https://loremflickr.com/{w}/{h}/{species}/all?lock={lock}` | Works, but responds with a `302` redirect to the actual image host; `GET` following redirects → 200, `image/jpeg`. Client must follow redirects (default for `fetch`/`undici`). |
| `picsum.photos`              | `https://picsum.photos/seed/adopta-{lock}/{w}/{h}`          | `HEAD` → 405 (Method Not Allowed). `GET` → `302` redirect → 200, `image/jpeg` after following. Same as loremflickr: must follow redirects and must not rely on `HEAD`.          |
| `api.dicebear.com` (avatars) | `https://api.dicebear.com/9.x/notionists/svg?seed=<userId>` | Works. `GET`/`HEAD` → 200, `image/svg+xml`.                                                                                                                                     |

Conclusions baked into `apps/api/src/seed/images/ingest.ts`:

- Always issue a plain `GET` (never `HEAD`) — cataas 404s on HEAD and picsum 405s.
- Let `fetch` follow redirects (its default) — loremflickr and picsum both 302 to the real asset.
- No provider requires a key or signup, matching the spec.
- All four returned raster bytes (`image/jpeg` or `image/jpg`) sharp can decode; dicebear returns SVG, which is stored as a direct URL reference rather than pushed through the raster ingest pipeline (see §5.3 note in `seed/factories/user.factory.ts`).
