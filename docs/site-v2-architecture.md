# EAI website v2 — information architecture & editorial frame

Status: working document for the `site-migration` branch.

## Goal

The site is not a museum of previous EAI versions and not a directory of tools.
It should help a visitor move from a concrete educational question to:
1. a sharper way of looking;
2. a usable workform;
3. an example or tool;
4. deeper reading where useful.

The article *De vraag die we vergeten in het AI-debat* sets the editorial voice:
recognisable situation first, then the educational question, then the concept.

## Source priority

For public copy, use sources in this order:

1. current EAI Standard / Core semantics for canonical concepts;
2. current workshop materials for workforms and practical flow;
3. current EAI Classroom / EAI Hub / EAI Prompt implementations for examples;
4. existing publications for theory and provenance;
5. older GAMMA / model material only as historical or supporting source, never as an unqualified current public layer.

Do not expose version archaeology to ordinary visitors.

## Language policy

Dutch is the default prose language.

Keep established English terms in English when they name a concept, method, product or publication. Examples:
- Justification Mapping
- Task Density
- Reverse Scaffolding
- Didactic Controllability
- EAI Core
- EAI Classroom
- EAI Hub
- Prompt Builder

On first use, a short Dutch explanation can follow in parentheses where that helps.
Do not translate canonical English terminology just for stylistic consistency.

## Main navigation

- Home
- Twee pijlers
- Workshop AI
- Werkvormen
- Praktijk
- Publicaties
- Tools

Contact is a secondary action.

## Home

### Hero
**Twee pijlers voor AI in onderwijs**

The two pillars must be immediately visible and equally weighted:

1. **Hoe leren werkt**
2. **Hoe taalmodellen werken**

The bridge question sits between them:
**welke menselijke handeling moet hier betekenis krijgen, en wat doet AI precies op die plek?**

Primary actions:
- Bekijk de twee pijlers
- Naar Workshop AI

### Section: de verbinding
Use the article's order as the public route:
1. Proces
2. Fase / process position
3. Kernhandeling / core human action
4. AI action
5. Human evidence where a claim about learning or human performance is needed

Do not start the public explanation with model architecture.

### Section: meteen proberen
Three workforms:
- Justification Mapping
- Wie doet welk denkwerk?
- Bewijs van leren

### Section: zo ziet het eruit
Cards linking out to:
- EAI Classroom
- EAI Hub
- Prompt Builder

These are examples/implementations, not the definition of EAI.

### Section: lezen
Feature:
- De vraag die we vergeten in het AI-debat

Then selected existing publications.

## Twee pijlers

Editorial question:
**Wat verandert er wanneer wat we weten over leren botst met wat AI inmiddels kan uitvoeren?**

Pijler 1 explains how learning and human professional action work.
Pijler 2 explains enough about language models and AI systems to see where work can shift.
The public EAI route begins where those two knowledge bases meet.

Explain, in ordinary language:
- context and goal;
- actor;
- process position;
- core human action;
- observed AI action;
- allocation;
- human evidence;
- handback / re-demonstration where needed.

Use current EAI Standard semantics. Do not lead with GAMMA.

Every concept section ends with:
- Probeer dit
- Voorbeeld
- Verdieping

## Workshop AI

Landing page based on the existing three-workshop sequence:

### Workshop 1 — Twee pijlers voor AI in onderwijs
Learning and language models. Output is not evidence of learning.

### Workshop 2 — Wie doet welk (denk)werk?
Task Density, division of cognitive work, core action, evidence.

### Workshop 3 — Van inzicht naar ontwerp
Process position, action, visibility, boundaries and redesign.

The page links to the individual workforms rather than embedding a PDF dump.

## Werkvormen

Every workform follows the same template:

1. **Wanneer gebruik je dit?**
2. **De vraag**
3. **Zo werkt het**
4. **Werk met een eigen taak**
5. **Wat moet zichtbaar worden?**
6. **Voorbeeld**
7. **Ga verder** — relevant publication, tool or implementation.

Initial set:
- Justification Mapping
- Task Density scan
- Kernhandeling / core action check
- Bewijs van leren
- First attempt
- Foutanalyse
- Version comparison
- AI-logboek
- Toollab: dezelfde vraag in twee omgevingen

