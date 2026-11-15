"""Correct the existing nine-page Dutch Zhang review PDF for publication.

Run only against the checked original binary. Keep its research content and links.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import os
import tempfile
import fitz
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path("assets/research/zhang-genai-l2-review-nl-2026.pdf")
ORIGINAL_GIT_SHA = "4e5691c84311683eb8ab38d366e624f38ebcc184"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_CARLITO = "/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf"


def replace_lines(doc, page_number, originals, replacements, lineheight=14.2):
    page = doc[page_number - 1]
    matches = []
    for original in originals:
        found = page.search_for(original.strip())
        if len(found) != 1:
            raise ValueError(f"page {page_number}: expected one match for {original!r}, got {len(found)}")
        matches.append(found[0])
    x, anchor = 75.2, matches[0].y0
    for rect in matches:
        page.add_redact_annot(fitz.Rect(x - 1, rect.y0 - 0.8, 526.5, rect.y1 + 0.8), fill=(1, 1, 1))
    page.apply_redactions(images=0, graphics=0, text=0)
    page.insert_font(fontname="DV", fontfile=FONT_REGULAR)
    font = fitz.Font(fontfile=FONT_REGULAR)
    for index, line in enumerate(replacements):
        if font.text_length(line, fontsize=10) >= 452:
            raise ValueError(f"line is too long: {line}")
        page.insert_text((x, anchor + 9.28 + index * lineheight), line,
                         fontname="DV", fontsize=10, color=(39 / 255, 47 / 255, 58 / 255))


def verify(doc):
    assert len(doc) == 9, "Unexpected number of pages"
    assert "hardop lezen met Amazon Alexa" in doc[2].get_text()
    assert "Zes opgenomen onderzoeken met vragen" in doc[2].get_text()
    assert "Per bronstudie is aangegeven" not in doc[2].get_text()
    assert "Dat wijst op een consistente codering" in doc[5].get_text()
    assert "Vissers opgave" in doc[8].get_text()
    assert sum(len(page.get_links()) for page in doc) == 10, "PDF hyperlinks changed"


def rebuild():
    data = SOURCE.read_bytes()
    git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if git_sha != ORIGINAL_GIT_SHA:
        doc = fitz.open(SOURCE)
        try:
            verify(doc)
        except Exception as exc:
            raise ValueError(f"Unexpected source PDF (git blob {git_sha})") from exc
        finally:
            doc.close()
        print("Dutch PDF already corrected; nothing to change.")
        return
    doc = fitz.open(SOURCE)
    assert len(doc) == 9, "Expected nine-page source"
    assert sum(len(page.get_links()) for page in doc) == 10, "Expected ten source hyperlinks"
    image = Image.open(BytesIO(doc.extract_image(12)["image"])).convert("RGB")
    painter = ImageDraw.Draw(image)
    painter.rectangle((96, 501, 850, 574), fill=(255, 255, 255))
    font = ImageFont.truetype(FONT_CARLITO, 56)
    painter.text((104, 507), "heterogeniteit (I²)", font=font, fill=(39, 47, 58))
    with tempfile.TemporaryDirectory() as tmp:
        corrected_figure = Path(tmp) / "corrected_figure.jpg"
        image.save(corrected_figure, "JPEG", quality=98, subsampling=0)
        doc[0].replace_image(12, filename=str(corrected_figure))
        replace_lines(doc, 3, [
            "gebruikt. Elmaadaway et al. (2025) onderzochten mondeling lezen met Amazon Alexa. "
        ], [
            "gebruikt. Elmaadaway et al. (2025) onderzochten hardop lezen met Amazon Alexa."
        ])
        replace_lines(doc, 6, [
            "0,86). Dat maakt de indeling beter reproduceerbaar. Het vertelt nog niet wie tijdens de "
        ], [
            "0,86). Dat wijst op een consistente codering. Het toont niet wie tijdens de"
        ])
        replace_lines(doc, 9, [
            "Hans Visser en ChatGPT werkten samen aan deze onderzoeksreview. De analyse, de ",
            "tekst en de vormgeving kwamen in wisselwerking tot stand. De werkwijze hieronder is ",
            "beschreven op basis van de opgave van Visser; zij vormt geen volledig logboek van ",
            "iedere gebruikte tool."
        ], [
            "Hans Visser en ChatGPT werkten samen aan deze onderzoeksreview. De analyse, de",
            "tekst en de vormgeving kwamen gezamenlijk tot stand. De werkwijze hieronder",
            "is beschreven op basis van Vissers opgave, niet op een volledig logboek van",
            "alle gebruikte tools."
        ])
        doc.set_metadata({**doc.metadata,
                          "title": "Onderzoeksreview Zhang et al. (2026) - definitieve versie",
                          "subject": "Kritische review van een meta-analyse naar generatieve AI bij taalonderwijs"})
        stage = Path(tmp) / "stage.pdf"
        doc.save(stage, garbage=4, deflate=True)
        doc.close()
        revised = fitz.open(stage)
        page = revised[2]
        for original in [
            "Figuur 3. Per bronstudie is aangegeven welk selectiecriterium nadere controle vraagt. De gevallen zijn niet",
            "allemaal gelijk. [1–7]"
        ]:
            found = page.search_for(original)
            if len(found) != 1:
                raise ValueError(f"caption did not match: {original}")
            page.add_redact_annot(found[0] + (-0.7, -0.3, 0.7, 0.3), fill=(1, 1, 1))
        page.apply_redactions(images=0, graphics=0, text=0)
        page.insert_font(fontname="DVS", fontfile=FONT_SANS)
        font = fitz.Font(fontfile=FONT_SANS)
        for y, line in zip([694.75, 705.15], [
            "Figuur 3. Zes opgenomen onderzoeken met vragen over de taaluitkomst, de gebruikte",
            "techniek of de indeling naar onderzoeksopzet. [1–7]"
        ]):
            width = font.text_length(line, fontsize=8)
            page.insert_text(((595.27 - width) / 2, y), line, fontname="DVS",
                             fontsize=8, color=(0x5f / 255, 0x6c / 255, 0x78 / 255))
        verify(revised)
        final = Path(tmp) / "final.pdf"
        revised.save(final, garbage=4, deflate=True)
        revised.close()
        os.replace(final, SOURCE)
    print(f"Validated and corrected Dutch review PDF ({SOURCE.stat().st_size} bytes).")


if __name__ == "__main__":
    rebuild()
