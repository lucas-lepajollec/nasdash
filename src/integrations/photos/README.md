# Photo statistics adapters

`PHOTO_STATS_TYPES` is separate from `PHOTO_TYPES`: Piwigo and LibrePhotos
provide figures here, not image browsing. `/api/widgets/photos/stats` resolves
only a visible `photos-stats` widget (or an administrator draft), caches per
connection identity for ten minutes and removes account names unless
`showUsers` is explicitly true, including for administrators. Responses use
only contract fields, never upstream paths, endpoints, tokens or user IDs.

## Upstream references and limits

- [Immich OpenAPI](https://github.com/immich-app/immich/blob/main/open-api/immich-openapi-specs.json):
  server statistics require administrative access; 401/403/404 falls back to
  asset statistics. Storage, owned/shared albums, people, time buckets and
  recent metadata are optional. Buckets use `timeBucket` and `count` and are
  summed into at most twenty years. The older `size=MONTH` query retries
  without `size` on HTTP 400 for current minimal-bucket endpoints. Daily additions cover today plus the
  previous 29 UTC dates; at most five pages of 1,000 results are counted, so
  very busy libraries can be undercounted. Totals and account usage can cover
  the whole server while album/timeline/search data is scoped to the key's
  account. Fine-grained API keys need the corresponding endpoint permissions.
- [PhotoPrism config types](https://pkg.go.dev/github.com/photoprism/photoprism/internal/config#ClientCounts):
  read `count` from config only. Standard `years` is a list of years, without
  counts, so no histogram is fabricated. A counted year list is accepted if
  provided. Folder and face counts have no field in `PhotoStatsResponse`;
  faces are not interchangeable with people.
- [Piwigo web-service source](https://github.com/Piwigo/Piwigo/blob/master/include/ws_functions/pwg.php):
  form login and a `pwg_id` cookie, then `pwg.getInfos`'s `result.infos`
  name/value entries. `nb_elements` is a media total without a video split;
  `nb_categories` counts albums. Core getInfos does not return library size:
  historical `cache_size = 4242` is deliberately ignored. An explicit
  `library_size_bytes` extension is accepted when present. Other disk keys
  and their units are unverified and are not guessed. API-key authentication
  is not offered; this adapter uses the verified session login.
- [LibrePhotos URL configuration](https://github.com/LibrePhotos/librephotos/blob/dev/librephotos/urls.py):
  confirms token obtain/refresh, stats and photo-month-count endpoints.
  The implementation of StatsView/PhotoMonthCountsView could not be retrieved
  during this change. The supplied `num_photos`, `num_videos`, `num_people`
  and three `num_album*` counters remain version-sensitive assumptions.
  Month rows are currently expected as `{month: "YYYY-MM-DD", count: number}`
  (a list, or a `results` list); this shape still needs validation against a
  running version or the upstream view source. An unavailable month endpoint
  is omitted. Missing-photo, face and other diagnostic counts have no contract
  field. JWTs are cached, refreshed once on rejection and reacquired when the
  refresh token expires. All credential exchanges reject redirects.

Samples contain fictional values; they are contract fixtures, not live captures.
Demo responses populate every contract field for every supported provider and
never enter any collector or session code.
