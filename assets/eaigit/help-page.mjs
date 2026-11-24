import {HELP_CATEGORIES,getHelpTopic} from "./help-topics.mjs";
const host=document.getElementById("helpCategories");
function element(tag,className="",content=""){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(content)el.textContent=content;
 return el;
}
for(const group of HELP_CATEGORIES){
 const section=element("section","eg-help-group");
 section.id=group.id==="start"?"githubTopics":group.id==="chatgpt"?"chatgptTopics":"projectTopics";
 const title=element("h3","",group.title);section.append(title);
 for(const key of group.topics){
  const topic=getHelpTopic(key);if(!topic)continue;
  const details=element("details","eg-help-topic");details.id="uitleg-"+key;
  const summary=element("summary","",topic.title);details.append(summary);
  const content=element("div","eg-help-content");
  content.append(element("p","",topic.intro));
  const ol=element("ol");
  for(const step of topic.steps)ol.append(element("li","",step));
  content.append(ol);
  if(topic.links?.length){
   const links=element("div","eg-help-links");
   for(const item of topic.links){
    const link=element("a","",item.label);
    link.href=item.url;link.target="_blank";link.rel="noopener noreferrer";
    links.append(link);
   }
   content.append(links);
  }
  details.append(content);section.append(details);
 }
 host.append(section);
}
function showHash(){
 const id=decodeURIComponent(location.hash.slice(1));
 if(!id)return;
 const chosen=document.getElementById(id);
 if(chosen?.tagName==="DETAILS")chosen.open=true;
}
window.addEventListener("hashchange",showHash);
showHash();
