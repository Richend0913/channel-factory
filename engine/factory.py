"""
CHANNEL FACTORY Engine
Orchestrates the full video pipeline: research → script → audio → render → metadata → upload
"""

import argparse
import asyncio
import io
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / "channels" / "config"
OUTPUT_DIR = BASE_DIR / "channels" / "output"
CREDENTIALS_DIR = BASE_DIR / "credentials"

VOICE_MAP_EN = {
    "MAIN": "en-US-GuyNeural",
    "SUB": "en-US-AriaNeural",
}

VOICE_MAP_JA = {
    "MAIN": "ja-JP-KeitaNeural",
    "SUB": "ja-JP-NanamiNeural",
}

FPS = 30


# ============================================================
# Used Topics Tracking (duplicate prevention)
# ============================================================
def load_used_topics(out_dir):
    """Load previously used topics from used_topics.json."""
    topics_path = out_dir / "used_topics.json"
    if topics_path.exists():
        with open(topics_path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("topics", [])
    return []


def save_used_topics(out_dir, topics):
    """Save used topics list to used_topics.json."""
    topics_path = out_dir / "used_topics.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(topics_path, "w", encoding="utf-8") as f:
        json.dump({"topics": topics}, f, indent=2, ensure_ascii=False)
    print(f"    -> used_topics.json updated ({len(topics)} topics)")


def add_used_topic(out_dir, topic):
    """Append a topic to used_topics.json if not already present."""
    topics = load_used_topics(out_dir)
    if topic and topic not in topics:
        topics.append(topic)
        save_used_topics(out_dir, topics)


def _extract_topic_from_metadata(out_dir):
    """Extract the video topic/title from youtube_metadata.txt."""
    meta_path = out_dir / "out" / "youtube_metadata.txt"
    if not meta_path.exists():
        return None
    title, _, _ = parse_metadata(str(meta_path))
    return title if title else None


def _git_commit_used_topics():
    """Commit all used_topics.json files so they persist across CI runs."""
    print("\n  [Post] Committing used_topics.json files to git...")
    result = subprocess.run(
        ["git", "add", "channels/output/*/used_topics.json"],
        cwd=str(BASE_DIR), capture_output=True, text=True,
    )
    # Check if there are staged changes
    result = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=str(BASE_DIR), capture_output=True, text=True,
    )
    if result.returncode == 0:
        print("    -> No new topics to commit")
        return
    result = subprocess.run(
        ["git", "commit", "-m", "update used_topics.json [skip ci]"],
        cwd=str(BASE_DIR), capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"    -> git commit failed: {result.stderr[:200]}")
        return
    result = subprocess.run(
        ["git", "push"],
        cwd=str(BASE_DIR), capture_output=True, text=True, timeout=60,
    )
    if result.returncode == 0:
        print("    -> used_topics.json committed and pushed")
    else:
        print(f"    -> git push failed: {result.stderr[:200]}")


def load_configs(channel_filter=None):
    """Load channel configs, optionally filtering to a specific channel."""
    configs = []
    for path in sorted(CONFIG_DIR.glob("*.json")):
        if path.name.startswith("00_"):
            continue  # skip bilingual config
        with open(path, encoding="utf-8") as f:
            ch = json.load(f)
        if channel_filter and ch["id"] != channel_filter:
            continue
        ch["_config_path"] = str(path)
        configs.append(ch)
    return configs


# ============================================================
# Phase 0: Trend Research (Google News RSS + scraping)
# ============================================================
def _fetch_trending_topics(keywords, num_results=10):
    """Fetch trending topics from Google News RSS for given keywords."""
    import re
    try:
        import requests
    except ImportError:
        print(f"    -> Missing: pip install requests")
        return []

    topics = []
    for kw in keywords[:3]:  # limit to 3 keywords
        try:
            url = f"https://news.google.com/rss/search?q={requests.utils.quote(kw)}&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                continue
            # Parse RSS XML with regex (no lxml dependency needed)
            titles = re.findall(r"<title><!\[CDATA\[(.+?)\]\]></title>", resp.text)
            if not titles:
                titles = re.findall(r"<title>(.+?)</title>", resp.text)
            skip_titles = {"Google News", "Google", "News", "Top Stories", ""}
            for t in titles[1:num_results+1]:  # skip RSS feed title
                clean = re.sub(r"\s*-\s*[A-Za-z].*$", "", t).strip()
                if len(clean) > 20 and clean not in skip_titles:
                    topics.append({"headline": clean, "keyword": kw})
        except Exception as e:
            print(f"    -> RSS fetch failed for '{kw}': {e}")
    return topics


