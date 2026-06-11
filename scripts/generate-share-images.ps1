param(
  [string]$EnvFile = ".env.local",
  [string]$ImageGen = "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\image_gen.py"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $EnvFile)) {
  throw "Missing env file: $EnvFile"
}

$pairs = @{}
Get-Content -Encoding UTF8 $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
    $idx = $line.IndexOf("=")
    $pairs[$line.Substring(0, $idx)] = $line.Substring($idx + 1)
  }
}

if (!$pairs["OPENAI_API_KEY"]) {
  throw "OPENAI_API_KEY is empty in $EnvFile"
}

$env:OPENAI_API_KEY = $pairs["OPENAI_API_KEY"]
if ($pairs["OPENAI_BASE_URL"]) {
  $env:OPENAI_BASE_URL = ([string]$pairs["OPENAI_BASE_URL"]).TrimEnd("/")
  if ($env:OPENAI_BASE_URL -notmatch "/v1$") {
    $env:OPENAI_BASE_URL = "$env:OPENAI_BASE_URL/v1"
  }
}

$model = if ($pairs["IMAGE_MODEL"]) { $pairs["IMAGE_MODEL"] } else { "gpt-image-2" }
New-Item -ItemType Directory -Force -Path "output\imagegen" | Out-Null

function Invoke-ImageGen {
  param(
    [string]$Prompt,
    [string]$Out
  )

  python $ImageGen generate --model $model --quality medium --size 1280x1024 --prompt $Prompt --out $Out --force
  if ($LASTEXITCODE -ne 0) {
    throw "Image generation failed for $Out"
  }
}

$commonPrompt = @"
WeChat mini program share card for Crush Master. 5:4 landscape app UI screenshot style. Campus Pop visual system: bold black outlines, hard drop shadows, warm cream background, coral red hero block, yellow accent labels, teal relationship signal bubbles, simple relationship dashboard chart. The image should look like the opened mini program page, not a generic marketing poster. Use readable text exactly: Crush Master, 关系信号看板, 记录真实互动, 看清关系趋势, 打开小程序，继续观察. No QR code, no watermark, no photorealistic people, no fake phone frame, no blurred background.
"@

$taohuaPrompt = @"
WeChat mini program share card for Crush Master 命理桃花. 5:4 landscape app UI screenshot style that matches the taohua-share page: cream background, coral hero block, white poster card with black border and hard shadow, round yellow-coral seal, small yellow labels, compact mini cards. Use readable text exactly: TAOHUA, TA 的桃花人格卡, 吸引力关键词, 桃花吸引型, Crush Master · 命理桃花, 打开小程序生成专属卡. No QR code, no watermark, no photorealistic people, no fake phone frame.
"@

Invoke-ImageGen -Prompt $commonPrompt -Out "output\imagegen\share-card-gpt-image-2.png"
Invoke-ImageGen -Prompt $taohuaPrompt -Out "output\imagegen\share-taohua-persona-gpt-image-2.png"

Copy-Item -Force "output\imagegen\share-card-gpt-image-2.png" "src\static\share-card.png"
Copy-Item -Force "output\imagegen\share-taohua-persona-gpt-image-2.png" "src\static\share-taohua-persona.png"

Write-Host "Generated and installed share images with $model."
