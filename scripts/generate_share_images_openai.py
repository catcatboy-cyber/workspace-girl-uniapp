import base64
import argparse
import os
import sys
import urllib.request
from pathlib import Path

from openai import OpenAI


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
OUT_DIR = ROOT / "output" / "imagegen"
STATIC_DIR = ROOT / "src" / "static"


def load_env(path: Path) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        pairs[key.strip()] = value.strip()
    return pairs


def write_image(result, out_path: Path) -> None:
    if not result.data:
        raise RuntimeError("Image API returned no data")

    item = result.data[0]
    b64 = getattr(item, "b64_json", None)
    url = getattr(item, "url", None)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if b64:
        out_path.write_bytes(base64.b64decode(b64))
        return

    if url:
        request = urllib.request.Request(url, headers={"User-Agent": "CrushMasterImageGen/1.0"})
        with urllib.request.urlopen(request, timeout=180) as response:
          out_path.write_bytes(response.read())
        return

    raise RuntimeError(f"Image API returned neither b64_json nor url: {result.model_dump_json()[:1000]}")


def generate(client: OpenAI, *, model: str, prompt: str, out_path: Path) -> None:
    print(f"Generating {out_path.name} with {model}...", file=sys.stderr)
    result = client.images.generate(
        model=model,
        prompt=prompt,
        quality="medium",
        size="1280x1024",
        output_format="png",
    )
    write_image(result, out_path)
    print(f"Wrote {out_path}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["all", "common", "taohua"], default="all")
    args = parser.parse_args()

    pairs = load_env(ENV_FILE)
    api_key = pairs.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY is empty in {ENV_FILE}")

    model = pairs.get("IMAGE_MODEL") or "gpt-image-2"
    base_url = pairs.get("OPENAI_BASE_URL") or None
    if base_url:
        base_url = base_url.rstrip("/")
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"

    client = OpenAI(api_key=api_key, base_url=base_url)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    common_prompt = (
        "WeChat mini program share card for Crush Master. 5:4 landscape app UI screenshot style. "
        "Campus Pop visual system: bold black outlines, hard drop shadows, warm cream background, "
        "coral red hero block, yellow accent labels, teal relationship signal bubbles, simple relationship dashboard chart. "
        "The image should look like the opened mini program page, not a generic marketing poster. "
        "Use readable text exactly: Crush Master, 关系信号看板, 记录真实互动, 看清关系趋势, 打开小程序，继续观察. "
        "No QR code, no watermark, no photorealistic people, no fake phone frame, no blurred background."
    )
    taohua_prompt = (
        "WeChat mini program share card for Crush Master 命理桃花. Make it look like an actual mini program page screenshot, "
        "not a poster. Strict Campus Pop UI: flat warm cream background, hard black 3px borders, square cards, hard black "
        "drop shadows, coral hero block at top with a small black TAOHUA label, white poster card below, circular yellow-coral "
        "seal on the left, persona keyword text on the right, small black/yellow/cream pills, two compact mini cards, black CTA "
        "bar at the bottom. Use sans-serif UI typography only. "
        "Use readable text exactly: TAOHUA, TA 的桃花人格卡, 吸引力关键词, 桃花吸引型, "
        "Crush Master · 命理桃花, 打开小程序生成专属卡. "
        "Avoid: giant decorative TAOHUA title, serif typography, soft romantic poster style, large hearts, glow effects, "
        "watercolor, QR code, watermark, photorealistic people, fake phone frame."
    )

    common_out = OUT_DIR / "share-card-gpt-image-2.png"
    taohua_out = OUT_DIR / "share-taohua-persona-gpt-image-2.png"
    if args.only in {"all", "common"}:
        generate(client, model=model, prompt=common_prompt, out_path=common_out)
        (STATIC_DIR / "share-card.png").write_bytes(common_out.read_bytes())

    if args.only in {"all", "taohua"}:
        generate(client, model=model, prompt=taohua_prompt, out_path=taohua_out)
        (STATIC_DIR / "share-taohua-persona.png").write_bytes(taohua_out.read_bytes())

    print("Installed generated images into src/static.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