def phase0_research(ch, out_dir):
    """Phase 0: Trend research and topic selection."""
    print(f"  [Phase 0] Trend research for {ch['name']}...")
    research_file = out_dir / "research.json"
    if research_file.exists():
        print(f"    -> research.json already exists, skipping")
        return True

    used = load_used_topics(out_dir)
    if used:
        print(f"    -> {len(used)} previously used topics loaded (will exclude)")

    # Fetch trending topics from Google News
    en_keywords = ch.get("search_keywords_en", [])
    if not en_keywords:
        # Auto-generate English keywords from channel config
        genre = ch.get("genre", "")
        name = ch.get("name", "")
        en_keywords = [name, genre.split("・")[0] if "・" in genre else genre]
    print(f"    -> Searching trends for: {en_keywords}")
    headlines = _fetch_trending_topics(en_keywords)
    print(f"    -> Found {len(headlines)} trending headlines")

    # Filter out used topics (fuzzy match on first 30 chars)
    used_lower = [t.lower()[:30] for t in used]
    fresh = [h for h in headlines if h["headline"].lower()[:30] not in used_lower]
    print(f"    -> {len(fresh)} fresh topics after filtering")

    research = {
        "status": "ready",
        "keywords": en_keywords,
        "headlines": fresh[:10],
        "used_topics_count": len(used),
    }
    with open(research_file, "w", encoding="utf-8") as f:
        json.dump(research, f, indent=2, ensure_ascii=False)
    print(f"    -> research.json created with {len(fresh[:10])} candidate topics")
    return True


# ============================================================
# Phase 1: Script Generation (template-based, no paid API)
# ============================================================

# Script templates per channel genre — each is a function that takes
# (topic, main_name, sub_name) and returns a list of dialogue dicts.
# The topic comes from Phase 0 research headlines.

def _generate_script_from_template(ch, topic, lang):
    """Generate a script.json from channel config and a topic string.

    Uses a fixed 5-act structure (HOOK→CONFLICT→INVESTIGATION→TWIST→RESOLUTION→OUTRO)
    with the channel's character names and speaking styles.
    """
    main = ch["characters"]["main"]["name"]
    sub = ch["characters"]["sub"]["name"]

    # Build a script that works for any channel genre
    # The template uses the topic headline as the central claim to investigate
    lines = [
        # HOOK (4 lines)
        {"scene": "HookScene", "speaker": "SUB", "character_name": sub,
         "text": f"So I keep seeing this everywhere — {topic}. Is that actually true?"},
        {"scene": "HookScene", "speaker": "MAIN", "character_name": main,
         "text": f"I spent the last week digging into the data on this. Short answer? It's way more complicated than the headlines suggest."},
        {"scene": "HookScene", "speaker": "SUB", "character_name": sub,
         "text": "More complicated how?"},
        {"scene": "HookScene", "speaker": "MAIN", "character_name": main,
         "text": "The mainstream narrative gets about three things completely wrong. Let me walk you through what I found."},

        # CONFLICT (4 lines)
        {"scene": "ConflictScene", "speaker": "SUB", "character_name": sub,
         "text": "OK, what's the first thing people get wrong?"},
        {"scene": "ConflictScene", "speaker": "MAIN", "character_name": main,
         "text": f"The biggest misconception is that {topic.lower()} is straightforward. But when you look at the actual numbers, the picture flips. Most people are working with outdated information."},
        {"scene": "ConflictScene", "speaker": "SUB", "character_name": sub,
         "text": "Outdated how? Like, the data changed?"},
        {"scene": "ConflictScene", "speaker": "MAIN", "character_name": main,
         "text": "Completely changed. What was true three years ago is not true today. And almost nobody is talking about the updated data."},

        # INVESTIGATION (4 lines)
        {"scene": "InvestigationScene", "speaker": "SUB", "character_name": sub,
         "text": "What does the new data actually show?"},
        {"scene": "InvestigationScene", "speaker": "MAIN", "character_name": main,
         "text": "Three key findings stand out. First, the scale is much bigger than reported. Second, the cause is completely different from what experts assumed. And third, there's a pattern that nobody predicted."},
        {"scene": "InvestigationScene", "speaker": "SUB", "character_name": sub,
         "text": "A pattern nobody predicted? That sounds dramatic."},
        {"scene": "InvestigationScene", "speaker": "MAIN", "character_name": main,
         "text": "It is dramatic. When you plot the data over time, there's a clear inflection point. Before that point, one thing was true. After it, the opposite became true. And most people haven't caught up yet."},

        # TWIST (4 lines)
        {"scene": "TwistScene", "speaker": "SUB", "character_name": sub,
         "text": "So what's the real takeaway here?"},
        {"scene": "TwistScene", "speaker": "MAIN", "character_name": main,
         "text": "Here's where it gets interesting. The conventional wisdom isn't just slightly wrong — it's pointing people in the exact opposite direction."},
        {"scene": "TwistScene", "speaker": "SUB", "character_name": sub,
         "text": "The exact opposite? That's a bold claim."},
        {"scene": "TwistScene", "speaker": "MAIN", "character_name": main,
         "text": "Bold but backed by data. If you're making decisions based on what everyone believes, you're likely making the wrong call. The smart move is counterintuitive."},

        # RESOLUTION (4 lines)
        {"scene": "ResolutionScene", "speaker": "SUB", "character_name": sub,
         "text": "OK so what should people actually do with this information?"},
        {"scene": "ResolutionScene", "speaker": "MAIN", "character_name": main,
         "text": "Three actionable rules. One — stop relying on headlines. Two — check when the data was last updated. Three — look for who benefits from the old narrative staying alive."},
        {"scene": "ResolutionScene", "speaker": "SUB", "character_name": sub,
         "text": "Follow the incentives. Classic."},
        {"scene": "ResolutionScene", "speaker": "MAIN", "character_name": main,
         "text": "Always follow the incentives. The data doesn't lie, but the people interpreting it sometimes do."},

        # OUTRO (2 lines)
        {"scene": "OutroScene", "speaker": "SUB", "character_name": sub,
         "text": "Next time we're diving into another claim that everyone takes for granted. You might be surprised."},
        {"scene": "OutroScene", "speaker": "MAIN", "character_name": main,
         "text": "Subscribe so you don't miss it. We test one assumption every week with real data."},
    ]

    # Add startFrame field
    for line in lines:
        line["startFrame"] = 0

    return lines


