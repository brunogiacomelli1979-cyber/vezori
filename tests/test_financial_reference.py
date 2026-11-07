"""Independent standard-library reference. Synthetic prices never leave tests."""
import json
import math
from pathlib import Path
import statistics
import subprocess
import unittest
from datetime import date, timedelta

class IndependentFinanceReference(unittest.TestCase):
    def test_price_metrics_against_python_reference(self):
        prices=[100*math.exp(.0002*i+.03*math.sin(i/4)) for i in range(121)]
        series={"symbol":"TEST","market":"CRYPTO","currency":"BRL","interval":"1d","provider":"test only","priceBasis":"test only",
                "points":[{"date":str(date(2024,1,1)+timedelta(days=i)),"close":p} for i,p in enumerate(prices)]}
        code="""
import {analyzeAssetRisk} from './public/risk-analytics.js';
import {analyzeExtendedRisk} from './public/risk-metrics.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const s=JSON.parse(input);console.log(JSON.stringify({...analyzeAssetRisk(s),...analyzeExtendedRisk(s,{targetAnnualPct:0,targetCurrency:'BRL'})}));
"""
        result=subprocess.run(['node','--input-type=module','-e',code],input=json.dumps(series),text=True,capture_output=True,check=True,cwd=Path(__file__).resolve().parents[1])
        actual=json.loads(result.stdout)
        returns=[b/a-1 for a,b in zip(prices,prices[1:])]
        peak=prices[0];drawdown=0
        for p in prices:
            peak=max(peak,p);drawdown=max(drawdown,(peak-p)/peak*100)
        ordered=sorted(returns);cut=(len(returns)-1)*.05;lo=math.floor(cut)
        threshold=ordered[lo]+(ordered[math.ceil(cut)]-ordered[lo])*(cut-lo)
        downside=math.sqrt(sum(min(r,0)**2 for r in returns)/len(returns))
        expected={"returnPct":100*(prices[-1]/prices[0]-1),"maxDrawdownPct":drawdown,
                  "volatilityAnnualPct":statistics.stdev(returns)*math.sqrt(365)*100,
                  "sortino":statistics.mean(returns)/downside*math.sqrt(365),
                  "historicalVaR95DailyPct":max(0,-threshold)*100,
                  "historicalCVaR95DailyPct":max(0,-statistics.mean(r for r in returns if r<=threshold))*100}
        for key,value in expected.items():
            with self.subTest(metric=key):self.assertAlmostEqual(actual[key],value,places=7)

if __name__=='__main__':unittest.main()
