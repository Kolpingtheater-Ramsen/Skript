import asyncio
import random
import pandas as pd

import edge_tts
from edge_tts import VoicesManager

#!/usr/bin/env python3

# Name: de-DE-AmalaNeural
# Gender: Female

# Name: de-DE-ConradNeural
# Gender: Male

# Name: de-DE-FlorianMultilingualNeural
# Gender: Male

# Name: de-DE-KatjaNeural
# Gender: Female

# Name: de-DE-KillianNeural
# Gender: Male

# Name: de-DE-SeraphinaMultilingualNeural
# Gender: Female

###

# Mikro	Schauspieler
# 1	BLADE
# 2	RAVEN
# 3	HUNTER
# 4	DANTE
# 5	VEGA
# 6	ARIA
# 7	NYRA
# 8	ALESA
# 9	XION
# 10	SERAPHINA
# 11	SERENITY
# 12	SYBELLA
# 14	RIPPER

# I can modify: rate, pitch, volume

# Define a dictionary for character voice assignments with rate and pitch settings
# Define a dictionary for character voice assignments with rate and pitch settings in Hz
character_voices = {
    "BLADE": {
        "voice": "de-DE-ConradNeural",
        "rate": "-10%",       # Slightly slower for intensity
        "pitch": "-5Hz"       # Slightly lower pitch for a strong, grounded character
    },
    "RAVEN": {
        "voice": "de-DE-KatjaNeural",
        "rate": "-5%",        # Slightly slower for a mysterious feel
        "pitch": "-10Hz"      # Deeper pitch for a darker tone
    },
    "HUNTER": {
        "voice": "de-DE-KillianNeural",
        "rate": "+0%",         # Neutral rate for assertiveness
        "pitch": "-5Hz"       # Slightly lower pitch for strength
    },
    "DANTE": {
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+10%",       # Faster for an energetic, lively feel
        "pitch": "+0Hz"        # Neutral pitch to retain clarity
    },
    "VEGA": {
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "-5%",        # Slightly slower for elegance
        "pitch": "+5Hz"       # Slightly higher pitch for a lighter feel
    },
    "ARIA": {
        "voice": "de-DE-AmalaNeural",
        "rate": "+5%",        # Slightly faster for a dynamic character
        "pitch": "+10Hz"      # Higher pitch for a lively, cheerful tone
    },
    "NYRA": {
        "voice": "de-DE-KatjaNeural",
        "rate": "+0%",         # Neutral rate for calmness
        "pitch": "-5Hz"       # Slightly lower for a grounded, wise tone
    },
    "ALESA": {
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "+0%",         # Neutral rate for clarity
        "pitch": "+0Hz"        # Neutral pitch for a balanced character
    },
    "XION": {
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+5%",        # Slightly faster for an agile tone
        "pitch": "-5Hz"       # Slightly lower for intensity
    },
    "SERAPHINA": {
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "-10%",       # Slower for a mystical tone
        "pitch": "+5Hz"       # Higher pitch for a soft, ethereal quality
    },
    "SERENITY": {
        "voice": "de-DE-AmalaNeural",
        "rate": "-5%",        # Slightly slower for calmness
        "pitch": "+5Hz"       # Slightly higher pitch for gentleness
    },
    "SYBELLA": {
        "voice": "de-DE-KatjaNeural",
        "rate": "+5%",        # Slightly faster for a lively tone
        "pitch": "+10Hz"      # Higher pitch for a vibrant feel
    },
    "RIPPER": {
        "voice": "de-DE-KillianNeural",
        "rate": "-10%",       # Slower for an ominous feel
        "pitch": "-10Hz"      # Lower pitch for a darker tone
    }
}


# read the script
df = pd.read_csv("Nexus - Skript - Skript.csv")

async def amain() -> None:
    """Main function"""
    for index, row in df.iterrows():
        category = row["Kategorie"]
        if category != "Schauspieler":
            continue
        character = row["Schauspieler"]
        if not character or character.strip() == "":
            continue

        text = row["Text"]

        voice = character_voices[character]["voice"]
        rate = character_voices[character]["rate"]
        pitch = character_voices[character]["pitch"]
        print(f"Character: {character}, Voice: {voice}, Rate: {rate}, Pitch: {pitch}")
        print(f"Text: {text}")
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await communicate.save(f"voices/{index}_{character}.wav")

if __name__ == "__main__":
    asyncio.run(amain())