def phase1_script(ch, out_dir, lang):
    """Phase 1: Generate dialogue script from research + template."""
    print(f"  [Phase 1] Script generation ({lang})...")
    audio_dir = out_dir / "src" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    script_path = audio_dir / "script.json"

    if script_path.exists():
        with open(script_path, encoding="utf-8") as f:
            script = json.load(f)
        print(f"    -> script.json already exists ({len(script)} lines)")
        return True

    # Load research to pick a topic
    research_file = out_dir / "research.json"
    topic = None
    if research_file.exists():
        with open(research_file, encoding="utf-8") as f:
            research = json.load(f)
        headlines = research.get("headlines", [])
        if headlines:
            topic = headlines[0].get("headline", "")
            print(f"    -> Topic from research: {topic}")

    if not topic:
        # Fallback topic from channel config
        topic = ch.get("concept", ch.get("name", "an interesting topic"))
        print(f"    -> Using fallback topic: {topic}")

    script = _generate_script_from_template(ch, topic, lang)

    with open(script_path, "w", encoding="utf-8") as f:
        json.dump(script, f, indent=2, ensure_ascii=False)
    print(f"    -> script.json generated ({len(script)} lines)")
    return True


# ============================================================
# Phase 2: Visual Design (placeholder — needs LLM for TSX)
# ============================================================
def phase2_visuals(ch, out_dir):
    """Phase 2: Create Remotion project and visual components."""
    print(f"  [Phase 2] Visual design...")
    remotion_dir = out_dir / "remotion-project"

    if (remotion_dir / "src" / "MainVideo.tsx").exists():
        print(f"    -> Remotion project already exists")
        return True

    # Auto-setup from template
    template_dir = BASE_DIR / "engine" / "remotion-template"
    if template_dir.exists():
        import shutil
        print(f"    -> Copying Remotion template...")
        if remotion_dir.exists():
            shutil.rmtree(str(remotion_dir))
        shutil.copytree(str(template_dir), str(remotion_dir))

        # Apply channel-specific colors to both MainVideo and ShortVideo
        colors = ch.get("colors", {})
        if colors:
            color_map = {
                "#07080f": colors.get("background", "#07080f"),
                "#4fffff": colors.get("primary", "#4fffff"),
                "#a855f7": colors.get("secondary", "#a855f7"),
                "#f0f4ff": colors.get("text", "#f0f4ff"),
            }
            for tsx_name in ("MainVideo.tsx", "ShortVideo.tsx"):
                tsx_path = remotion_dir / "src" / tsx_name
                if tsx_path.exists():
                    content = tsx_path.read_text(encoding="utf-8")
                    for old_color, new_color in color_map.items():
                        content = content.replace(old_color, new_color)
                    tsx_path.write_text(content, encoding="utf-8")
            print(f"    -> Applied channel colors to MainVideo + ShortVideo")

        # Copy script.json to public/audio/ if it exists
        script_src = out_dir / "src" / "audio" / "script.json"
        audio_pub = remotion_dir / "public" / "audio"
        audio_pub.mkdir(parents=True, exist_ok=True)
        if script_src.exists():
            shutil.copy2(str(script_src), str(audio_pub / "script.json"))

        print(f"    -> Remotion project created from template")
        return True

    print(f"    -> Remotion project not found and no template available.")
    return False


# ============================================================
# Phase 3: Script to Dialogue (台本ルール enforcement)
# ============================================================
def phase3_dialogue(ch, out_dir, lang):
    """Phase 3: Validate and finalize dialogue script."""
    print(f"  [Phase 3] Dialogue validation ({lang})...")
    script_path = out_dir / "src" / "audio" / "script.json"

    if not script_path.exists():
        print(f"    -> No script.json found, skipping")
        return False

    with open(script_path, encoding="utf-8") as f:
        script = json.load(f)

    main_name = ch["characters"]["main"]["name"]
    sub_name = ch["characters"]["sub"]["name"]
    scenes = set(item["scene"] for item in script)
    word_count = sum(len(item["text"].split()) for item in script)

    print(f"    -> {len(script)} lines, {len(scenes)} scenes, ~{word_count} words")
    print(f"    -> Characters: {main_name} (MAIN), {sub_name} (SUB)")
    print(f"    -> Scenes: {', '.join(sorted(scenes))}")
    return True


