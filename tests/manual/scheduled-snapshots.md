# Scheduled snapshot acceptance

Run on an authorized test desktop before exhibition deployment. Keep the old cache
and package for rollback. Do not modify the running exhibition for this test.

1. Seed all 13 queries; record per-query loaded/failed image counts, document height,
   capture time and acceptance/rejection. Use each query's rectangle and scroll from queries.js; require document and loaded-image
   coverage through scroll distance plus actual viewport height, with no pending thumbnails.
   Reject embedded MHTML CAPTCHA parts, including encoded HTML and frame src/srcdoc.
2. Disconnect networking. Open each accepted MHTML at the actual window dimensions;
   scroll that query's specified distance and record screenshots at start, middle and end. No grey result
   placeholders, CAPTCHA, blank document or network-dependent thumbnails may appear.
3. Inject a gated page and a partially loaded page during collection. Neither may
   replace an accepted snapshot. Repeat with a gate appearing during capture.
4. Let one scheduled pass finish and one fail; verify every query is attempted,
   no concurrent pass, and previous snapshots remain usable.
5. Refresh a currently displayed query. The current scroll must continue unchanged;
   the next appearance must use the new snapshot.
6. Start without a cache: no live Google navigation; record the waiting state and
   verify the next appearance uses the first accepted snapshot.
7. Play a full 780-second cycle with audio and both portrait displays; record window
   order, scroll continuity, CPU/memory and dropped frames against the existing baseline.
   Run an extended soak before stable release. Stop updater when player stops.

Portable tests cannot establish these visual/performance properties. Results pending.

## NopeCHA settings acceptance (pending)

1. Open Transplayer settings on the test desktop; verify controls remain accessible
   by scrolling. Toggle starts off. Enter a test key locally, save, reopen: no key
   value is displayed. Blank save preserves the key; clear disables and empties it.
2. Inspect only file permissions and key-presence booleans, never print the real key.
   Confirm key is absent from ordinary config, command arguments, URLs and logs.
3. Use an authorized key only after the user accepts any credit use. Enable and run
   one seed pass; verify extension loads in the seed browser and receives settings (and live browsers
   when live mode is selected). A persistent gate must reject within the 90-second grace.
   Disable, wait until the next pass and verify it does not load. Test without a key.
4. Stop normally and verify private extension copy is removed. Capture error/gate
   pages must still be rejected, irrespective of solver outcome. Do not capture keys
   in screenshots or evidence. This protocol has not been executed on the real desktop.

## Independent switch matrix (pending)

Test all four combinations. Saving either switch must preserve the other, including
API key presence. Restart playback after changing mode/live solver. In every combination
verify background refresh continues. In live mode, test clean search, blocked navigation,
network failure, incomplete thumbnails and a gate arriving after scrolling ends. Each
failure must select validated fallback, or blank when absent. Check stale checks cannot
replace a newer navigation. In snapshot-only mode, no live search navigation occurs.
Confirm stop removes the updater, idle monitor and any live solver copy.
