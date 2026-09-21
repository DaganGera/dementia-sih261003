$ErrorActionPreference = 'Stop'
# Builds the hero media from the original clip: reversed, silent, with scrub frames, idle loops and posters.
# Needs ffmpeg on PATH. The reverse filter buffers the whole clip in memory (about 1 GB at this size).
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$src = Join-Path $root 'assets-src\hero\original.mp4'
$mst = Join-Path $root 'assets-src\hero\reversed-master.mp4'
$out = Join-Path $root 'apps\landing\public\media\hero'
if (-not (Test-Path $src)) { throw "Missing $src. Download the clip first (see docs/landing-media.md)." }
Remove-Item -Recurse -Force $out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$out\d", "$out\m" | Out-Null

function Run($argList) { & ffmpeg -hide_banner -loglevel error -y @argList; if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed: $argList" } }

# Reverse, strip audio, constant 24 fps.
Run @('-i', $src, '-an', '-vf', 'reverse,fps=24', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', $mst)
# Idle loop clips for the fade-in and fade-out logic: desktop full frame and a mobile portrait crop.
Run @('-i', $mst, '-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', "$out\idle-1280.mp4")
Run @('-i', $mst, '-vf', 'crop=804:1072:562:0,scale=600:800:flags=lanczos', '-c:v', 'libx264', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', "$out\idle-600x800.mp4")
# Scrub frames: desktop 12 fps at 1440 px wide, mobile 12 fps portrait crop at 600x800. The renderer blends neighbouring frames.
Run @('-i', $mst, '-vf', 'fps=12,scale=1440:-2:flags=lanczos', '-c:v', 'libwebp', '-quality', '58', '-compression_level', '6', "$out\d\%04d.webp")
Run @('-i', $mst, '-vf', 'fps=12,crop=804:1072:562:0,scale=600:800:flags=lanczos', '-c:v', 'libwebp', '-quality', '62', '-compression_level', '6', "$out\m\%04d.webp")
# Posters: the first frame of the reversed clip, identical to where the idle clip starts.
Run @('-i', $mst, '-vf', 'select=eq(n\,0),scale=1600:-2', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', "$out\poster-1600.webp")
Run @('-i', $mst, '-vf', 'select=eq(n\,0),crop=804:1072:562:0,scale=600:800', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', "$out\poster-600x800.webp")
node (Join-Path $PSScriptRoot 'hero-manifest.mjs') $out