# ============================================================
# Phase 4: Audio Synthesis (edge-tts)
# ============================================================
def phase4_audio(ch, out_dir, lang):
    """Phase 4: Generate narration audio with edge-tts."""
    print(f"  [Phase 4] Audio synthesis ({lang})...")
    audio_dir = out_dir / "src" / "audio"
    script_path = audio_dir / "script.json"
    timing_path = audio_dir / "timing.json"
    narration_path = audio_dir / "narration.mp3"

    if not script_path.exists():
        print(f"    -> No script.json, skipping audio")
        return False

    if narration_path.exists() and timing_path.exists():
        print(f"    -> narration.mp3 and timing.json already exist, skipping")
        return True

    try:
        import edge_tts
        from pydub import AudioSegment
    except ImportError:
        print(f"    -> Missing dependencies: pip install edge-tts pydub")
        return False

    voice_map = VOICE_MAP_EN if lang == "en" else VOICE_MAP_JA
    # Check if channel config has custom voices
    main_voice = ch["characters"]["main"].get(f"edge_tts_voice_{lang}")
    sub_voice = ch["characters"]["sub"].get(f"edge_tts_voice_{lang}")
    if main_voice:
        voice_map = {"MAIN": main_voice, "SUB": sub_voice or voice_map["SUB"]}

    rate = "+15%" if lang == "en" else "+25%"

    with open(script_path, encoding="utf-8") as f:
        script = json.load(f)

    async def generate_line(text, voice):
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data

    segments = []
    timing = []
    offset = 0.0
    silence_gap = 150  # ms between lines

    for i, item in enumerate(script):
        voice = voice_map[item["speaker"]]
        print(f"    -> Line {i+1}/{len(script)}: {item['character_name']} ({voice})")
        audio_bytes = asyncio.run(generate_line(item["text"], voice))
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
        segments.append(audio)
        duration_sec = len(audio) / 1000.0
        timing.append({
            "scene": item["scene"],
            "speaker": item["speaker"],
            "character_name": item["character_name"],
            "text": item["text"],
            "audioOffsetSec": round(offset, 3),
            "durationSec": round(duration_sec, 3),
        })
        offset += duration_sec + silence_gap / 1000.0
        time.sleep(0.2)  # rate limit

    # Combine with silence gaps
    silence = AudioSegment.silent(duration=silence_gap)
    combined = segments[0]
    for s in segments[1:]:
        combined += silence + s
    combined.export(str(narration_path), format="mp3")

    with open(timing_path, "w", encoding="utf-8") as f:
        json.dump(timing, f, ensure_ascii=False, indent=2)

    # Also copy to remotion public dir if it exists
    remotion_audio_dir = out_dir / "remotion-project" / "public" / "audio"
    if remotion_audio_dir.exists():
        import shutil
        shutil.copy2(str(narration_path), str(remotion_audio_dir / "narration.mp3"))
        shutil.copy2(str(timing_path), str(remotion_audio_dir / "timing.json"))
        shutil.copy2(str(script_path), str(remotion_audio_dir / "script.json"))
        print(f"    -> Copied audio files to remotion-project/public/audio/")

    print(f"    -> Audio complete: {offset:.1f}s total")
    return True


# ============================================================
# Phase 5: Remotion Render
# ============================================================
def _ensure_remotion_deps(remotion_dir):
    """Install node dependencies if needed. Returns True on success."""
    if not (remotion_dir / "node_modules").exists():
        print(f"    -> Installing npm dependencies...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        result = subprocess.run(
            [npm_cmd, "install"],
            cwd=str(remotion_dir),
            capture_output=True, text=True, timeout=300,
            shell=(sys.platform == "win32"),
        )
        if result.returncode != 0:
            print(f"    -> npm install failed: {result.stderr[:200]}")
            return False
    return True