## Justification Mapping

This is explicitly the workshop workform Anouk referred to.

Purpose:
make the reasoning behind a choice visible, not merely the final choice.

Do not redefine it as the UU method-choice card.
Use the EAI workshop meaning: process accountability around a choice, including alternatives, criteria, evidence and why the chosen route fits.

Suggested interaction:
- Welke keuze moest jij maken?
- Welke alternatieven waren serieus mogelijk?
- Welke criteria gebruikte je?
- Welk bewijs woog mee?
- Wat sprak tegen je keuze?
- Waarom koos je uiteindelijk deze route?
- Wat zou je keuze kunnen veranderen?

Output:
a compact map that can be discussed, compared or submitted as human evidence.

## Praktijk

Not a sales page. A set of examples showing what EAI ideas look like in systems.

### EAI Classroom
Short new introduction in the same editorial voice.
Show the relation between lesson preparation, success criteria, misconceptions, interventions and evidence.
External link to the live application.

### EAI Hub
Short new introduction.
Show how process, support and visibility are brought together.
External link to the live application.

### Prompt Builder
Use the recent Prompt Builder as the clearest example that wording is not neutral:
a prompt encodes choices about task, role, context and what the AI is allowed to do.
External link to the current implementation.

## Publicaties

Featured first:
### De vraag die we vergeten in het AI-debat
Publish as stable HTML and provide the PDF as secondary format.
Canonical path:
`/publicaties/de-vraag-die-we-vergeten/`

Keep the original voice and structure.

Existing publications stay available but receive new introductions where necessary so the catalogue reads as one site rather than a migration archive.

## Tools

Tools are grouped by the question they help with, not by project chronology.

Suggested groups:
- Begrijpen / analyseren
- Ontwerpen
- Uitproberen
- Verdiepen

Each tool card says:
- what question it helps answer;
- what it does not prove;
- whether it opens another EAI application.

## Editorial pattern

Avoid:
- generic AI optimism/pessimism;
- product language;
- version labels in normal prose;
- unnecessary model acronyms;
- anthropomorphic AI language;
- claims that a tool proves learning.

Prefer:
- one concrete educational situation;
- one precise question;
- ordinary Dutch;
- short paragraphs;
- examples from teaching;
- an action the reader can try immediately.

A typical page rhythm:

> concrete situation  
> what changes here?  
> name the concept  
> show the distinction  
> try it on your own task  
> link to a workform/tool  
> offer deeper reading

## Design / wireframe rule

The wireframe is an internal build step, not a separate approval gate.

Visual hierarchy:
- generous white/cream space;
- editorial typography rather than dashboard aesthetics;
- one accent colour;
- wide reading column for articles;
- compact cards only for actions/workforms;
- diagrams only when they clarify a distinction;
- no decorative AI imagery.

Desktop and mobile should preserve the same reading order.

## Migration rule

Do not merge to `main` until:
- navigation works;
- all featured internal links resolve;
- external EAI application URLs are verified;
- article page is complete;
- mobile layout is checked;
- old Google Site links that matter have redirects.


## Visual source of truth

The visual reference for the public website is the PDF **De vraag die we vergeten in het AI-debat**.

Use its design grammar:
- white editorial pages;
- dark blue-grey typography;
- strong sans-serif display headings;
- serif body copy for long reading;
- coral-red marks and short divider lines;
- warm paper callouts;
- sparse navy line illustrations with a single coral focal point;
- large areas of whitespace, but not excessive vertical padding.

The round EAI logo remains the brand mark in navigation, favicon and footer. It does **not** determine the page palette.

### Reading and scroll rhythm

Do not solve long pages by shrinking all text or by adding scroll-snap / animated text.

Instead:
- keep long-form body copy around 16–17 px with a narrow reading measure;
- reduce oversized display headings by roughly 10–15% compared with the first migration draft;
- shorten vertical section spacing;
- insert a meaningful diagram, pull question or workform after several paragraphs where the source supports it;
- provide a compact reading route at the top of long publications;
- preserve a normal continuous document scroll.

The purpose is to make the site read like an EAI publication, not like a slide deck or app dashboard.
