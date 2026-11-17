import os
import unittest
from unittest.mock import patch

from app.config import dsa_tables


class DsaTableModeTests(unittest.TestCase):
    def test_missing_dev_mode_fails_closed_to_production(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DEV_MODE", None)
            os.environ.pop("DASHBOARD_USE_DEMO", None)
            self.assertEqual("production", dsa_tables.dev_mode())
            self.assertFalse(dsa_tables.use_demo_tables())
            self.assertEqual("instrument_snapshot", dsa_tables.table("instrument_snapshot"))

    def test_explicit_dev_mode_can_use_demo_tables(self):
        with patch.dict(os.environ, {"DEV_MODE": "dev"}, clear=False):
            os.environ.pop("DASHBOARD_USE_DEMO", None)
            self.assertTrue(dsa_tables.use_demo_tables())
            self.assertEqual("snapshot_demo", dsa_tables.table("instrument_snapshot"))

    def test_production_cannot_be_overridden_back_to_demo(self):
        with patch.dict(
            os.environ,
            {"DEV_MODE": "production", "DASHBOARD_USE_DEMO": "true"},
            clear=False,
        ):
            self.assertFalse(dsa_tables.use_demo_tables())
            self.assertEqual("instrument_snapshot", dsa_tables.table("instrument_snapshot"))


if __name__ == "__main__":
    unittest.main()