def phase5_render(ch, out_dir):
    """Phase 5: Render long video and short video with Remotion."""
    print(f"  [Phase 5] Remotion render...")
    remotion_dir = out_dir / "remotion-project"
    out_video = out_dir / "out"
    out_video.mkdir(parents=True, exist_ok=True)
    video_path = out_video / "video.mp4"
    short_path = out_video / "short.mp4"

    if not (remotion_dir / "src" / "index.ts").exists():
        print(f"    -> No Remotion project found, skipping render")
        return False

    if not _ensure_remotion_deps(remotion_dir):
        return False

    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    use_shell = sys.platform == "win32"

    # --- Render long video ---
    if video_path.exists():
        size_mb = video_path.stat().st_size / (1024 * 1024)
        print(f"    -> video.mp4 already exists ({size_mb:.1f} MB), skipping")
    else:
        print(f"    -> Rendering MainVideo...")
        result = subprocess.run(
            [npx_cmd, "remotion", "render", "src/index.ts", "MainVideo",
             str(video_path), "--concurrency=2", "--timeout=120000"],
            cwd=str(remotion_dir),
            capture_output=True, text=True, timeout=1800,
            shell=use_shell,
        )
        if result.returncode != 0:
            print(f"    -> Long render failed: {result.stderr[:300]}")
            print(f"    -> stdout: {result.stdout[:300]}")
            return False
        size_mb = video_path.stat().st_size / (1024 * 1024)
        print(f"    -> Long video complete: {size_mb:.1f} MB")

    # --- Render short video (YouTubeShort composition) ---
    if short_path.exists():
        size_mb = short_path.stat().st_size / (1024 * 1024)
        print(f"    -> short.mp4 already exists ({size_mb:.1f} MB), skipping")
    else:
        # Check if YouTubeShort composition exists in the project
        root_tsx = remotion_dir / "src" / "Root.tsx"
        root_content = root_tsx.read_text(encoding="utf-8") if root_tsx.exists() else ""
        if "YouTubeShort" not in root_content:
            print(f"    -> No YouTubeShort composition found, generating short from long video...")
            _generate_short_from_long(video_path, short_path)
        else:
            print(f"    -> Rendering YouTubeShort...")
            result = subprocess.run(
                [npx_cmd, "remotion", "render", "src/index.ts", "YouTubeShort",
                 str(short_path), "--concurrency=2", "--timeout=120000"],
                cwd=str(remotion_dir),
                capture_output=True, text=True, timeout=600,
                shell=use_shell,
            )
            if result.returncode != 0:
                print(f"    -> Short render failed, falling back to ffmpeg extract...")
                _generate_short_from_long(video_path, short_path)

        if short_path.exists():
            size_mb = short_path.stat().st_size / (1024 * 1024)
            print(f"    -> Short video complete: {size_mb:.1f} MB")

    # --- Generate thumbnail ---
    thumb_path = out_video / "thumbnail.png"
    if not thumb_path.exists() and video_path.exists():
        print(f"    -> Generating thumbnail...")
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(video_path), "-ss", "4", "-vframes", "1",
             str(thumb_path)],
            capture_output=True, text=True, timeout=30,
        )

    return video_path.exists()


def _generate_short_from_long(long_path, short_path):
    """Generate a 58s vertical short from the long video using ffmpeg.

    Takes the hook section (first 58 seconds), crops to 9:16 vertical,
    and adds a slight zoom for visual interest.
    """
    if not long_path.exists():
        print(f"    -> No long video to extract short from")
        return
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(long_path),
            "-t", "58",
            "-vf", "crop=ih*9/16:ih,scale=1080:1920",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            str(short_path),
        ],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        print(f"    -> ffmpeg short extraction failed: {result.stderr[:200]}")


# ============================================================
# Phase 6: Metadata Generation
# ============================================================
def _generate_metadata_from_script(ch, out_dir):
    """Generate youtube_metadata.txt from script.json content."""
    script_path = out_dir / "src" / "audio" / "script.json"
    if not script_path.exists():
        return None, None

    with open(script_path, encoding="utf-8") as f:
        script = json.load(f)

    # Extract topic from the first SUB line (usually the hook question)
    hook_text = ""
    for line in script:
        if line["scene"] == "HookScene":
            hook_text = line["text"]
            break

    # Extract key phrases from script for description
    all_text = " ".join(item["text"] for item in script)
    word_count = len(all_text.split())

    main_name = ch["characters"]["main"]["name"]
    sub_name = ch["characters"]["sub"]["name"]
    channel_name = ch.get("name", "")
    footer = ch.get("channel_footer_en", ch.get("channel_footer", ""))

    # Generate title — use hook text, trimmed to 70 chars
    # Title patterns: "The Truth About X", "X — Here's What the Data Says"
    title = hook_text.rstrip("?").strip()
    if len(title) > 60:
        title = title[:57] + "..."
    title = f"{title} — Here's What the Data Says"
    if len(title) > 70:
        title = title[:67] + "..."

    # Generate description from script scenes
    scene_summaries = []
    for scene_name in ["ConflictScene", "InvestigationScene", "TwistScene", "ResolutionScene"]:
        scene_lines = [item["text"] for item in script if item["scene"] == scene_name and item["speaker"] == "MAIN"]
        if scene_lines:
            scene_summaries.append(f"- {scene_lines[0][:100]}")

    description = f"""In this video, {main_name} and {sub_name} investigate what everyone gets wrong about this topic.

Key points covered:
{chr(10).join(scene_summaries[:4])}

{word_count}+ words of data-driven analysis in under 5 minutes.

{footer}"""

    # Generate tags from channel genre and keywords
    genre_words = ch.get("genre", "").replace("・", " ").replace("、", " ").split()
    keywords = ch.get("search_keywords", [])
    tag_words = [channel_name.lower().replace(" ", "")] + \
                [w.lower() for w in genre_words if len(w) > 2] + \
                [k.lower().replace(" ", "") for k in keywords[:5]] + \
                ["data", "analysis", "facts", "debunked", "explained"]
    tags = list(dict.fromkeys(tag_words))[:15]  # dedupe, max 15

    return title, description, tags


