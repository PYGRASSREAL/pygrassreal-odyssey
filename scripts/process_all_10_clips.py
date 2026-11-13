"""
process_all_10_clips.py
Batch converts all 10 clips to 720p WebP (1280x720) in parallel using 10 processes.
Also generates seamless animated WebP loops in assets/loops/.
"""

import os
import sys
import time
import json
import av
from PIL import Image
from concurrent.futures import ProcessPoolExecutor

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(PROJECT_ROOT, "assets", "raw_videos")
SCROLL_DIR = os.path.join(PROJECT_ROOT, "assets", "scroll_webp")
LOOP_DIR = os.path.join(PROJECT_ROOT, "assets", "loops")

def process_single_clip(clip_num):
    t0 = time.time()
    # Find the video file
    prefix = f"{clip_num:02d}_"
    matches = [f for f in os.listdir(RAW_DIR) if f.startswith(prefix) and f.endswith(".mp4")]
    if not matches:
        return f"Clip {clip_num}: File not found"
    
    video_path = os.path.join(RAW_DIR, matches[0])
    out_dir = os.path.join(SCROLL_DIR, f"clip_{clip_num:02d}")
    os.makedirs(out_dir, exist_ok=True)
    
    container = av.open(video_path)
    stream = container.streams.video[0]
    orig_fps = float(stream.average_rate) if stream.average_rate else 24.0
    
    count = 0
    total_size = 0
    
    for packet in container.demux(stream):
        for frame in packet.decode():
            img = frame.to_image().resize((1280, 720), Image.Resampling.LANCZOS)
            out_file = os.path.join(out_dir, f"frame_{count:04d}.webp")
            img.save(out_file, format="WEBP", quality=75, method=3)
            total_size += os.path.getsize(out_file)
            count += 1
            
    manifest = {
        "clip_id": clip_num,
        "clip_name": matches[0],
        "total_frames": count,
        "width": 1280,
        "height": 720,
        "fps": orig_fps,
        "total_size_mb": round(total_size / (1024 * 1024), 2)
    }
    
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        
    dur = time.time() - t0
    return f"Clip {clip_num:02d} done: {count} frames ({manifest['total_size_mb']} MB) in {dur:.1f}s"

def make_animated_loop(src_clip_num, out_filename, fps=18, quality=70, max_frames=72):
    t0 = time.time()
    prefix = f"{src_clip_num:02d}_"
    matches = [f for f in os.listdir(RAW_DIR) if f.startswith(prefix) and f.endswith(".mp4")]
    if not matches:
        return
    
    video_path = os.path.join(RAW_DIR, matches[0])
    os.makedirs(LOOP_DIR, exist_ok=True)
    out_path = os.path.join(LOOP_DIR, out_filename)
    
    container = av.open(video_path)
    stream = container.streams.video[0]
    orig_fps = float(stream.average_rate) if stream.average_rate else 24.0
    step = max(1, round(orig_fps / fps))
    
    frames = []
    frame_idx = 0
    for packet in container.demux(stream):
        for frame in packet.decode():
            if frame_idx % step == 0:
                img = frame.to_image().resize((1280, 720), Image.Resampling.LANCZOS)
                frames.append(img)
                if len(frames) >= max_frames:
                    break
            frame_idx += 1
        if len(frames) >= max_frames:
            break
            
    if frames:
        duration_ms = int(1000 / fps)
        frames[0].save(
            out_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=duration_ms,
            loop=0,
            quality=quality,
            method=3
        )
        sz_mb = os.path.getsize(out_path) / (1024 * 1024)
        print(f"Loop created: {out_filename} ({len(frames)} frames, {sz_mb:.2f} MB) in {time.time() - t0:.1f}s")

if __name__ == "__main__":
    t_start = time.time()
    print("Starting parallel conversion of 10 clips to 720p WebP...")
    
    with ProcessPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(process_single_clip, range(1, 11)))
        
    for r in results:
        print(" ", r)
        
    print(f"All clips extracted in {time.time() - t_start:.1f}s")
    
    print("\nCreating anime loop for Clip 1 end (using Clip 6 / Clip 1)...")
    # Clip 6 is the exact seamless HUD gantry pulse loop designed for Clip 1 end!
    make_animated_loop(src_clip_num=6, out_filename="loop_clip_01_gantry_pulse.webp", fps=18, quality=70, max_frames=72)
    # Also create loop from clip 1's own end in case desired
    make_animated_loop(src_clip_num=1, out_filename="loop_clip_01_direct.webp", fps=18, quality=70, max_frames=72)
    
    print("\nBatch processing completely finished!")

