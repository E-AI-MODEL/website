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
  browser.close()
if __name__=="__main__":main()