def phase6_metadata(ch, out_dir, lang):
    """Phase 6: Generate YouTube metadata (long + short) from script."""
    print(f"  [Phase 6] Metadata generation ({lang})...")
    out_path = out_dir / "out"
    out_path.mkdir(parents=True, exist_ok=True)
    meta_path = out_path / "youtube_metadata.txt"
    meta_short_path = out_path / "youtube_metadata_short.txt"

    # Generate long metadata if missing
    if not meta_path.exists():
        print(f"    -> Generating youtube_metadata.txt from script...")
        result = _generate_metadata_from_script(ch, out_dir)
        if result[0] is None:
            print(f"    -> No script found, cannot generate metadata")
            return False
        title, description, tags = result
        meta_content = (
            f"[Title]\n{title}\n\n"
            f"[Description]\n{description}\n\n"
            f"[Tags]\n" + " ".join(f"#{t}" for t in tags) + "\n"
        )
        with open(meta_path, "w", encoding="utf-8") as f:
            f.write(meta_content)
        print(f"    -> youtube_metadata.txt created: {title}")
    else:
        print(f"    -> youtube_metadata.txt already exists, skipping")

    # Generate short metadata
    if not meta_short_path.exists() and meta_path.exists():
        print(f"    -> Generating youtube_metadata_short.txt...")
        title, description, tags = parse_metadata(str(meta_path))
        short_title = f"#Shorts {title[:60]}" if title else "#Shorts"
        short_tags = ["Shorts"] + tags[:5]
        short_meta = (
            f"[Title]\n{short_title}\n\n"
            f"[Description]\n{description}\n\n"
            f"[Tags]\n" + " ".join(f"#{t}" for t in short_tags) + "\n"
        )
        with open(meta_short_path, "w", encoding="utf-8") as f:
            f.write(short_meta)
        print(f"    -> youtube_metadata_short.txt created")
    elif meta_short_path.exists():
        print(f"    -> youtube_metadata_short.txt already exists, skipping")

    return True


