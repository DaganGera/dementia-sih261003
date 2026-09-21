# Landing media

`assets-src/hero/original.mp4` (gitignored) is the clip from the hero spec, downloaded from the URL in the plan's Appendix A. SHA-256 of the download: `5924422DD3036C05828F2B890A07B2BA7A3D7FBCA9C961A059B55AD9D1489DB0`, 30,377,184 bytes.

Rights: the clip's source and licence are not confirmed (plan H-07, RISK-09). Do not present it as original footage, and do not use it in the SIH demo video until this is settled. Replace the files under `apps/landing/public/media/hero` to change it.

Rebuild from the original:

```powershell
powershell -NoProfile -File tools\media\build-hero.ps1
```

Measured on 2026-09-21 (ffmpeg 2025-07-17):

| Item | Value |
|---|---|
| Desktop scrub frames | 169 WebP files at 1440 px, 12 fps, 10.96 MB total |
| Mobile scrub frames | 169 WebP files at 600x800, 12 fps, 3.26 MB total |
| Mobile critical path (poster plus idle loop) | 360,811 bytes |
| Desktop poster and idle loop | 87,428 and 1,290,001 bytes |
| Landing JavaScript | 277 KB, 89 KB gzip |

Technique chosen: canvas image sequence with neighbour blending. Seeking `video.currentTime` was not used because it is unreliable on mobile browsers; the all-intra video and WebCodecs candidates were not measured, so the comparison in the plan (spike S-LAND) is not done. Frames stream after the page is idle, three at a time, coarse to fine, and stop for Save-Data. The reversed 24 fps clip is sampled at 12 fps for scrubbing.

Fallbacks to the static poster with light CSS parallax: reduced motion, Save-Data, effective connection 2g or 3g, device memory of 2 GB or less, the visitor's pause choice, and no JavaScript.

App screenshots in `public/media/app` come from `apps/app/scripts/capture-landing.mjs`, run against the built app. They show a test family created by the script.
