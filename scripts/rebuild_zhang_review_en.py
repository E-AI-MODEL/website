"""Fix the English Zhang research review PDF, retaining nine pages and source links."""
from pathlib import Path
from io import BytesIO
import tempfile, os, hashlib
import fitz
from PIL import Image, ImageDraw, ImageFont

PATH = Path("assets/research/zhang-genai-l2-review-en-2026.pdf")
SOURCE_SHA = "db13716321cc29fccc1e6847ff0d7ce302caa76c"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf"

def find_lines(page, strings):
    lines=[]
    for value in strings:
        matches=[]
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines",[]):
                s="".join(span["text"] for span in line["spans"])
                if s.strip()==value.strip():
                    matches.append(fitz.Rect(line["bbox"]))
        if len(matches)!=1:
            raise ValueError(f"Page {page.number+1} missing/duplicate text: {value!r} ({len(matches)})")
        lines.append(matches[0])
    return lines

def swap_lines(doc, pageno, old, new):
    assert len(old)==len(new)
    p=doc[pageno-1]
    rects=find_lines(p,old)
    anchor=rects[0].y0
    font=fitz.Font(fontfile=SERIF)
    for line in new:
        assert font.text_length(line,fontsize=10)<438, line
    for r in rects:
        p.add_redact_annot(fitz.Rect(74.3,r.y0-0.9,519.9,r.y1+0.8),fill=(1,1,1))
    p.apply_redactions(images=0,graphics=0,text=0)
    p.insert_font(fontname="DV",fontfile=SERIF)
    for i,line in enumerate(new):
        p.insert_text((75.2,anchor+9.28+i*14.2),line,fontname="DV",
                      fontsize=10,color=(39/255,47/255,58/255))

def verify(d):
    assert len(d)==9
    assert sum(len(p.get_links()) for p in d)==10
    assert "aloud with Amazon Alexa" in d[2].get_text()
    assert "Six studies require different checks" in d[2].get_text()
    assert "Each included study raises" not in d[2].get_text()
    assert "indicating consistent coding" in d[5].get_text()
    assert "Visser’s description" in d[8].get_text()
    for value in ["818","0.76","0.57","4,378","5,196"]:
        assert value in d[0].get_text(),value

def main():
    b=PATH.read_bytes()
    sha=hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
    if sha!=SOURCE_SHA:
        d=fitz.open(PATH)
        try: verify(d)
        finally: d.close()
        print("English review already corrected; no edit")
        return
    d=fitz.open(PATH)
    assert len(d)==9 and sum(len(p.get_links()) for p in d)==10
    with tempfile.TemporaryDirectory() as td:
        for pageno,xref in ((1,12),(3,43)):
            im=Image.open(BytesIO(d.extract_image(xref)["image"])).convert("RGB")
            dr=ImageDraw.Draw(im)
            if pageno==1:
                dr.rectangle((92,497,843,576),fill="white")
                dr.text((104,512),"heterogeneity (I²)",
                        font=ImageFont.truetype(BOLD,60),fill=(35,58,78))
            else:
                dr.rectangle((40,8,1730,145),fill="white")
                font=ImageFont.truetype(BOLD,58)
                dr.text((75,45),"Does it measure L2 learning?",font=font,fill=(35,58,78))
                dr.text((935,45),"Does the method fit?",font=font,fill=(35,58,78))
                dr.line((885,102,885,145),fill=(221,225,227),width=3)
            img=Path(td)/f"figure-{pageno}.jpg"
            im.save(img,"JPEG",quality=98,subsampling=0)
            d[pageno-1].replace_image(xref,filename=str(img))
        swap_lines(d,3,[
            "The technology also needs checking. Elmaadaway et al. (2025) investigated oral-",
            "reading practice using Amazon Alexa. Hwang et al. (2023) used Smart RoamLingo,"
        ],[
            "The technology also needs checking. Elmaadaway et al. (2025) studied reading",
            "aloud with Amazon Alexa. Hwang et al. (2023) used Smart RoamLingo,"
        ])
        swap_lines(d,6,[
            "Two coders often agreed (Cohen’s κ = 0.86), making the classification more",
            "reproducible. But that tells us little about who actually initiated actions, noticed",
            "mistakes, weighed feedback or decided how to rephrase an answer. Those actions"
        ],[
            "Two coders agreed closely (Cohen’s κ = 0.86), indicating consistent coding.",
            "That does not show who initiated actions, noticed mistakes, weighed feedback",
            "or decided how to rephrase an answer. Those actions"
        ])
        swap_lines(d,9,[
            "Hans Visser and ChatGPT worked together on this research review. Analysis, writing",
            "and visual presentation were developed collaboratively. The description below reflects",
            "Visser’s account of the workflow; it is not a complete log of every tool invocation."
        ],[
            "Hans Visser and ChatGPT collaborated on this research review. Its analysis,",
            "writing and presentation were developed jointly. This account reflects",
            "Visser’s description, not a complete record of the tools used."
        ])
        d.set_metadata({**d.metadata,
                        "title":"Research review of Zhang et al. (2026) - revised English edition"})
        staged=Path(td)/"staged.pdf"
        d.save(staged,garbage=4,deflate=True)
        d.close()
        d=fitz.open(staged)
        p=d[2]
        rects=find_lines(p,[
            "Figure 3. Each included study raises a different eligibility question; the cases should not be treated as",
            "equivalent. [1–7]"
        ])
        for r in rects:
            p.add_redact_annot(fitz.Rect(92,r.y0-0.7,506,r.y1+0.7),fill=(1,1,1))
        p.apply_redactions(images=0,graphics=0,text=0)
        font=fitz.Font(fontfile=SANS)
        p.insert_font(fontname="DVS",fontfile=SANS)
        for y,line in zip((615,625.4),(
            "Figure 3. Six studies require different checks of their eligibility.",
            "Those concern the learning outcome, technology or study design. [1–7]"
        )):
            width=font.text_length(line,fontsize=8)
            assert width<420
            p.insert_text(((595.3-width)/2,y),line,fontname="DVS",fontsize=8,
                          color=(95/255,108/255,120/255))
        verify(d)
        final=Path(td)/"final.pdf"
        d.save(final,garbage=4,deflate=True)
        d.close()
        os.replace(final,PATH)
    print("Validated definitive English PDF:",PATH.stat().st_size,"bytes")

if __name__=="__main__": main()
