$ErrorActionPreference = 'Stop'
$reportFile = Join-Path $PSScriptRoot 'Solana-practical-report.docx'
$pdfFile = Join-Path $PSScriptRoot '.qa/Solana-practical-report.pdf'
New-Item -ItemType Directory -Path (Split-Path -Parent $pdfFile) -Force | Out-Null
$word = $null
$document = $null
$createdEmptyInstance = $false
try {
    $word = New-Object -ComObject Word.Application
    $createdEmptyInstance = ($word.Documents.Count -eq 0)
    if ($createdEmptyInstance) {
        $word.Visible = $false
        $word.DisplayAlerts = 0
    }
    $document = $word.Documents.Open($reportFile, $false, $true)
    $document.ExportAsFixedFormat($pdfFile, 17)
    Write-Output "Exported report for visual verification"
} finally {
    if ($null -ne $document) {
        $document.Close(0)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    }
    if ($null -ne $word) {
        if ($createdEmptyInstance -and $word.Documents.Count -eq 0) { $word.Quit() }
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
