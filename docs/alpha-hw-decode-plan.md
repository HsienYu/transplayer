# Hardware-decode plan for the alpha video (packed opaque + WebGL recomposite)

Status: design + core module + demo ready; NOT wired into the production player; NOT
activated. Requires one operator sudo step and the artist's visual acceptance. See also
[performance analysis](performance.md).

## Why this shape

The artwork needs a transparent layer so the browser choreography shows behind the video,
so the alpha channel must be preserved (confirmed by the artist, 2026-11-04). But Chromium
156 (Electron 45.1.0) refuses the hardware decode path for any video with alpha unless the
codec is HEVC, and HEVC-with-alpha is not a viable Linux/NVDEC path. The robust route is:

1. Repack the VP9+alpha clip into an OPAQUE video that stacks colour over alpha
   (`vstack`: top half = colour, bottom half = alpha as luma), size W x 2H. Opaque clips
   are eligible for hardware decode.
2. Let Chromium hardware-decode that opaque clip via VA-API -> NVDEC (needs the NVIDIA
   VA-API bridge, which is NOT installed yet).
3. Rebuild the transparency in the app with a WebGL shader that samples the colour half and
   the alpha half and outputs premultiplied RGBA, so the transparent regions still show the
   browser behind -- identical effect to the native-alpha `<video>`.

## Done (this branch)

- `app/alpha-recomposite.js`: pure layout maths + reference pixel recompositor (unit-tested)
  and a WebGL recompositor (`createRecompositor({video, canvas, layout:"vstack-alpha"})`).
  It keeps the `<video>` element as the playback/OSC/quality source; only the on-screen
  presentation moves from `<video>` to a `<canvas>`, so the timecode choreography and the
  dropped-frame reporting are unchanged.
- `tests/alpha-recomposite.test.js`: layout split, odd/garbage dimension rejection, unknown
  layout rejection, a 4-pixel packed frame -> expected RGBA, buffer-size guard, WebGL-absent
  guard. Full suite green on 2026-11-04 (134 Node tests).
- `experiments/gpu-playback/recomposite-demo.html` + `.js`: standalone demo. Also staged on
  the formal host at `~/.cache/transplayer-builds/r10-alpha-pack-20261104T0520Z/` with a real
  8-second packed sample (`packed-sample.mp4`, h264 2160x3840). Open that HTML in a browser on
  the host (RustDesk) to SEE the real content recomposited over a background -- this verifies
  the repack+shader faithfully rebuild transparency, independent of hardware decode.
- `make-alpha-pack.sh` (staged on host): produces the full opaque packed master from the
  original (original never modified).
- `enable-hw-decode.sh` (staged on host): the operator sudo step (installs
  `nvidia-vaapi-driver` + `vainfo`, verifies decode profiles, prints the launch flags).

## Remaining wiring (a production feature -- do via TDD + the Section 7 visual protocol)

1. Config flag `videoLayout: "native-alpha" | "vstack-alpha"` (default `native-alpha`),
   written by `core.configure` and passed to the renderer by `main.js` in the
   `playback-config` IPC alongside `videoURL`/`startSeconds`.
2. `check_media` (runtime.py): accept the packed master's dimensions when
   `videoLayout=vstack-alpha` (content = width x height/2; expect 2160 x (2*1920)=3840),
   instead of the native 2160x1920 rule.
3. `app/index.html` + `app/index.js`: when `videoLayout=vstack-alpha`, hide `<video>`, add a
   `<canvas>`, and drive it with `createRecompositor`; keep the native path as default.
4. Launcher (`main.js` / `packaging/pm2-launch.sh`): apply the VA-API env + flags from
   `enable-hw-decode.sh` ONLY when `videoLayout=vstack-alpha`; never change the running
   native-alpha launch.

## Activation (operator + artist, when ready)

1. `sudo bash enable-hw-decode.sh` on the host; confirm `vainfo` lists VP9/H264 decode.
2. Produce the full packed master with `make-alpha-pack.sh` on a strong machine (not the
   2-core Celeron while the live player runs).
3. Build the wiring above on this branch, with tests; keep the original native path intact.
4. Point the packed-alpha config at the packed master, set `videoLayout=vstack-alpha`,
   start the player, and have the ARTIST confirm: transparency correct, browser shows
   behind, click-through, colours and edges match the original, audio in sync, 775s start
   and loop. Watch `nvidia-smi dmon -s u` -- the decoder column must rise above 0.
5. Only after visual acceptance + the normal release gates (soak, lifecycle, lintian,
   vulnerability, license) may this be promoted. Keep the native-alpha rc2 as rollback.
