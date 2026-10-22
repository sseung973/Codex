# Development tools

- Original model and balance exporter lives at `../../relay-zero/scripts/export-unity.ts` in the repository. Execute it from `relay-zero` with `node --import tsx scripts/export-unity.ts ../relay-zero-unity/Assets/RelayZero/Resources/Data` after installing that project's dependencies.
- `convert-ui.py` turns the checked-in original SVG icons into PNGs. It requires CairoSVG for development only. Unity runtime does not need Python or Node.
- Fonts are bundled. Noto Sans CJK KR was subset to Latin, Korean Hangul/jamo, punctuation and UI symbols using fontTools; its license and source are retained. No network download is needed to run the game once Unity has installed its own packages.
- `Tests/Rules.Tests.csproj` is a standalone .NET 8 console rule/content check. Unity's Editor smoke and build commands are in `Assets/RelayZero/Editor`.
