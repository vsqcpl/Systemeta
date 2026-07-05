$file = "c:\Users\kartik\OneDrive\Desktop\kartik\vsqc platform\app\(app)\ai\page.tsx"
$lines = [System.IO.File]::ReadAllLines($file)
$keep = @($lines[0..3916]) + @($lines[4391..($lines.Length-1)])
[System.IO.File]::WriteAllLines($file, $keep, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. Lines kept: $($keep.Length)"
