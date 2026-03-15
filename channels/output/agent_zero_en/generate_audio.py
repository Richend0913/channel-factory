import asyncio, edge_tts, json, io, time, os, sys
from pydub import AudioSegment

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VOICE_MAP = {
    "MAIN": "en-US-GuyNeural",
    "SUB": "en-US-AriaNeural"
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPT_PATH = os.path.join(SCRIPT_DIR, "src", "audio", "script.json")
TIMING_PATH = os.path.join(SCRIPT_DIR, "src", "audio", "timing.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "src", "audio", "narration.mp3")

async def generate_audio(text, voice, rate="+15%"):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data

def build_narration():
    with open(SCRIPT_PATH, encoding='utf-8') as f:
        script = json.load(f)

    segments = []
    timing = []
    offset = 0.0
    silence = AudioSegment.silent(duration=150)

    for i, item in enumerate(script):
        voice = VOICE_MAP[item["speaker"]]
        print(f"  [{i+1}/{len(script)}] {item['character_name']}: {item['text'][:50]}...")
        audio_bytes = asyncio.run(generate_audio(item["text"], voice, rate="+15%"))
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
        segments.append(audio)
        duration_sec = len(audio) / 1000.0
        timing.append({
            "scene": item["scene"],
            "startFrame": item["startFrame"],
            "speaker": item["speaker"],
            "character_name": item["character_name"],
            "text": item["text"],
            "audioOffsetSec": round(offset, 3),
            "durationSec": round(duration_sec, 3)
        })
        offset += duration_sec + 0.15
        time.sleep(0.2)

    combined = segments[0]
    for s in segments[1:]:
        combined = combined + silence + s
    combined.export(OUTPUT_PATH, format="mp3")

    with open(TIMING_PATH, "w", encoding='utf-8') as f:
        json.dump(timing, f, ensure_ascii=False, indent=2)

    print(f"\nAudio complete: {offset:.1f}s -> {OUTPUT_PATH}")

if __name__ == "__main__":
    build_narration()
