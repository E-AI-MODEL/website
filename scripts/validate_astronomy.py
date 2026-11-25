"""Independent numerical checks; no fit to observational data is performed.
Run with the pinned benchmark requirements. Writes machine-readable and human-
readable results, including residuals outside reported uncertainty intervals.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

import astropy
from astropy import units as u
from astropy.coordinates import Distance, SkyCoord
import galpy
from galpy.potential import (
    HernquistPotential, MiyamotoNagaiPotential, NFWPotential, MWPotential2014,
    vcirc, epifreq,
)
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "test-results/astronomy")
OUTPUT.mkdir(parents=True, exist_ok=True)
FIXTURE = ROOT / "tests/fixtures/astronomy-rotation-curves.json"
source = json.loads(FIXTURE.read_text(encoding="utf-8"))
raw = json.loads(subprocess.check_output(
    ["node", str(ROOT / "scripts/extract_astronomy_benchmark.mjs")],
    cwd=ROOT, text=True,
))
assert raw["sha256"]["fixture"] == hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
G = raw["constants"]["G"]
assert abs(G - 4.30091e-6) < 1e-12
failures = []


def ensure(condition, message):
    if not condition:
        failures.append(message)


def rel_error(actual, reference):
    return abs(actual-reference) / max(abs(reference), 1e-15)


def galpy_potentials(params):
    # Natural units: ro=1 kpc and vo=1 km/s. The amplitudes thus have
    # numerical units G*M/(ro*vo**2). Use the application's G so we
    # compare equations rather than slightly different physical constants.
    # The independent implementation defines Hernquist amp as twice
    # total mass. NFW amp represents M200 / f(concentration).
    c = 10.
    f_c = math.log1p(c) - c/(1+c)
    mh = params["halo"] * 1e12
    kwargs = dict(ro=1., vo=1.)
    return [
        MiyamotoNagaiPotential(amp=G*params["disk"]*1e10,
                              a=2.6, b=.28, **kwargs),
        HernquistPotential(amp=2*G*params["bulge"]*1e10,
                           a=.6, **kwargs),
        NFWPotential(amp=G*mh/f_c,
                     a=210*(mh/1e12)**(1/3)/c, **kwargs),
    ]


case_reports = []
all_checks = 0
for case in raw["cases"]:
    pots = galpy_potentials(case["params"])
    maxima = dict.fromkeys(["disk", "bulge", "halo", "total", "period_myr", "q"], 0.)
    for row in case["rows"]:
        r = row["radius"]
        expected = {key: float(vcirc(pot, r, use_physical=False))
                    for key, pot in zip(["disk", "bulge", "halo"], pots)}
        expected["total"] = float(vcirc(pots, r, use_physical=False))
        expected["period_myr"] = (
            2 * math.pi * r * u.kpc / (expected["total"] * u.km/u.s)
        ).to_value(u.Myr)
        # Check the website's illustrative exponential-surface-density Q
        # using galpy's independent epicyclic frequency, not finite
        # differences copied from the website. This is not a claim that
        # the true stellar disk is razor-thin.
        kappa = float(epifreq(pots, r, use_physical=False))
        sigma_surface = case["params"]["disk"]*1e10/(2*math.pi*2.6**2)*math.exp(-r/2.6)
        expected["q"] = case["params"]["sigma"]*kappa/(3.36*G*sigma_surface)
        for key, value in expected.items():
            actual = float(row[key])
            ensure(math.isfinite(actual) and math.isfinite(value),
                   f"nonfinite {case['id']}/{r}/{key}")
            maxima[key] = max(maxima[key], rel_error(actual, value))
            all_checks += 1
    for key, value in maxima.items():
        # Q uses a 0.02 kpc central derivative in JavaScript. Period
        # uses a rounded physical conversion constant. These are not
        # identical implementations, hence separate thresholds.
        tolerance = {"period_myr": 1e-6, "q": 1e-3}.get(key, 1e-9)
        ensure(value <= tolerance, f"{case['id']} {key}: {value} > {tolerance}")
    case_reports.append({"case": case["id"], "radii": len(case["rows"]),
                         "max_relative_error": maxima})

# Independent astrometric geometry. Input coordinates are the same published
# snapshot; this checks conversion, not the catalog's measurement accuracy.
coords = {}
star_errors = {"distance_ly": 0., "cartesian_ly": 0.,
               "angle_deg": 0., "separation_ly": 0., "distance_bounds_ly": 0.}
for s in raw["stars"]:
    distance = Distance(parallax=s["parallax_mas"]*u.mas)
    sc = SkyCoord(s["ra_hms"], s["dec_dms"], unit=(u.hourangle,u.deg),
                  frame="icrs", distance=distance)
    coords[s["id"]] = sc
    star_errors["distance_ly"] = max(star_errors["distance_ly"],
        abs(s["distance_ly"]-distance.to_value(u.lyr)))
    star_errors["cartesian_ly"] = max(star_errors["cartesian_ly"],
        float(np.linalg.norm(np.asarray(s["xyz_ly"])-sc.cartesian.xyz.to_value(u.lyr))))
    lower = Distance(parallax=(s["parallax_mas"]+s["parallax_error_mas"])*u.mas).to_value(u.lyr)
    upper = Distance(parallax=(s["parallax_mas"]-s["parallax_error_mas"])*u.mas).to_value(u.lyr)
    star_errors["distance_bounds_ly"] = max(star_errors["distance_bounds_ly"],
        abs(lower-s["lower_ly"]), abs(upper-s["upper_ly"]))
for pair in raw["pairs"]:
    a, b = coords[pair["a"]], coords[pair["b"]]
    star_errors["angle_deg"] = max(star_errors["angle_deg"],
        abs(pair["angle_deg"]-a.separation(b).degree))
    star_errors["separation_ly"] = max(star_errors["separation_ly"],
        abs(pair["separation_ly"]-a.separation_3d(b).to_value(u.lyr)))
for key, value in star_errors.items():
    ensure(value <= (1e-8 if key=="angle_deg" else 1e-4),
           f"Astropy {key}: {value}")
ensure(len(coords)==9 and len(raw["pairs"])==36, "stellar sample size changed")

# Observational test: fixed default settings, no fitting, no unit rescaling.
# Bovy's MWPotential2014 is a useful established analytic reference, not a
# claim that a whole application is superior. Keep its native 8 kpc/220 km/s.
base = raw["cases"][0]
assert base["id"]=="default"
by_radius = {row["radius"]:row for row in base["rows"]}
comparison = []


def metrics(rows, key):
    err = np.array([r[key]-r["observed_kms"] for r in rows])
    obs = np.array([r["observed_kms"] for r in rows])
    return {
        "n":len(rows), "mae_kms":float(np.mean(np.abs(err))),
        "rmse_kms":float(np.sqrt(np.mean(err**2))),
        "mape_percent":float(np.mean(np.abs(err/obs))*100),
        "bias_kms":float(np.mean(err)),
        "max_abs_kms":float(np.max(np.abs(err))),
        "within_reported_interval":sum(
            r["observed_kms"]-r["lower_error_kms"] <= r[key]
            <= r["observed_kms"]+r["upper_error_kms"] for r in rows),
    }


for series in source["series"]:
    rows = []
    for r,v,lo,hi in series["rows"]:
        rows.append(dict(series=series["id"],radius_kpc=r,observed_kms=v,
            lower_error_kms=lo,upper_error_kms=hi,
            eai_kms=by_radius[r]["total"],
            mwpotential2014_kms=float(vcirc(MWPotential2014,r/8.,use_physical=False)*220.)))
    comparison.append({"id":series["id"],"citation":series["citation"],
        "doi":series["doi"],"error_kind":series["error_kind"],
        "eai":metrics(rows,"eai_kms"),"mwpotential2014":metrics(rows,"mwpotential2014_kms"),
        "rows":rows})

report = {
    "schema":"eai.astronomy.validation.v1",
    "source_sha256":raw["sha256"],"versions":{"galpy":galpy.__version__,"astropy":astropy.__version__,
    "numpy":np.__version__},"model":raw["base"],"equation_checks":all_checks,
    "numerical_status":"pass" if not failures else "fail",
    "galpy_cases":case_reports,"astropy":{"stars":len(coords),"pairs":len(raw["pairs"]),
    "max_absolute_errors":star_errors},"observations":comparison,"failures":failures,
    "limitations":[
        "Numerical agreement validates implementation of specified equations, not completeness of physical models.",
        "Default EAI and MWPotential2014 compared without fitting, at printed physical radii; source studies use somewhat different solar parameters and tracer populations.",
        "Reported intervals are different types, with correlated or incomplete systematic uncertainties; no chi-square or coverage probability is inferred.",
        "Galactic synthetic populations, visual rendering, S2 relativistic corrections, stellar motion over millennia, and browser performance are not validated by this test.",
        "No claim of overall superiority over competitors is implied.",
    ],
}
(OUTPUT/"report.json").write_text(json.dumps(report,indent=2,allow_nan=False)+"\n",encoding="utf-8")
rows=[r for s in comparison for r in s["rows"]]
with (OUTPUT/"rotation-residuals.csv").open("w",newline="",encoding="utf-8") as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)

lines=[
    "# Astronomy validation", "",
    f"Numerical implementation: **{report['numerical_status'].upper()}**.",
    f"{all_checks:,} comparisons with galpy {galpy.__version__}; "
    f"{len(coords)} stellar positions and {len(raw['pairs'])} pairs with Astropy {astropy.__version__}.",
    "", "## Rotation curve: fixed models against observations", "",
    "| Study | Model | n | MAE km/s | RMSE km/s | MAPE | Bias km/s | Inside published interval |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for s in comparison:
    for key,label in [("eai","EAI"),("mwpotential2014","MWPotential2014")]:
        m=s[key]
        lines.append(f"| [{s['id']}]({s['doi']}) | {label} | {m['n']} | {m['mae_kms']:.2f} | {m['rmse_kms']:.2f} | {m['mape_percent']:.2f}% | {m['bias_kms']:+.2f} | {m['within_reported_interval']}/{m['n']} |")
lines += ["","## Independent equation check","",
          "| Quantity | Maximum relative difference (all cases) |",
          "|---|---:|"]
for key in case_reports[0]["max_relative_error"]:
    value=max(c["max_relative_error"][key] for c in case_reports)
    lines.append(f"| {key} | {value:.3e} |")
lines += ["","## Stellar geometry","",
          "| Quantity | Maximum absolute difference |","|---|---:|"]
for key,value in star_errors.items():
    lines.append(f"| {key} | {value:.3e} |")
lines += ["","## Scope and limitations",""]+["- "+x for x in report["limitations"]]
if failures:
    lines += ["","## Failed numerical checks",""]+["- "+x for x in failures]
lines += ["","## Reproducibility","","Exact HTML and fixture SHA-256 hashes are recorded in report.json.",""]
summary="\n".join(lines)
(OUTPUT/"report.md").write_text(summary,encoding="utf-8")
print(summary)
if failures:
    sys.exit(1)
