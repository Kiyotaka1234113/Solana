from pathlib import Path

import pypdfium2 as pdfium


ROOT = Path(__file__).resolve().parent / ".qa"
pdf = pdfium.PdfDocument(str(ROOT / "Solana-practical-report.pdf"))
for index, page in enumerate(pdf):
    bitmap = page.render(scale=1.65)
    bitmap.to_pil().save(ROOT / f"page-{index + 1}.png")
    text = page.get_textpage().get_text_range()
    print(f"Page {index + 1}: {len(text)} characters; {text[:90]!r}")
print(f"Rendered {len(pdf)} pages")
