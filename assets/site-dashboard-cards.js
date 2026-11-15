/* Progressive enhancement for the EAI dashboard index. Other pages never load this script. */
(() => {
  "use strict";
  const main = document.querySelector("main.eai-dashboard-home");
  if (!main) return;
  const routes = [...main.querySelectorAll(".eai-landing-route[data-dash-kind]")];
  const controls = [...main.querySelectorAll("[data-dash-filter]")];
  const search = main.querySelector("#eai-dash-search");
  const empty = main.querySelector("#eai-dash-empty");
  let category = "all";

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl");
  function filterRoutes() {
    const q = normalize(search?.value.trim());
    let visible = 0;
    routes.forEach(route => {
      const text = normalize(route.dataset.dashSearch + " " + route.textContent);
      const matches = (category === "all" || route.dataset.dashKind === category) &&
        (!q || text.includes(q));
      route.hidden = !matches;
      if (matches) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
  }
  controls.forEach(button => button.addEventListener("click", () => {
    category = button.dataset.dashFilter;
    controls.forEach(control => control.setAttribute("aria-pressed", String(control === button)));
    filterRoutes();
  }));
  search?.addEventListener("input", filterRoutes);

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