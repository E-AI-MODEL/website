// Optionele GitHub Actions-controle voor het project van de gebruiker.
// De website activeert niets in een repository: de eigenaar moet dit bestand zelf goedkeuren en toevoegen.
export function availableProjectChecks(archive){
 const files=archive?.eligible||[];
 return {
  javascript:files.some(p=>/\.[cm]?js$/i.test(p)),
  python:files.some(p=>/\.py$/i.test(p)),
  hasLintScript:Boolean(archive?.manifest?.scripts&&typeof archive.manifest.scripts.lint==="string"),
  hasTestScript:Boolean(archive?.manifest?.scripts&&typeof archive.manifest.scripts.test==="string")
 };
}
export function generateProjectCheckWorkflow(archive){
 const checks=availableProjectChecks(archive);
 if(!checks.javascript&&!checks.python)return null;
 const lines=[
  "# Alleen activeren na beoordeling door de eigenaar van deze repository.",
  "# De acties voeren geen projectcode uit. Ze controleren uitsluitend syntaxis.",
  "# Werkende functionaliteit en veiligheid worden hiermee niet bewezen.",
  "name: Projectcontrole",
  "on:",
  "  push:",
  "  pull_request:",
  "permissions:",
  "  contents: read",
  "jobs:",
  "  syntax:",
  "    runs-on: ubuntu-24.04",
  "    timeout-minutes: 8",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "        with:",
  "          persist-credentials: false"
 ];
 if(checks.javascript){
  lines.push(
   "      - name: Controleer JavaScript-syntaxis",
   "        shell: bash",
   "        run: |",
   "          set -euo pipefail",
   "          while IFS= read -r -d '' file; do",
   "            node --check \"$file\"",
   "          done < <(find . -type f \\( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \\) -not -path './node_modules/*' -not -path './.git/*' -print0)"
  );
 }
 if(checks.python){
  lines.push(
   "      - name: Controleer Python-syntaxis zonder import, bytecode of uitvoering",
   "        shell: bash",
   "        run: |",
   "          set -euo pipefail",
   "          while IFS= read -r -d '' file; do",
   "            python3 -I -c 'import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding=\"utf-8\"), filename=sys.argv[1])' \"$file\"",
   "          done < <(find . -type f -name '*.py' -not -path './.git/*' -not -path './.venv/*' -not -path './venv/*' -not -path './node_modules/*' -print0)"
  );
 }
 lines.push(
  "",
  "# Let op: HTML/CSS, TypeScript, afhankelijkheden en functies zijn niet inhoudelijk getest.",
  "# Een bestaande lint- of testopdracht wordt niet automatisch uitgevoerd:",
  "# zulke opdrachten kunnen code of installatiescripts uitvoeren."
 );
 return lines.join("\n")+"\n";
}
