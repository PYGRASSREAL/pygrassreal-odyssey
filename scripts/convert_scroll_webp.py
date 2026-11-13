"""
convert_scroll_webp.py
แปลงคลิปวิดีโอ (MP4/WebM) เป็นชุดเฟรม WebP สำหรับทำระบบ Scroll Animation
พร้อมรองรับการสร้าง Anime Loop WebP เมื่อ Scroll จบช่วงคลิป

การใช้งาน:
    python scripts/convert_scroll_webp.py --input <path_to_video> --clip 1 [--fps 20] [--quality 80] [--width 1280]
"""

import os
import argparse
import av
from PIL import Image
import json

def convert_video_to_scroll_webp(video_path, out_dir, target_fps=20, quality=80, max_width=1280):
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"Opening video: {video_path}")
    container = av.open(video_path)
    video_stream = container.streams.video[0]
    
    orig_fps = float(video_stream.average_rate) if video_stream.average_rate else 24.0
    step = max(1, round(orig_fps / target_fps))
    
    print(f"Original FPS: {orig_fps:.2f} | Target FPS: {target_fps} (sampling step: {step})")
    
    frame_idx = 0
    saved_idx = 0
    saved_files = []
    
    for packet in container.demux(video_stream):
        for frame in packet.decode():
            if frame_idx % step == 0:
                img = frame.to_image()
                
                # Resize if needed
                w, h = img.size
                if w > max_width:
                    new_h = int(h * (max_width / w))
                    img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
                
                out_name = f"frame_{saved_idx:04d}.webp"
                out_path = os.path.join(out_dir, out_name)
                img.save(out_path, format="WEBP", quality=quality, method=4)
                saved_files.append(out_name)
                saved_idx += 1
                
                if saved_idx % 20 == 0:
                    print(f"  Saved {saved_idx} frames...")
                    
            frame_idx += 1
            
    manifest = {
        "clip": os.path.basename(out_dir),
        "source": os.path.basename(video_path),
        "total_frames": saved_idx,
        "target_fps": target_fps,
        "format": "webp"
    }
    
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Done! Extracted {saved_idx} WebP frames to {out_dir}")
    return saved_idx

def create_loop_webp(video_path, out_path, loop_duration_sec=3.0, fps=15, quality=75, max_width=960):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    print(f"Creating animated loop WebP from {video_path} -> {out_path}")
    
    container = av.open(video_path)
    video_stream = container.streams.video[0]
    orig_fps = float(video_stream.average_rate) if video_stream.average_rate else 24.0
    step = max(1, round(orig_fps / fps))
    max_frames = int(loop_duration_sec * fps)
    
    frames = []
    frame_idx = 0
    
    for packet in container.demux(video_stream):
        for frame in packet.decode():
            if frame_idx % step == 0:
                img = frame.to_image()
                w, h = img.size
                if w > max_width:
                    new_h = int(h * (max_width / w))
                    img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
                frames.append(img)
                if len(frames) >= max_frames:
                    break
            frame_idx += 1
        if len(frames) >= max_frames:
            break
            
    if frames:
        duration_per_frame = int(1000 / fps)
        frames[0].save(
            out_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=duration_per_frame,
            loop=0,
            quality=quality,
            method=4
        )
        print(f"Created loop animation: {out_path} ({len(frames)} frames)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input video")
    parser.add_argument("--clip", type=int, default=1, help="Clip index (1-10)")
    parser.add_argument("--fps", type=int, default=20, help="Target FPS for scroll extraction")
    parser.add_argument("--quality", type=int, default=80, help="WebP quality (1-100)")
    parser.add_argument("--make-loop", action="store_true", help="Also generate an animated loop WebP")
    args = parser.parse_args()
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    clip_dir = os.path.join(base_dir, "assets", "scroll_webp", f"clip_{args.clip:02d}")
    
    convert_video_to_scroll_webp(args.input, clip_dir, target_fps=args.fps, quality=args.quality)
    
    if args.make_loop:
        loop_out = os.path.join(base_dir, "assets", "loops", f"loop_clip_{args.clip:02d}.webp")
        create_loop_webp(args.input, loop_out, fps=args.fps, quality=args.quality)