# ============================================================
# Phase 7: YouTube Upload
# ============================================================
def _build_youtube_client(ch, lang):
    """Build authenticated YouTube API client with channel verification."""
    channel_id = ch["id"]
    channel_name = ch.get("name", channel_id)
    expected_yt_id = ch.get("youtube_channel_id")

    # Resolve token path
    token_suffix = f"_{channel_id}" if lang == "ja" else f"_{channel_id}_en"
    token_path = CREDENTIALS_DIR / f"token{token_suffix}.json"
    if not token_path.exists() and lang == "en":
        token_path = CREDENTIALS_DIR / f"token_{channel_id}.json"

    print(f"    -> Mapping: channel_id={channel_id} → token={token_path.name}")

    if not token_path.exists():
        print(f"    -> ERROR: No token found at {token_path}")
        print(f"       Run: python scripts/auth.py --channel {channel_id}")
        return None, None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        print(f"    -> Missing: pip install google-api-python-client google-auth")
        return None, None

    try:
        with open(token_path, encoding="utf-8") as f:
            content = f.read().strip()
        if not content:
            print(f"    -> ERROR: Token file is empty (Secret not set?)")
            return None, None
        token_data = json.loads(content)
    except (json.JSONDecodeError, ValueError) as e:
        print(f"    -> ERROR: Invalid token JSON: {e}")
        return None, None

    creds = Credentials(
        token=token_data["token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
        scopes=token_data.get("scopes"),
    )
    youtube = build("youtube", "v3", credentials=creds)

    # Verify which YouTube channel this token actually belongs to
    try:
        resp = youtube.channels().list(part="snippet", mine=True).execute()
        items = resp.get("items", [])
        if not items:
            print(f"    -> WARNING: Token has no associated YouTube channel")
            return youtube, None

        actual_yt_id = items[0]["id"]
        actual_yt_name = items[0]["snippet"]["title"]
        print(f"    -> YouTube channel: {actual_yt_name} (ID: {actual_yt_id})")

        # If config has youtube_channel_id, verify it matches
        if expected_yt_id and expected_yt_id != actual_yt_id:
            print(f"    -> ABORT: Channel mismatch! "
                  f"Config expects {expected_yt_id} but token is for {actual_yt_id} ({actual_yt_name})")
            print(f"       Check that token_{channel_id}.json matches the correct Google account.")
            return None, None

        return youtube, actual_yt_name

    except Exception as e:
        # youtube.upload scope may not have channels.list permission
        # Log warning but allow upload to proceed
        print(f"    -> WARNING: Could not verify channel ownership: {e}")
        print(f"    -> Proceeding with upload (add youtube_channel_id to config for safety)")
        return youtube, None


def _upload_video(youtube, video_path, meta_path, thumb_path, category_id,
                   label="video", yt_channel_name=None):
    """Upload a single video to YouTube. Returns (success, url)."""
    from googleapiclient.http import MediaFileUpload

    if not video_path.exists():
        print(f"    -> No {video_path.name} found, skipping {label} upload")
        return False, None

    if not meta_path.exists():
        print(f"    -> No {meta_path.name} found, skipping {label} upload")
        return False, None

    title, description, tags = parse_metadata(str(meta_path))
    print(f"    -> Uploading {label}: {title}")

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(
        str(video_path), chunksize=-1, resumable=True, mimetype="video/mp4"
    )
    req = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            print(f"    -> Progress: {int(status.progress() * 100)}%")

    vid = response["id"]
    channel_id_resp = response.get("snippet", {}).get("channelId", "unknown")
    url = f"https://youtu.be/{vid}"
    dest = yt_channel_name or channel_id_resp
    print(f"    -> Uploaded {label}: {url} (to: {dest})")

    # Upload thumbnail if exists
    if thumb_path and thumb_path.exists():
        try:
            youtube.thumbnails().set(
                videoId=vid,
                media_body=MediaFileUpload(str(thumb_path), mimetype="image/png"),
            ).execute()
            print(f"    -> Thumbnail set for {label}")
        except Exception as e:
            print(f"    -> Thumbnail failed for {label}: {e}")

    return True, url


def phase7_upload(ch, out_dir, lang):
    """Phase 7: Upload long video + short video to YouTube."""
    print(f"  [Phase 7] YouTube upload...")

    youtube, yt_channel_name = _build_youtube_client(ch, lang)
    if youtube is None:
        return False, None, None

    category_id = ch.get("youtube_category_id", "22")

    # Upload long video
    long_ok, long_url = _upload_video(
        youtube,
        out_dir / "out" / "video.mp4",
        out_dir / "out" / "youtube_metadata.txt",
        out_dir / "out" / "thumbnail.png",
        category_id,
        label="long",
        yt_channel_name=yt_channel_name,
    )

    # Wait between uploads to avoid rate limits
    if long_ok:
        print(f"    -> Waiting 30s before short upload...")
        time.sleep(30)

    # Upload short video
    short_ok, short_url = _upload_video(
        youtube,
        out_dir / "out" / "short.mp4",
        out_dir / "out" / "youtube_metadata_short.txt",
        out_dir / "out" / "short_thumbnail.png",
        category_id,
        label="short",
        yt_channel_name=yt_channel_name,
    )

    return long_ok or short_ok, long_url, short_url


def parse_metadata(filepath):
    """Parse youtube_metadata.txt into title, description, tags."""
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    sections = {}
    current_key = None
    for line in content.splitlines():
        # Support both 【Title】 and [Title] formats
        if line.startswith("\u3010") and line.endswith("\u3011"):
            current_key = line[1:-1]
            sections[current_key] = []
        elif line.startswith("[") and line.endswith("]") and len(line) > 2:
            current_key = line[1:-1]
            sections[current_key] = []
        elif current_key:
            sections[current_key].append(line)

    title = "\n".join(
        sections.get("Title", sections.get("\u30bf\u30a4\u30c8\u30eb", []))
    ).strip()
    description = "\n".join(
        sections.get("Description", sections.get("\u8aac\u660e\u6587", []))
    ).strip()
    tags_raw = "\n".join(
        sections.get("Tags", sections.get("Hashtags",
            sections.get("\u30cf\u30c3\u30b7\u30e5\u30bf\u30b0", [])))
    ).strip()
    tags = [
        t.strip().lstrip("#")
        for t in tags_raw.replace("\n", " ").split()
        if t.startswith("#")
    ]
    return title, description, tags


# ============================================================
# Main Pipeline
# ============================================================
def _clean_previous_run(out_dir):
    """Remove generated files from previous run so fresh content is created.

    Preserves used_topics.json and remotion-project/node_modules (large, reusable).
    """
    import shutil
    preserve_files = {"used_topics.json"}

    if not out_dir.exists():
        return

    for item in out_dir.iterdir():
        if item.name in preserve_files:
            continue
        if item.name == "remotion-project":
            # Clean inside remotion-project except node_modules & package*
            for sub in item.iterdir():
                if sub.name in ("node_modules", "package.json", "package-lock.json"):
                    continue
                try:
                    if sub.is_dir():
                        # Use robocopy on Windows to handle long paths
                        if sys.platform == "win32":
                            subprocess.run(
                                ["cmd", "/c", "rmdir", "/s", "/q", str(sub)],
                                capture_output=True, timeout=30,
                            )
                        else:
                            shutil.rmtree(str(sub), ignore_errors=True)
                    else:
                        sub.unlink(missing_ok=True)
                except Exception:
                    pass
        elif item.is_dir():
            try:
                if sys.platform == "win32":
                    subprocess.run(
                        ["cmd", "/c", "rmdir", "/s", "/q", str(item)],
                        capture_output=True, timeout=30,
                    )
                else:
                    shutil.rmtree(str(item), ignore_errors=True)
            except Exception:
                pass
        else:
            try:
                item.unlink(missing_ok=True)
            except Exception:
                pass


def process_channel(ch, lang, skip_upload=False):
    """Run full pipeline for a single channel."""
    channel_id = ch["id"]
    suffix = "" if lang == "ja" else "_en"
    out_dir = OUTPUT_DIR / f"{channel_id}{suffix}"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Clean previous run's generated files so we create fresh content
    _clean_previous_run(out_dir)
    print(f"  -> Cleaned previous output (fresh generation)")

    result = {
        "name": ch["name"],
        "channel_id": channel_id,
        "lang": lang,
        "success": False,
        "long_url": None,
        "short_url": None,
        "error": None,
        "phases": {},
    }

    try:
        # Phase 0: Research
        result["phases"]["0_research"] = phase0_research(ch, out_dir)

        # Phase 1: Script
        result["phases"]["1_script"] = phase1_script(ch, out_dir, lang)

        # Phase 2: Visuals
        result["phases"]["2_visuals"] = phase2_visuals(ch, out_dir)

        # Phase 3: Dialogue validation
        result["phases"]["3_dialogue"] = phase3_dialogue(ch, out_dir, lang)

        # Phase 4: Audio
        result["phases"]["4_audio"] = phase4_audio(ch, out_dir, lang)

        # Phase 5: Render
        result["phases"]["5_render"] = phase5_render(ch, out_dir)

        # Phase 6: Metadata
        result["phases"]["6_metadata"] = phase6_metadata(ch, out_dir, lang)

        # Phase 7: Upload (long + short)
        if skip_upload:
            print(f"  [Phase 7] Upload skipped (--no-upload)")
            result["phases"]["7_upload"] = False
        else:
            uploaded, long_url, short_url = phase7_upload(ch, out_dir, lang)
            result["phases"]["7_upload"] = uploaded
            if long_url:
                result["long_url"] = long_url
            if short_url:
                result["short_url"] = short_url

        # Consider success if we at least have a rendered video
        video_exists = (out_dir / "out" / "video.mp4").exists()
        result["success"] = video_exists

        # Record used topic to prevent duplicates in future runs
        if video_exists:
            topic = _extract_topic_from_metadata(out_dir)
            if topic:
                add_used_topic(out_dir, topic)
                result["topic"] = topic

    except Exception as e:
        result["error"] = str(e)
        print(f"  [ERROR] {e}")

    return result


def write_report(results, report_path):
    """Write factory_report.txt summary."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "========== CHANNEL FACTORY Report ==========",
        f"Date: {now}",
        "",
    ]

    success_count = 0
    fail_count = 0

    for r in results:
        lang_flag = "EN" if r["lang"] == "en" else "JA"
        if r["success"]:
            status = "OK"
            success_count += 1
            detail = ""
            if r["long_url"]:
                detail += f"  Long: {r['long_url']}"
            if r["short_url"]:
                detail += f"  Short: {r['short_url']}"
            lines.append(f"[{status}] [{lang_flag}] {r['name']}{detail}")
        else:
            status = "FAIL"
            fail_count += 1
            error = r.get("error", "incomplete pipeline")
            lines.append(f"[{status}] [{lang_flag}] {r['name']}  Error: {error}")

        # Phase summary
        phases = r.get("phases", {})
        phase_str = "  Phases: " + " ".join(
            f"{k}={'OK' if v else 'SKIP'}" for k, v in phases.items()
        )
        lines.append(phase_str)

    lines.append("")
    lines.append(f"Total: {success_count} OK, {fail_count} FAIL")
    lines.append("=" * 50)

    report = "\n".join(lines)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\nReport saved to: {report_path}")
    print(report)


def main():
    parser = argparse.ArgumentParser(description="CHANNEL FACTORY Engine")
    parser.add_argument(
        "--channel", type=str, default=None,
        help="Run only this channel ID (e.g. agent_zero)",
    )
    parser.add_argument(
        "--lang", type=str, default="both", choices=["ja", "en", "both"],
        help="Language: ja, en, or both (default: both)",
    )
    parser.add_argument(
        "--no-upload", action="store_true",
        help="Skip YouTube upload phase",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  CHANNEL FACTORY ENGINE")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Channel: {args.channel or 'ALL'}")
    print(f"  Language: {args.lang}")
    print("=" * 60)

    configs = load_configs(args.channel)
    if not configs:
        print(f"No configs found" + (f" for channel '{args.channel}'" if args.channel else ""))
        sys.exit(1)

    print(f"Loaded {len(configs)} channel config(s)")

    langs = []
    if args.lang in ("ja", "both"):
        langs.append("ja")
    if args.lang in ("en", "both"):
        langs.append("en")

    results = []

    for ch in configs:
        for lang in langs:
            suffix = "" if lang == "ja" else " (EN)"
            print(f"\n{'=' * 50}")
            print(f"Processing: {ch['name']}{suffix} ({ch['genre']})")
            print(f"{'=' * 50}")

            result = process_channel(ch, lang, skip_upload=args.no_upload)
            results.append(result)

    # Write report
    report_path = BASE_DIR / "factory_report.txt"
    write_report(results, str(report_path))

    # Commit used_topics.json files to git for persistence across CI runs
    any_success = any(r["success"] for r in results)
    if any_success:
        _git_commit_used_topics()


if __name__ == "__main__":
    main()
