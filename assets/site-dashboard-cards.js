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
  const detail = main.querySelector("#eai-dash-step-detail");
  const steps = [...main.querySelectorAll("[data-dash-step]")];
  steps.forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.dashStep);
    if (!Number.isInteger(index) || !explain[index] || !detail) return;
    steps.forEach(step => step.setAttribute("aria-pressed", String(step === button)));
    const [label, description] = explain[index];
    detail.textContent = label + ": " + description;
  }));
})();