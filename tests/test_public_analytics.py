"""Regression checks for public, privacy-limited analytics exports."""
import unittest
from datetime import datetime, timezone

from scripts import publish_web_analytics as analytics


START = datetime(2026, 11, 12, tzinfo=timezone.utc)
END = datetime(2026, 11, 14, tzinfo=timezone.utc)


def response():
    return {
        "data": {"viewer": {"accounts": [{
            "daily": [
                {"dimensions": {"date": "2026-11-12", "requestHost": "eaimodel.nl"},
                 "count": 20, "sum": {"visits": 9}},
                {"dimensions": {"date": "2026-11-12", "requestHost": "unrelated.nl"},
                 "count": 900, "sum": {"visits": 800}},
                {"dimensions": {"date": "2026-11-13", "requestHost": "www.eaimodel.nl"},
                 "count": 24, "sum": {"visits": 11}},
            ],
            "paths": [
                {"dimensions": {"requestHost": "eaimodel.nl", "requestPath": "/nl/"}, "count": 12, "sum": {"visits": 8}},
                {"dimensions": {"requestHost": "eaimodel.nl", "requestPath": "/tools/science-observatory/"}, "count": 6, "sum": {"visits": 3}},
                {"dimensions": {"requestHost": "eaimodel.nl", "requestPath": "/tools/person-name-and-private-link/"}, "count": 100},
                {"dimensions": {"requestHost": "eaimodel.nl", "requestPath": "/leif/continue/"}, "count": 110},
                {"dimensions": {"requestHost": "unrelated.nl", "requestPath": "/"}, "count": 200},
            ],
            "referrers": [
                {"dimensions": {"requestHost": "eaimodel.nl", "refererHost": "www.google.com"}, "count": 12},
                {"dimensions": {"requestHost": "eaimodel.nl", "refererHost": "private-school-portal.example"}, "count": 6},
                {"dimensions": {"requestHost": "eaimodel.nl", "refererHost": "eaimodel.nl"}, "count": 400},
            ],
        }]}}
    }


class PublicAnalyticsTests(unittest.TestCase):
    def test_sitemap_only(self):
        self.assertIn("/nl/", analytics.PUBLIC_PATHS)
        self.assertEqual(analytics.public_path("/nl/"), "/nl/")
        self.assertEqual(analytics.public_path("/tools/person-name-and-private-link/"), None)
        self.assertEqual(analytics.public_path("/leif/continue/"), None)
        self.assertEqual(analytics.public_path("/nl/user?token=secret"), None)

    def test_public_aggregates_and_no_raw_internal_referer(self):
        result = analytics.summarize(response(), START, END)
        self.assertEqual(result["views"], 44)
        self.assertEqual(result["visits"], 20)
        self.assertEqual(len(result["daily"]), 2)
        self.assertEqual(result["daily"][0]["date"], "2026-11-12")
        self.assertEqual(result["daily"][1]["visits"], 11)
        self.assertEqual([p["path"] for p in result["pages"]], ["/nl/", "/tools/science-observatory/"])
        self.assertEqual([p["visits"] for p in result["pages"]], [8, 3])
        self.assertNotIn("unique_visitors", result)
        self.assertNotIn("bounce_rate", result)
        self.assertNotIn("clicks", result)
        self.assertEqual(result["referrers"], [
            {"host": "Zoekmachines", "views": 12},
            {"host": "Andere websites", "views": 6},
        ])
        serialized = str(result)
        self.assertNotIn("private-school-portal", serialized)
        self.assertNotIn("person-name", serialized)
        self.assertNotIn("unrelated.nl", serialized)

    def test_cloudflare_errors_cannot_be_published(self):
        with self.assertRaises(ValueError):
            analytics.summarize({"errors": [{"message": "No authorization"}]}, START, END)

    def test_missing_measurements_are_not_reported_as_zero(self):
        data = response()
        data["data"]["viewer"]["accounts"][0]["daily"] = []
        with self.assertRaises(ValueError):
            analytics.summarize(data, START, END)

    def test_invalid_counters_rejected(self):
        data = response()
        data["data"]["viewer"]["accounts"][0]["daily"][0]["count"] = -1
        with self.assertRaises(ValueError):
            analytics.summarize(data, START, END)


if __name__ == "__main__":
    unittest.main()
