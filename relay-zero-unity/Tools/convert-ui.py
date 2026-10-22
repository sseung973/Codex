"""Convert checked-in original SVG sources to Unity-compatible PNG textures.
Development-only dependency: pip install cairosvg
"""
from pathlib import Path
import cairosvg
root = Path(__file__).resolve().parent.parent
output = root / 'Assets/RelayZero/Resources/UI'
output.mkdir(exist_ok=True)
for source in (root / 'Tools/ui-source').glob('*.svg'):
    cairosvg.svg2png(url=str(source), write_to=str(output / (source.stem + '.png')),
                    output_width=192, output_height=224 if source.stem == 'operative' else 192)
