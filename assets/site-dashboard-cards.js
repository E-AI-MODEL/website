/* Progressive enhancement for the EAI dashboard index. Other pages never load this script. */
(() => {
  "use strict";
  const main = document.querySelector("main.eai-dashboard-home");
  if (!main) return;
  const explain = [
    ["Proces", "Wat wil je bereiken en welke stappen horen daarbij?"],
    ["Fase", "Waar bevindt iemand zich in het leer- of werkproces?"],
    ["Handeling", "Welke betekenisvolle keuze of denkstap blijft bij de mens?"],
    ["AI", "Wat kan AI in deze fase ondersteunen, zonder het leer- of denkwerk ongemerkt over te nemen?"]
  ];
  const en = document.documentElement.lang.toLowerCase().startsWith("en");
  const stepsEn = [
    ["Process", "What is the goal, and which steps lead there?"],
    ["Stage", "Where is the person in the learning or work process?"],
    ["Core action", "Which meaningful decision or reasoning step should remain human?"],
    ["AI", "What can AI support here without silently taking over essential work?"]
  ];
  const stepExplanations = en ? stepsEn : explain;
  const detail = main.querySelector("#eai-dash-step-detail");
  const steps = [...main.querySelectorAll("[data-dash-step]")];
  steps.forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.dashStep);
    if (!Number.isInteger(index) || !stepExplanations[index] || !detail) return;
    steps.forEach(step => step.setAttribute("aria-pressed", String(step === button)));
    const [label, description] = stepExplanations[index];
    detail.textContent = label + ": " + description;
  }));
})();