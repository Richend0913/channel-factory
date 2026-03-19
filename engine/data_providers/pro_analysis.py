"""
Professional-grade technical analysis engine for GOLD DATA LAB.
Implements: Market Structure, Order Blocks, FVG, Liquidity Zones,
RSI Divergence, Multi-TF Analysis, Confluence Scoring.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class SwingPoint:
    index: any
    price: float
    type: str  # "HH", "HL", "LH", "LL"


@dataclass
class OrderBlock:
    index: any
    high: float
    low: float
    type: str  # "bullish" or "bearish"
    strength: float  # 0-1
    mitigated: bool = False


@dataclass
class FairValueGap:
    index: any
    high: float
    low: float
    type: str  # "bullish" or "bearish"
    filled: bool = False


@dataclass
class LiquidityZone:
    price: float
    type: str  # "equal_highs", "equal_lows", "swing_high_liquidity", "swing_low_liquidity"
    strength: int  # number of touches


@dataclass
class Divergence:
    start_idx: any
    end_idx: any
    type: str  # "bullish_regular", "bearish_regular", "bullish_hidden", "bearish_hidden"
    price_start: float
    price_end: float
    rsi_start: float
    rsi_end: float


@dataclass
class TradeSetup:
    direction: str  # "LONG" or "SHORT"
    entry: float
    sl: float
    tp1: float
    tp2: float
    tp3: float
    confluence_score: float  # 0-10
    reasons: List[str]
    type: str  # "trend_follow", "pullback", "reversal", "breakout"
    risk_reward: float
    label: str


@dataclass
class ProAnalysis:
    """Complete professional analysis result."""
    # Market structure
    trend_d1: str  # "BULLISH", "BEARISH", "RANGING"
    trend_h4: str
    trend_h1: str
    swing_points: List[SwingPoint]
    bos_levels: List[dict]  # Break of Structure
    choch_levels: List[dict]  # Change of Character

    # Smart money concepts
    order_blocks: List[OrderBlock]
    fair_value_gaps: List[FairValueGap]
    liquidity_zones: List[LiquidityZone]

    # Indicators
    divergences: List[Divergence]
    rsi: float
    rsi_zone: str  # "overbought", "oversold", "neutral"

    # Trade setups (scored)
    setups: List[TradeSetup]

    # Summary
    bias: str  # "STRONG_BULL", "BULL", "NEUTRAL", "BEAR", "STRONG_BEAR"
    confidence: float  # 0-100
    key_levels: dict


# ============================================================
# Swing Point Detection
# ============================================================
def detect_swing_points(df: pd.DataFrame, lookback: int = 5) -> List[SwingPoint]:
    """Detect swing highs and lows with HH/HL/LH/LL classification."""
    highs = df["High"].values
    lows = df["Low"].values
    indices = df.index
    swings = []

    for i in range(lookback, len(df) - lookback):
        # Swing high: highest in window
        if highs[i] == max(highs[i - lookback:i + lookback + 1]):
            swings.append(SwingPoint(index=indices[i], price=float(highs[i]), type="SH"))
        # Swing low: lowest in window
        if lows[i] == min(lows[i - lookback:i + lookback + 1]):
            swings.append(SwingPoint(index=indices[i], price=float(lows[i]), type="SL"))

    # Classify as HH/HL/LH/LL
    sh_list = [s for s in swings if s.type == "SH"]
    sl_list = [s for s in swings if s.type == "SL"]

    for i in range(1, len(sh_list)):
        if sh_list[i].price > sh_list[i-1].price:
            sh_list[i].type = "HH"
        else:
            sh_list[i].type = "LH"

    for i in range(1, len(sl_list)):
        if sl_list[i].price > sl_list[i-1].price:
            sl_list[i].type = "HL"
        else:
            sl_list[i].type = "LL"

    return sorted(swings, key=lambda s: s.index)


def determine_trend(swings: List[SwingPoint]) -> str:
    """Determine trend from swing point classification."""
    recent = swings[-6:] if len(swings) >= 6 else swings
    hh_count = sum(1 for s in recent if s.type == "HH")
    hl_count = sum(1 for s in recent if s.type == "HL")
    lh_count = sum(1 for s in recent if s.type == "LH")
    ll_count = sum(1 for s in recent if s.type == "LL")

    bull = hh_count + hl_count
    bear = lh_count + ll_count

    if bull >= 3:
        return "BULLISH"
    elif bear >= 3:
        return "BEARISH"
    else:
        return "RANGING"


# ============================================================
# Break of Structure (BOS) & Change of Character (CHOCH)
# ============================================================
def detect_structure_breaks(df: pd.DataFrame, swings: List[SwingPoint]) -> Tuple[List[dict], List[dict]]:
    """Detect BOS and CHOCH levels."""
    bos = []
    choch = []
    sh_list = [s for s in swings if s.type in ("HH", "LH", "SH")]
    sl_list = [s for s in swings if s.type in ("HL", "LL", "SL")]

    # BOS: price breaks previous swing in trend direction
    for i in range(1, len(sh_list)):
        if sh_list[i].price > sh_list[i-1].price:
            bos.append({"index": sh_list[i].index, "price": sh_list[i-1].price,
                        "type": "bullish_bos", "broken": sh_list[i].price})

    for i in range(1, len(sl_list)):
        if sl_list[i].price < sl_list[i-1].price:
            bos.append({"index": sl_list[i].index, "price": sl_list[i-1].price,
                        "type": "bearish_bos", "broken": sl_list[i].price})

    # CHOCH: trend change signal
    for i in range(2, len(sh_list)):
        if sh_list[i-1].type == "HH" and sh_list[i].type == "LH":
            choch.append({"index": sh_list[i].index, "price": sh_list[i].price,
                          "type": "bearish_choch"})

    for i in range(2, len(sl_list)):
        if sl_list[i-1].type == "LL" and sl_list[i].type == "HL":
            choch.append({"index": sl_list[i].index, "price": sl_list[i].price,
                          "type": "bullish_choch"})

    return bos, choch


# ============================================================
# Order Block Detection
# ============================================================
def detect_order_blocks(df: pd.DataFrame, lookback: int = 50) -> List[OrderBlock]:
    """Detect institutional order blocks (last candle before impulse move)."""
    obs = []
    recent = df.tail(lookback)

    for i in range(2, len(recent)):
        curr = recent.iloc[i]
        prev = recent.iloc[i - 1]
        prev2 = recent.iloc[i - 2]

        body_curr = abs(float(curr["Close"]) - float(curr["Open"]))
        body_prev = abs(float(prev["Close"]) - float(prev["Open"]))
        range_curr = float(curr["High"]) - float(curr["Low"])

        # Bullish OB: bearish candle followed by strong bullish candle
        if (float(prev["Close"]) < float(prev["Open"]) and  # prev bearish
            float(curr["Close"]) > float(curr["Open"]) and  # curr bullish
            body_curr > body_prev * 1.5 and  # impulse
            float(curr["Close"]) > float(prev["High"])):  # engulfing
            strength = min(1.0, body_curr / range_curr)
            obs.append(OrderBlock(
                index=recent.index[i - 1],
                high=float(prev["High"]), low=float(prev["Low"]),
                type="bullish", strength=round(strength, 2),
                mitigated=float(df["Low"].iloc[-1]) < float(prev["Low"])
            ))

        # Bearish OB: bullish candle followed by strong bearish candle
        if (float(prev["Close"]) > float(prev["Open"]) and  # prev bullish
            float(curr["Close"]) < float(curr["Open"]) and  # curr bearish
            body_curr > body_prev * 1.5 and  # impulse
            float(curr["Close"]) < float(prev["Low"])):  # engulfing
            strength = min(1.0, body_curr / range_curr)
            obs.append(OrderBlock(
                index=recent.index[i - 1],
                high=float(prev["High"]), low=float(prev["Low"]),
                type="bearish", strength=round(strength, 2),
                mitigated=float(df["High"].iloc[-1]) > float(prev["High"])
            ))

    # Keep only unmitigated and strongest
    obs = [ob for ob in obs if not ob.mitigated]
    obs.sort(key=lambda x: x.strength, reverse=True)
    return obs[:5]


# ============================================================
# Fair Value Gap (FVG) Detection
# ============================================================
def detect_fvg(df: pd.DataFrame, lookback: int = 50) -> List[FairValueGap]:
    """Detect Fair Value Gaps (imbalance zones)."""
    fvgs = []
    recent = df.tail(lookback)

    for i in range(2, len(recent)):
        c1 = recent.iloc[i - 2]
        c2 = recent.iloc[i - 1]
        c3 = recent.iloc[i]

        # Bullish FVG: gap between candle 1 high and candle 3 low
        if float(c3["Low"]) > float(c1["High"]):
            gap = float(c3["Low"]) - float(c1["High"])
            if gap > 0:
                filled = float(df["Low"].iloc[-1]) <= float(c1["High"])
                fvgs.append(FairValueGap(
                    index=recent.index[i - 1],
                    high=float(c3["Low"]), low=float(c1["High"]),
                    type="bullish", filled=filled
                ))

        # Bearish FVG: gap between candle 3 high and candle 1 low
        if float(c3["High"]) < float(c1["Low"]):
            gap = float(c1["Low"]) - float(c3["High"])
            if gap > 0:
                filled = float(df["High"].iloc[-1]) >= float(c1["Low"])
                fvgs.append(FairValueGap(
                    index=recent.index[i - 1],
                    high=float(c1["Low"]), low=float(c3["High"]),
                    type="bearish", filled=filled
                ))

    unfilled = [f for f in fvgs if not f.filled]
    return unfilled[:5]


# ============================================================
# Liquidity Zone Detection
# ============================================================
def detect_liquidity_zones(df: pd.DataFrame, tolerance_pct: float = 0.001) -> List[LiquidityZone]:
    """Detect equal highs/lows where stop losses cluster."""
    zones = []
    recent = df.tail(60)
    highs = recent["High"].values
    lows = recent["Low"].values
    price_range = float(recent["High"].max() - recent["Low"].min())
    tol = price_range * tolerance_pct

    # Equal highs
    for i in range(len(highs)):
        touches = sum(1 for j in range(len(highs)) if j != i and abs(highs[i] - highs[j]) < tol)
        if touches >= 2:
            zones.append(LiquidityZone(
                price=round(float(highs[i]), 2),
                type="equal_highs",
                strength=touches
            ))

    # Equal lows
    for i in range(len(lows)):
        touches = sum(1 for j in range(len(lows)) if j != i and abs(lows[i] - lows[j]) < tol)
        if touches >= 2:
            zones.append(LiquidityZone(
                price=round(float(lows[i]), 2),
                type="equal_lows",
                strength=touches
            ))

    # Deduplicate
    seen = set()
    unique = []
    for z in zones:
        key = round(z.price, 0)
        if key not in seen:
            seen.add(key)
            unique.append(z)

    unique.sort(key=lambda x: x.strength, reverse=True)
    return unique[:8]


# ============================================================
# RSI Divergence Detection
# ============================================================
def compute_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def detect_divergences(df: pd.DataFrame, swings: List[SwingPoint], rsi: pd.Series) -> List[Divergence]:
    """Detect regular and hidden divergences between price and RSI."""
    divs = []
    sl_list = [s for s in swings if s.type in ("HL", "LL", "SL")]
    sh_list = [s for s in swings if s.type in ("HH", "LH", "SH")]

    # Bullish regular divergence: price makes LL, RSI makes HL
    for i in range(1, len(sl_list)):
        s1, s2 = sl_list[i - 1], sl_list[i]
        if s2.price < s1.price:  # price LL
            rsi1 = float(rsi.loc[s1.index]) if s1.index in rsi.index else None
            rsi2 = float(rsi.loc[s2.index]) if s2.index in rsi.index else None
            if rsi1 is not None and rsi2 is not None and not np.isnan(rsi1) and not np.isnan(rsi2):
                if rsi2 > rsi1:  # RSI HL
                    divs.append(Divergence(
                        start_idx=s1.index, end_idx=s2.index,
                        type="bullish_regular",
                        price_start=s1.price, price_end=s2.price,
                        rsi_start=round(rsi1, 1), rsi_end=round(rsi2, 1)
                    ))

    # Bearish regular divergence: price makes HH, RSI makes LH
    for i in range(1, len(sh_list)):
        s1, s2 = sh_list[i - 1], sh_list[i]
        if s2.price > s1.price:  # price HH
            rsi1 = float(rsi.loc[s1.index]) if s1.index in rsi.index else None
            rsi2 = float(rsi.loc[s2.index]) if s2.index in rsi.index else None
            if rsi1 is not None and rsi2 is not None and not np.isnan(rsi1) and not np.isnan(rsi2):
                if rsi2 < rsi1:  # RSI LH
                    divs.append(Divergence(
                        start_idx=s1.index, end_idx=s2.index,
                        type="bearish_regular",
                        price_start=s1.price, price_end=s2.price,
                        rsi_start=round(rsi1, 1), rsi_end=round(rsi2, 1)
                    ))

    # Hidden divergences
    # Bullish hidden: price makes HL, RSI makes LL
    for i in range(1, len(sl_list)):
        s1, s2 = sl_list[i - 1], sl_list[i]
        if s2.price > s1.price:  # price HL
            rsi1 = float(rsi.loc[s1.index]) if s1.index in rsi.index else None
            rsi2 = float(rsi.loc[s2.index]) if s2.index in rsi.index else None
            if rsi1 is not None and rsi2 is not None and not np.isnan(rsi1) and not np.isnan(rsi2):
                if rsi2 < rsi1:  # RSI LL
                    divs.append(Divergence(
                        start_idx=s1.index, end_idx=s2.index,
                        type="bullish_hidden",
                        price_start=s1.price, price_end=s2.price,
                        rsi_start=round(rsi1, 1), rsi_end=round(rsi2, 1)
                    ))

    return divs[-5:]  # Most recent


# ============================================================
# Confluence Scoring & Trade Setup Generation
# ============================================================
def generate_trade_setups(
    price: float, trend_d1: str, trend_h4: str, trend_h1: str,
    order_blocks: List[OrderBlock], fvgs: List[FairValueGap],
    liquidity_zones: List[LiquidityZone], divergences: List[Divergence],
    rsi: float, swings: List[SwingPoint], df_m15: pd.DataFrame,
    analysis: dict,
) -> List[TradeSetup]:
    """Generate scored trade setups based on confluence."""
    setups = []

    m15_high = float(df_m15.tail(48)["High"].max())
    m15_low = float(df_m15.tail(48)["Low"].min())
    m15_range = m15_high - m15_low
    if m15_range == 0:
        m15_range = price * 0.01

    # Nearest OB levels
    bull_obs = [ob for ob in order_blocks if ob.type == "bullish"]
    bear_obs = [ob for ob in order_blocks if ob.type == "bearish"]
    bull_fvgs = [f for f in fvgs if f.type == "bullish"]
    bear_fvgs = [f for f in fvgs if f.type == "bearish"]

    # EMA from M15
    m15 = df_m15.copy()
    m15["EMA9"] = m15["Close"].ewm(span=9).mean()
    m15["EMA21"] = m15["Close"].ewm(span=21).mean()
    ema9 = float(m15["EMA9"].iloc[-1]) if m15["EMA9"].notna().any() else price
    ema21 = float(m15["EMA21"].iloc[-1]) if m15["EMA21"].notna().any() else price

    # ===== SETUP 1: Trend Follow =====
    score1 = 0
    reasons1 = []

    # Multi-TF alignment
    trends = [trend_d1, trend_h4, trend_h1]
    bull_trends = sum(1 for t in trends if t == "BULLISH")
    bear_trends = sum(1 for t in trends if t == "BEARISH")

    if bull_trends >= 2:
        direction = "LONG"
        score1 += bull_trends * 1.5
        reasons1.append(f"Multi-TF bullish ({bull_trends}/3 timeframes)")
    elif bear_trends >= 2:
        direction = "SHORT"
        score1 += bear_trends * 1.5
        reasons1.append(f"Multi-TF bearish ({bear_trends}/3 timeframes)")
    else:
        direction = "LONG" if ema9 > ema21 else "SHORT"
        score1 += 1
        reasons1.append(f"EMA crossover {'bullish' if ema9 > ema21 else 'bearish'}")

    # EMA alignment
    if direction == "LONG" and ema9 > ema21:
        score1 += 1.5
        reasons1.append("EMA9 > EMA21 on M15")
    elif direction == "SHORT" and ema9 < ema21:
        score1 += 1.5
        reasons1.append("EMA9 < EMA21 on M15")

    # RSI
    if direction == "LONG" and rsi < 40:
        score1 += 1.5
        reasons1.append(f"RSI oversold at {rsi:.0f}")
    elif direction == "SHORT" and rsi > 60:
        score1 += 1.5
        reasons1.append(f"RSI overbought at {rsi:.0f}")

    # Divergence
    recent_divs = [d for d in divergences if
                   (direction == "LONG" and "bullish" in d.type) or
                   (direction == "SHORT" and "bearish" in d.type)]
    if recent_divs:
        score1 += 2
        reasons1.append(f"{recent_divs[-1].type} divergence detected")

    # Near order block
    if direction == "LONG" and bull_obs:
        nearest_ob = min(bull_obs, key=lambda ob: abs(price - ob.low))
        if abs(price - nearest_ob.low) / price < 0.01:
            score1 += 2
            reasons1.append(f"At bullish OB zone ${nearest_ob.low:.0f}-${nearest_ob.high:.0f}")
    elif direction == "SHORT" and bear_obs:
        nearest_ob = min(bear_obs, key=lambda ob: abs(price - ob.high))
        if abs(price - nearest_ob.high) / price < 0.01:
            score1 += 2
            reasons1.append(f"At bearish OB zone ${nearest_ob.low:.0f}-${nearest_ob.high:.0f}")

    # FVG
    if direction == "LONG" and bull_fvgs:
        nearest_fvg = min(bull_fvgs, key=lambda f: abs(price - f.low))
        if abs(price - nearest_fvg.low) / price < 0.015:
            score1 += 1.5
            reasons1.append(f"Bullish FVG at ${nearest_fvg.low:.0f}-${nearest_fvg.high:.0f}")
    elif direction == "SHORT" and bear_fvgs:
        nearest_fvg = min(bear_fvgs, key=lambda f: abs(price - f.high))
        if abs(price - nearest_fvg.high) / price < 0.015:
            score1 += 1.5
            reasons1.append(f"Bearish FVG at ${nearest_fvg.low:.0f}-${nearest_fvg.high:.0f}")

    score1 = min(10, score1)

    if direction == "LONG":
        entry1 = price
        sl1 = price - m15_range * 0.18
        tp1_1 = price + m15_range * 0.3
        tp1_2 = price + m15_range * 0.55
        tp1_3 = price + m15_range * 0.8
    else:
        entry1 = price
        sl1 = price + m15_range * 0.18
        tp1_1 = price - m15_range * 0.3
        tp1_2 = price - m15_range * 0.55
        tp1_3 = price - m15_range * 0.8

    rr1 = abs(tp1_1 - entry1) / abs(sl1 - entry1) if abs(sl1 - entry1) > 0 else 0

    setups.append(TradeSetup(
        direction=direction, entry=round(entry1, 2), sl=round(sl1, 2),
        tp1=round(tp1_1, 2), tp2=round(tp1_2, 2), tp3=round(tp1_3, 2),
        confluence_score=round(score1, 1), reasons=reasons1,
        type="trend_follow", risk_reward=round(rr1, 1),
        label=f"TREND {direction}"
    ))

    # ===== SETUP 2: Pullback/OB Entry (Second Chance) =====
    score2 = 0
    reasons2 = []

    if direction == "LONG":
        # Entry at OB or EMA21
        if bull_obs:
            ob = bull_obs[0]
            entry2 = round((ob.low + ob.high) / 2, 2)
            reasons2.append(f"Entry at bullish OB ${ob.low:.0f}-${ob.high:.0f}")
            score2 += 2
        else:
            entry2 = round(ema21, 2)
            reasons2.append(f"Entry at EMA21 pullback ${ema21:.0f}")
            score2 += 1.5

        sl2 = round(entry2 - m15_range * 0.12, 2)
        tp2_1 = round(entry2 + m15_range * 0.4, 2)
        tp2_2 = round(entry2 + m15_range * 0.7, 2)
        tp2_3 = round(entry2 + m15_range * 1.0, 2)
    else:
        if bear_obs:
            ob = bear_obs[0]
            entry2 = round((ob.low + ob.high) / 2, 2)
            reasons2.append(f"Entry at bearish OB ${ob.low:.0f}-${ob.high:.0f}")
            score2 += 2
        else:
            entry2 = round(ema21, 2)
            reasons2.append(f"Entry at EMA21 bounce ${ema21:.0f}")
            score2 += 1.5

        sl2 = round(entry2 + m15_range * 0.12, 2)
        tp2_1 = round(entry2 - m15_range * 0.4, 2)
        tp2_2 = round(entry2 - m15_range * 0.7, 2)
        tp2_3 = round(entry2 - m15_range * 1.0, 2)

    # Add confluence for setup 2
    if bull_trends >= 2 or bear_trends >= 2:
        score2 += 1.5
        reasons2.append("Aligned with higher TF trend")
    if bull_fvgs and direction == "LONG":
        score2 += 1
        reasons2.append("Near unfilled bullish FVG")
    elif bear_fvgs and direction == "SHORT":
        score2 += 1
        reasons2.append("Near unfilled bearish FVG")

    score2 = min(10, score2)
    rr2 = abs(tp2_1 - entry2) / abs(sl2 - entry2) if abs(sl2 - entry2) > 0 else 0

    setups.append(TradeSetup(
        direction=direction, entry=entry2, sl=sl2,
        tp1=tp2_1, tp2=tp2_2, tp3=tp2_3,
        confluence_score=round(score2, 1), reasons=reasons2,
        type="pullback", risk_reward=round(rr2, 1),
        label=f"PULLBACK {'BUY' if direction == 'LONG' else 'SELL'}"
    ))

    # ===== SETUP 3: Liquidity Grab / Reversal =====
    score3 = 0
    reasons3 = []
    rev_dir = "SHORT" if direction == "LONG" else "LONG"

    # Look for liquidity zones above/below
    liq_above = [z for z in liquidity_zones if z.price > price and z.type == "equal_highs"]
    liq_below = [z for z in liquidity_zones if z.price < price and z.type == "equal_lows"]

    if rev_dir == "SHORT" and liq_above:
        lz = liq_above[0]
        entry3 = round(lz.price + m15_range * 0.01, 2)
        reasons3.append(f"Liquidity grab above equal highs ${lz.price:.0f} ({lz.strength} touches)")
        score3 += lz.strength * 0.5
    elif rev_dir == "LONG" and liq_below:
        lz = liq_below[0]
        entry3 = round(lz.price - m15_range * 0.01, 2)
        reasons3.append(f"Liquidity grab below equal lows ${lz.price:.0f} ({lz.strength} touches)")
        score3 += lz.strength * 0.5
    else:
        # Breakout entry
        if rev_dir == "LONG":
            entry3 = round(m15_high + m15_range * 0.02, 2)
            reasons3.append(f"Breakout above range high ${m15_high:.0f}")
        else:
            entry3 = round(m15_low - m15_range * 0.02, 2)
            reasons3.append(f"Breakdown below range low ${m15_low:.0f}")
        score3 += 1

    if rev_dir == "LONG":
        sl3 = round(entry3 - m15_range * 0.1, 2)
        tp3_1 = round(entry3 + m15_range * 0.35, 2)
        tp3_2 = round(entry3 + m15_range * 0.6, 2)
        tp3_3 = round(entry3 + m15_range * 0.9, 2)
    else:
        sl3 = round(entry3 + m15_range * 0.1, 2)
        tp3_1 = round(entry3 - m15_range * 0.35, 2)
        tp3_2 = round(entry3 - m15_range * 0.6, 2)
        tp3_3 = round(entry3 - m15_range * 0.9, 2)

    score3 = min(10, score3)
    rr3 = abs(tp3_1 - entry3) / abs(sl3 - entry3) if abs(sl3 - entry3) > 0 else 0

    setups.append(TradeSetup(
        direction=rev_dir, entry=entry3, sl=sl3,
        tp1=tp3_1, tp2=tp3_2, tp3=tp3_3,
        confluence_score=round(score3, 1), reasons=reasons3,
        type="reversal", risk_reward=round(rr3, 1),
        label=f"REVERSAL {'LONG' if rev_dir == 'LONG' else 'SHORT'}"
    ))

    # Sort by confluence score
    setups.sort(key=lambda s: s.confluence_score, reverse=True)
    return setups


# ============================================================
# Main Analysis Function
# ============================================================
def run_pro_analysis(df_d1, df_h4, df_h1, df_m15, analysis: dict) -> ProAnalysis:
    """Run full professional analysis."""
    price = analysis["price"]

    # RSI
    rsi_series = compute_rsi(df_d1)
    rsi_val = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else 50
    rsi_zone = "overbought" if rsi_val > 70 else ("oversold" if rsi_val < 30 else "neutral")

    # Swing points per timeframe
    swings_d1 = detect_swing_points(df_d1, lookback=5)
    swings_h4 = detect_swing_points(df_h4, lookback=5) if df_h4 is not None and len(df_h4) > 15 else []
    swings_h1 = detect_swing_points(df_h1, lookback=3) if df_h1 is not None and len(df_h1) > 10 else []

    # Trends
    trend_d1 = determine_trend(swings_d1)
    trend_h4 = determine_trend(swings_h4) if swings_h4 else analysis.get("trend", "RANGING")
    trend_h1 = determine_trend(swings_h1) if swings_h1 else "RANGING"

    # Structure breaks
    bos, choch = detect_structure_breaks(df_d1, swings_d1)

    # Smart money concepts on H4
    target_df = df_h4 if df_h4 is not None and len(df_h4) > 30 else df_d1
    order_blocks = detect_order_blocks(target_df, lookback=60)
    fvgs = detect_fvg(target_df, lookback=60)
    liquidity = detect_liquidity_zones(df_d1)

    # Divergences
    divergences = detect_divergences(df_d1, swings_d1, rsi_series)

    # Trade setups with confluence scoring
    setups = generate_trade_setups(
        price, trend_d1, trend_h4, trend_h1,
        order_blocks, fvgs, liquidity, divergences,
        rsi_val, swings_d1, df_m15, analysis
    )

    # Overall bias
    total_bull = sum(1 for t in [trend_d1, trend_h4, trend_h1] if t == "BULLISH")
    total_bear = sum(1 for t in [trend_d1, trend_h4, trend_h1] if t == "BEARISH")
    if total_bull >= 3:
        bias = "STRONG_BULL"
    elif total_bull >= 2:
        bias = "BULL"
    elif total_bear >= 3:
        bias = "STRONG_BEAR"
    elif total_bear >= 2:
        bias = "BEAR"
    else:
        bias = "NEUTRAL"

    # Confidence from top setup score
    confidence = min(100, setups[0].confluence_score * 10 if setups else 30)

    # Key levels
    key_levels = {
        "support": analysis["support"],
        "resistance": analysis["resistance"],
        "fib_618": analysis["fib_levels"].get("0.618", 0),
        "fib_382": analysis["fib_levels"].get("0.382", 0),
    }
    if order_blocks:
        key_levels["nearest_ob"] = {
            "high": order_blocks[0].high,
            "low": order_blocks[0].low,
            "type": order_blocks[0].type,
        }
    if liquidity:
        key_levels["liquidity"] = [{"price": z.price, "type": z.type, "strength": z.strength}
                                    for z in liquidity[:3]]

    return ProAnalysis(
        trend_d1=trend_d1, trend_h4=trend_h4, trend_h1=trend_h1,
        swing_points=swings_d1[-10:], bos_levels=bos[-5:], choch_levels=choch[-3:],
        order_blocks=order_blocks, fair_value_gaps=fvgs,
        liquidity_zones=liquidity,
        divergences=divergences, rsi=rsi_val, rsi_zone=rsi_zone,
        setups=setups, bias=bias, confidence=confidence,
        key_levels=key_levels,
    )
