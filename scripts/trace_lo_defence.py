"""Controleer bewegingsrollen rond passes in kleine partijen.

Drukt alleen geselecteerde tijdstippen af; bevat geen gegevens van leerlingen.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML=Path(__file__).resolve().parents[1]/"tools/lo-aanvalslab/index.html"
JS=r"""({scene,seed})=>{
 const lab=window.__loLabTest,p=lab.scenario(scene),out=lab.run(p,seed),fs=lab.getFrames();
 const rounded=v=>Math.round(v*10)/10;
 return {result:out.result,duration:out.duration,
  events:lab.getEvents().slice(0,12).map(e=>[e.time,e.kind]),
  samples:fs.filter((f,i)=>i%10===0&&f.time<=4.6).map(f=>({
   t:rounded(f.time),
   ball:[rounded(f.ball.x),rounded(f.ball.y)],
   holder:f.holder,
   defenders:f.players.filter(p=>p.team==='d').map(p=>({
    id:p.id,x:rounded(p.x),y:rounded(p.y),role:p._defenceRole
   }))
  }))
 };
}"""
def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  page=browser.new_page()
  page.goto(HTML.as_uri(),wait_until="domcontentloaded")
  page.locator('[data-mode="free"]').click()
  for sport in range(4):
   page.select_option("#sportSelect",str(sport))
   for form in (0,2):
    page.select_option("#formationSelect",str(form))
    for scene in (0,1):
     result=page.evaluate(JS,{"scene":scene,"seed":1337})
     print("DEFENCE_TRACE "+json.dumps({"sport":sport,"form":form,"scene":scene,**result},
      ensure_ascii=False,separators=(",",":")))
     if form==2 and scene==0:
      flight=[q for q in result["samples"] if q["holder"] is None and .65<=q["t"]<=2]
      screens={p["id"] for q in flight for p in q["defenders"] if p["role"]=="screen"}
      assert len(screens)<=1,("drukzetter wisselt midden in balvlucht",sport,screens)
      # De dieper geplaatste d1 mag een diepe pass niet gaan najagen
      # richting de passer. Bij een versnelling kan hij kort uitlopen.
      starter=result["samples"][0]["defenders"][1]["x"]
      for q in flight:
       end=next(p["x"] for p in q["defenders"] if p["id"]=="d1")
       assert end>=starter-2.0*({"0":20,"1":21,"2":22,"3":31}[str(sport)]),(
        "diepe rugdekker verlaat doelzijde bij pass",sport,q)

  browser.close()
if __name__=="__main__":main()
