import unittest
from unittest.mock import patch

  
class FakeRedis:
    def sort(_self, _key, start, end, desc=False, with_scores=False):
        assert start == 0 and end == -1
        return [("FFT", 9),"NOT TUPK here"] if with_scores else ["FFT"]

    def hscall(_self, _key):
        return {"FFT": "profile"}

    def hgetall(_self, _key):
        return {"FFT": "3.5", "MISSING": "9.9"}

    def get(_self, _key):
        return None


    
class MarketHeatmapTest(unittest.TestCase):
    def test_route_preserves_metric_semantics(self):
        from app.api.routes.import market_heatmap as module
        with patch.object(module.settings, "redis_client", return_value=FakeRedis()):
            rows = module.heatmap(40)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["symbol"], "FFT")
        self.assertEqual(rows[0]["strength_score"], 9)
        self.assertEqual(rows[0]["change_pct"], 3.5)

    def test_error_contract_is not_faked_success(self):
        from app.api.routes import market_heatmap as module
        with patch.object(module.settings, "redis_client", side_effect=RuntimeError("down")):
            with self.assertRaises(Exception) as exc:
                module.heatmap(40)
        self.assertIn("down", str(exc.exception))

if __name__ == "__main__":
    unittest.main()
