Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\src\static\tabbar'
$bg = [System.Drawing.ColorTranslator]::FromHtml('#f5f5f5')
$inactive = [System.Drawing.ColorTranslator]::FromHtml('#999999')
$active = [System.Drawing.ColorTranslator]::FromHtml('#143f3a')

function New-Canvas($file, $color, $draw) {
  $bmp = New-Object System.Drawing.Bitmap 81, 81
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($bg)
  $brush = New-Object System.Drawing.SolidBrush $color
  $pen = New-Object System.Drawing.Pen $color, 3
  & $draw $g $brush $pen
  $path = Join-Path $outDir $file
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $brush.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

function Draw-Home($g, $brush, $pen) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $points = @(
    [System.Drawing.PointF]::new(40.5, 25),
    [System.Drawing.PointF]::new(25, 37),
    [System.Drawing.PointF]::new(25, 61),
    [System.Drawing.PointF]::new(35, 61),
    [System.Drawing.PointF]::new(35, 47),
    [System.Drawing.PointF]::new(46, 47),
    [System.Drawing.PointF]::new(46, 61),
    [System.Drawing.PointF]::new(56, 61),
    [System.Drawing.PointF]::new(56, 37)
  )
  $path.AddPolygon($points)
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-New($g, $brush, $pen) {
  $g.FillRectangle($brush, 36, 25, 9, 42)
  $g.FillRectangle($brush, 25, 41, 42, 9)
}

function Draw-Cases($g, $brush, $pen) {
  $g.DrawRectangle($pen, 25, 25, 31, 31)
  $g.FillRectangle($brush, 30, 30, 8, 8)
  $g.FillRectangle($brush, 30, 42, 21, 3)
  $g.FillRectangle($brush, 30, 48, 21, 3)
}

function Draw-Me($g, $brush, $pen) {
  $g.FillEllipse($brush, 32.5, 27, 16, 16)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddBezier(26.5, 61, 26.5, 52, 33, 47, 40.5, 47)
  $path.AddBezier(40.5, 47, 48, 47, 54.5, 52, 54.5, 61)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

New-Canvas 'home.png' $inactive ${function:Draw-Home}
New-Canvas 'home-active.png' $active ${function:Draw-Home}
New-Canvas 'new.png' $inactive ${function:Draw-New}
New-Canvas 'new-active.png' $active ${function:Draw-New}
New-Canvas 'cases.png' $inactive ${function:Draw-Cases}
New-Canvas 'cases-active.png' $active ${function:Draw-Cases}
New-Canvas 'me.png' $inactive ${function:Draw-Me}
New-Canvas 'me-active.png' $active ${function:Draw-Me}
