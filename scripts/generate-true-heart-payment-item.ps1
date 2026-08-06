Add-Type -AssemblyName System.Drawing

$workspace = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $workspace 'static\payment-items'
$outputPath = Join-Path $outputDir 'true-heart-full-report-item.png'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-RoundedPath([System.Drawing.RectangleF]$rect, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$bitmap = New-Object System.Drawing.Bitmap 1024, 1024
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$ink = [System.Drawing.ColorTranslator]::FromHtml('#211F2B')
$coral = [System.Drawing.ColorTranslator]::FromHtml('#F45258')
$red = [System.Drawing.ColorTranslator]::FromHtml('#D63D46')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#FFF7EA')
$peach = [System.Drawing.ColorTranslator]::FromHtml('#FBD9C7')
$rule = [System.Drawing.ColorTranslator]::FromHtml('#E9CDBF')
$brandText = -join [char[]](0x5FC3, 0x52A8, 0x4EBA, 0x8BBE, 0x5C40)
$eyebrowText = 'TA ' + (-join [char[]](0x5230, 0x5E95, 0x662F, 0x54EA, 0x4E00, 0x6302))
$titleText = -join [char[]](0x5B8C, 0x6574, 0x62A5, 0x544A)
$stampText = -join [char[]](0x5DF2, 0x89E3, 0x9501)
$footerText = -join [char[]](0x4EBA, 0x7269, 0x5339, 0x914D, 0x00B7, 0x5173, 0x7CFB, 0x4FE1, 0x53F7, 0x00B7, 0x76F8, 0x5904, 0x5EFA, 0x8BAE)

$graphics.Clear($coral)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $peach), 93, 108, 44, 44)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $peach), 869, 186, 27, 27)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $peach), 173, 857, 33, 33)
$graphics.DrawEllipse((New-Object System.Drawing.Pen $peach, 7), 899, 735, 178, 178)

$brandPath = New-RoundedPath ([System.Drawing.RectangleF]::new(81, 75, 243, 73)) 7
$graphics.FillPath((New-Object System.Drawing.SolidBrush $peach), $brandPath)
$graphics.DrawPath((New-Object System.Drawing.Pen $ink, 3), $brandPath)
$brandFont = New-Object System.Drawing.Font 'Microsoft YaHei', 28, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString($brandText, $brandFont, (New-Object System.Drawing.SolidBrush $ink), 105, 92)
$brandPath.Dispose()

$graphics.TranslateTransform(512, 536)
$graphics.RotateTransform(-4)
$graphics.TranslateTransform(-512, -536)

$shadowPath = New-RoundedPath ([System.Drawing.RectangleF]::new(209, 200, 650, 716)) 10
$graphics.FillPath((New-Object System.Drawing.SolidBrush $ink), $shadowPath)
$shadowPath.Dispose()
$paperPath = New-RoundedPath ([System.Drawing.RectangleF]::new(187, 178, 650, 716)) 10
$graphics.FillPath((New-Object System.Drawing.SolidBrush $paper), $paperPath)
$graphics.DrawPath((New-Object System.Drawing.Pen $ink, 8), $paperPath)
$paperPath.Dispose()

$eyebrowFont = New-Object System.Drawing.Font 'Microsoft YaHei', 26, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$titleFont = New-Object System.Drawing.Font 'Microsoft YaHei', 64, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString($eyebrowText, $eyebrowFont, (New-Object System.Drawing.SolidBrush $red), 255, 256)
$graphics.DrawString($titleText, $titleFont, (New-Object System.Drawing.SolidBrush $ink), 252, 308)
$graphics.FillRectangle((New-Object System.Drawing.SolidBrush $ink), 252, 414, 514, 6)
$graphics.FillRectangle((New-Object System.Drawing.SolidBrush $rule), 252, 469, 482, 20)
$graphics.FillRectangle((New-Object System.Drawing.SolidBrush $rule), 252, 516, 401, 20)
$graphics.FillRectangle((New-Object System.Drawing.SolidBrush $rule), 252, 563, 325, 20)

$heartBrush = New-Object System.Drawing.SolidBrush $red
$heartPen = New-Object System.Drawing.Pen $ink, 6
$graphics.FillEllipse($heartBrush, 286, 644, 79, 79)
$graphics.FillEllipse($heartBrush, 348, 644, 79, 79)
$graphics.FillPolygon($heartBrush, [System.Drawing.Point[]]@((New-Object System.Drawing.Point 287, 682), (New-Object System.Drawing.Point 426, 682), (New-Object System.Drawing.Point 356, 795)))
$graphics.DrawEllipse($heartPen, 286, 644, 79, 79)
$graphics.DrawEllipse($heartPen, 348, 644, 79, 79)
$graphics.DrawLine($heartPen, 287, 682, 356, 795)
$graphics.DrawLine($heartPen, 426, 682, 356, 795)

$stampPen = New-Object System.Drawing.Pen $red, 8
$graphics.DrawEllipse($stampPen, 584, 675, 177, 177)
$stampFont = New-Object System.Drawing.Font 'Microsoft YaHei', 34, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$stampFormat = New-Object System.Drawing.StringFormat
$stampFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stampFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString($stampText, $stampFont, (New-Object System.Drawing.SolidBrush $red), ([System.Drawing.RectangleF]::new(584, 675, 177, 177)), $stampFormat)

$graphics.ResetTransform()
$footerFont = New-Object System.Drawing.Font 'Microsoft YaHei', 24, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString($footerText, $footerFont, (New-Object System.Drawing.SolidBrush $paper), 470, 952)

$thumbnail = New-Object System.Drawing.Bitmap 200, 200
$thumbnailGraphics = [System.Drawing.Graphics]::FromImage($thumbnail)
$thumbnailGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$thumbnailGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$thumbnailGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$thumbnailGraphics.DrawImage($bitmap, 0, 0, 200, 200)
$thumbnail.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$stampFormat.Dispose()
$stampPen.Dispose()
$heartPen.Dispose()
$heartBrush.Dispose()
$eyebrowFont.Dispose()
$titleFont.Dispose()
$stampFont.Dispose()
$footerFont.Dispose()
$brandFont.Dispose()
$thumbnailGraphics.Dispose()
$thumbnail.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath
