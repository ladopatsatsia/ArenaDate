import wave
import math
import struct
import os

SAMPLE_RATE = 44100

def write_wav(filename, samples):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with wave.open(filename, 'w') as wav_file:
        nchannels = 1
        sampwidth = 2
        framerate = SAMPLE_RATE
        nframes = len(samples)
        wav_file.setparams((nchannels, sampwidth, framerate, nframes, 'NONE', 'not compressed'))
        
        # Clip and pack to 16-bit signed PCM
        raw_data = bytearray()
        for s in samples:
            val = max(-1.0, min(1.0, s))
            int_val = int(val * 32767.0)
            raw_data.extend(struct.pack('<h', int_val))
        wav_file.writeframes(raw_data)
    print(f"Generated {filename} ({len(samples)/SAMPLE_RATE:.2f}s)")

def generate_spin(filename):
    # ~2.6 seconds of bottle spinning: rhythmic friction clicks slowing down
    duration = 2.6
    total_samples = int(SAMPLE_RATE * duration)
    samples = [0.0] * total_samples
    
    # Generate rotational click pulses that slow down
    t = 0.0
    dt = 1.0 / SAMPLE_RATE
    
    # Phase accumulator for spinning clicks
    phase = 0.0
    while t < duration:
        progress = t / duration
        # Speed drops from ~18 rps down to 0 rps
        speed = 22.0 * math.pow(max(0.0, 1.0 - progress), 1.6)
        
        idx = int(t * SAMPLE_RATE)
        if idx >= total_samples:
            break
            
        # Subtle friction resonance
        friction = 0.12 * math.sin(2 * math.pi * 320 * t) * math.pow(max(0.0, 1.0 - progress), 2.0)
        # Add high glass scrape overtone
        friction += 0.06 * math.sin(2 * math.pi * 1450 * t) * (0.5 + 0.5 * math.sin(phase * 2 * math.pi)) * math.pow(max(0.0, 1.0 - progress), 2.5)
        
        samples[idx] += friction
        
        phase += speed * dt
        if phase >= 1.0:
            phase -= 1.0
            # Inject a short wooden/glass tap click of ~15ms
            click_len = int(SAMPLE_RATE * 0.015)
            click_amp = 0.45 * math.pow(max(0.0, 1.0 - progress * 0.8), 1.2)
            for c in range(click_len):
                if idx + c < total_samples:
                    ct = c / SAMPLE_RATE
                    # Damped oscillation around 880 Hz and 1760 Hz
                    env = math.exp(-ct * 300)
                    osc = math.sin(2 * math.pi * 880 * ct) * 0.7 + math.sin(2 * math.pi * 1850 * ct) * 0.3
                    samples[idx + c] += click_amp * env * osc
                    
        t += dt
        
    write_wav(filename, samples)

def generate_turn_selected(filename):
    # Bright pleasant 4-tone ascending bell chime: C5, E5, G5, C6
    duration = 1.4
    total_samples = int(SAMPLE_RATE * duration)
    samples = [0.0] * total_samples
    
    notes = [
        (0.00, 523.25, 0.45), # C5
        (0.12, 659.25, 0.45), # E5
        (0.24, 783.99, 0.50), # G5
        (0.38, 1046.50, 0.60) # C6
    ]
    
    for start_t, freq, amp in notes:
        start_idx = int(start_t * SAMPLE_RATE)
        note_dur = duration - start_t
        note_samples = int(note_dur * SAMPLE_RATE)
        for i in range(note_samples):
            idx = start_idx + i
            if idx >= total_samples:
                break
            t = i / SAMPLE_RATE
            # Crystal bell envelope: fast attack, exponential decay
            env = math.exp(-t * 4.5)
            # Fundamental + soft harmonics
            val = (
                math.sin(2 * math.pi * freq * t) * 0.7 +
                math.sin(2 * math.pi * (freq * 2) * t) * 0.2 +
                math.sin(2 * math.pi * (freq * 3.01) * t) * 0.1
            )
            samples[idx] += amp * env * val
            
    write_wav(filename, samples)

def generate_kiss_sent(filename):
    # Cute playful pop / kiss chirp
    duration = 0.55
    total_samples = int(SAMPLE_RATE * duration)
    samples = [0.0] * total_samples
    
    # Pitch sweep from 380Hz -> 820Hz -> 450Hz in 120ms (kiss pop)
    pop_dur = 0.14
    pop_samples = int(pop_dur * SAMPLE_RATE)
    phase = 0.0
    for i in range(pop_samples):
        t = i / SAMPLE_RATE
        rel = t / pop_dur
        # Pitch curve
        freq = 380 + 500 * math.sin(rel * math.pi)
        phase += freq / SAMPLE_RATE
        # Envelope: punchy rise and fall
        env = math.sin(rel * math.pi) ** 1.5
        samples[i] += 0.55 * env * math.sin(2 * math.pi * phase)
        
    # Followed by a gentle sparkle chime at 0.10s
    sparkle_start = int(0.10 * SAMPLE_RATE)
    for i in range(total_samples - sparkle_start):
        idx = sparkle_start + i
        t = i / SAMPLE_RATE
        env = math.exp(-t * 9.0)
        val = math.sin(2 * math.pi * 1318.5 * t) * 0.5 + math.sin(2 * math.pi * 2637 * t) * 0.25
        samples[idx] += 0.35 * env * val
        
    write_wav(filename, samples)

def generate_kiss_received(filename):
    # Romantic magical shimmer chime / sparkle arpeggio
    duration = 1.6
    total_samples = int(SAMPLE_RATE * duration)
    samples = [0.0] * total_samples
    
    # Harp/music box cascade: E5, G#5, B5, E6, G#6
    chords = [
        (0.00, 659.25, 0.40), # E5
        (0.10, 830.61, 0.42), # G#5
        (0.20, 987.77, 0.45), # B5
        (0.32, 1318.51, 0.50), # E6
        (0.46, 1661.22, 0.45), # G#6
    ]
    
    for start_t, freq, amp in chords:
        start_idx = int(start_t * SAMPLE_RATE)
        for i in range(total_samples - start_idx):
            idx = start_idx + i
            t = i / SAMPLE_RATE
            env = math.exp(-t * 3.8)
            # Shimmer with slight chorus detune
            val = (
                math.sin(2 * math.pi * freq * t) * 0.6 +
                math.sin(2 * math.pi * (freq * 1.003) * t) * 0.25 +
                math.sin(2 * math.pi * (freq * 2) * t) * 0.15
            )
            samples[idx] += amp * env * val
            
    write_wav(filename, samples)

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    generate_spin(os.path.join(base_dir, 'spin.wav'))
    generate_turn_selected(os.path.join(base_dir, 'turn_selected.wav'))
    generate_kiss_sent(os.path.join(base_dir, 'kiss_sent.wav'))
    generate_kiss_received(os.path.join(base_dir, 'kiss_received.wav'))
    print("All audio files generated successfully!")
