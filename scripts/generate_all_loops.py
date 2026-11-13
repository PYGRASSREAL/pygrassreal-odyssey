"""
generate_all_loops.py
Generates seamless animated WebP loops for clips 6, 7, 8, 9, 10
so that:
  Stage 1: Clip 1 (Scroll) -> Clip 6 (Loop)
  Stage 2: Clip 2 (Scroll) -> Clip 7 (Loop)
  Stage 3: Clip 3 (Scroll) -> Clip 8 (Loop)
  Stage 4: Clip 4 (Scroll) -> Clip 9 (Loop)
  Stage 5: Clip 5 (Scroll) -> Clip 10 (Loop)
"""

import os
import time
import av
from PIL import Image
from concurrent.futures import ProcessPoolExecutor

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(PROJECT_ROOT, "assets", "raw_videos")
LOOP_DIR = os.path.join(PROJECT_ROOT, "assets", "loops")

def make_single_loop(clip_num):
    t0 = time.time()
    prefix = f"{clip_num:02d}_"
    matches = [f for f in os.listdir(RAW_DIR) if f.startswith(prefix) and f.endswith(".mp4")]
    if not matches:
        return f"Clip {clip_num}: not found"

    v_path = os.path.join(RAW_DIR, matches[0])
    out_path = os.path.join(LOOP_DIR, f"loop_clip_{clip_num:02d}.webp")

    c = av.open(v_path)
    s = c.streams.video[0]
    orig_fps = float(s.average_rate) if s.average_rate else 24.0
    fps = 16
    step = max(1, round(orig_fps / fps))

    frames = []
    idx = 0
    for packet in c.demux(s):
        for frame in packet.decode():
            if idx % step == 0:
                img = frame.to_image().resize((1280, 720), Image.Resampling.LANCZOS)
                frames.append(img)
                if len(frames) >= 64:
                    break
            idx += 1
        if len(frames) >= 64:
            break

    if frames:
        dur = int(1000 / fps)
        frames[0].save(
            out_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=dur,
            loop=0,
            quality=68,
            method=3
        )
        sz_mb = os.path.getsize(out_path) / (1024 * 1024)
        return f"Clip {clip_num:02d} loop created: {sz_mb:.2f} MB in {time.time() - t0:.1f}s"
    return f"Clip {clip_num:02d}: failed"

if __name__ == "__main__":
    os.makedirs(LOOP_DIR, exist_ok=True)
    print("Generating loops for clips 6, 7, 8, 9, 10 in parallel...")
    with ProcessPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(make_single_loop, [6, 7, 8, 9, 10]))
    for r in results:
        print(" ", r)
    print("All loops generated successfully!")
