"""Build Xiaomi spritesheet from existing frame PNGs.
Layout matches Doggo: 8 columns x 9 rows, 192x208px cells.
Row order defined by Doggo's spritesheet layout.
"""
from PIL import Image
import os

FRAMES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'static', 'pets', 'xiaomi', 'frames')
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'static', 'pets', 'xiaomi', 'spritesheet.webp')

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 9

# Row order matching Doggo pets.js rowMap
ROW_ORDER = [
    'idle',
    'running-right',
    'running-left',
    'waving',
    'jumping',
    'failed',
    'waiting',
    'running',
    'review',
]

def main():
    spritesheet = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))

    for row_idx, state in enumerate(ROW_ORDER):
        state_dir = os.path.join(FRAMES_DIR, state)
        if not os.path.isdir(state_dir):
            print(f"WARN: missing state dir {state_dir}")
            continue

        pngs = sorted([f for f in os.listdir(state_dir) if f.endswith('.png')])
        for col_idx, png_name in enumerate(pngs):
            if col_idx >= COLS:
                print(f"WARN: {state} has more than {COLS} frames, truncating")
                break
            img_path = os.path.join(state_dir, png_name)
            img = Image.open(img_path).convert('RGBA')
            if img.size != (CELL_W, CELL_H):
                img = img.resize((CELL_W, CELL_H), Image.LANCZOS)
            spritesheet.paste(img, (col_idx * CELL_W, row_idx * CELL_H))
            print(f"  [{row_idx},{col_idx}] {state}/{png_name}")

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    spritesheet.save(OUTPUT, 'WEBP', quality=90)
    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"\nDone: {OUTPUT} ({size_kb:.0f} KB)")

if __name__ == '__main__':
    main()
