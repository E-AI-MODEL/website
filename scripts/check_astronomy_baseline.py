"""Compare a fresh numerical report to the reviewed PR 396 measurement."""
import json
import math
from pathlib import Path
import sys

BASELINE = Path(__file__).resolve().parents[1] / "tests/fixtures/astronomy-baseline.json"


def check(report, baseline):
    def require(ok, label):
        if not ok:
            raise ValueError(label)

    def ceiling(actual, reference, slack, label):
        require(math.isfinite(actual) and abs(actual) <= abs(reference) + slack, label)

    require(report["numerical_status"] == "pass" and not report["failures"], "Numerieke validatie")
    require(report["source_sha256"]["fixture"] == baseline["source_sha256"]["fixture"], "Meetgegevens gewijzigd")
    require(report["versions"] == baseline["versions"], "Versies van referentiesoftware")
    require(report["equation_checks"] >= baseline["equation_checks"], "Minder vergelijkingen")
    actual = {c["case"]: c for c in report["galpy_cases"]}
    require(len(actual) == len(report["galpy_cases"]), "Dubbele modelinstelling")
    for original in baseline["galpy_cases"]:
        case = actual[original["case"]]
        require(case["radii"] >= original["radii"], "Minder meetstralen")
        for key, value in original["max_relative_error"].items():
            ceiling(case["max_relative_error"][key], value, max(1e-12, value * .001), key)
    stars = report["astropy"]
    for key in ("stars", "pairs"):
        require(stars[key] >= baseline["astropy"][key], key)
    for key, value in baseline["astropy"]["max_absolute_errors"].items():
        ceiling(stars["max_absolute_errors"][key], value, max(1e-10, value * .001), key)
    studies = {s["id"]: s["eai"] for s in report["observations"]}
    require(set(studies) == set(baseline["observations"]), "Ontbrekende meetreeks")
    for name, reference in baseline["observations"].items():
        result = studies[name]
        require(result["n"] == reference["n"], name + " meetpunten")
        require(result["within_reported_interval"] >= reference["within_reported_interval"], name + " intervallen")
        for key in ("mae_kms", "rmse_kms", "bias_kms", "max_abs_kms", "mape_percent"):
            ceiling(result[key], reference[key], 1e-6, name + " " + key)


if __name__ == "__main__":
    check(json.loads(Path(sys.argv[1]).read_text()), json.loads(BASELINE.read_text()))
