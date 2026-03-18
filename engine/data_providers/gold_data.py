"""
GOLD DATA LAB — Real market data from MT5
Fetches XAUUSD data, generates pro-quality charts with mplfinance.
Includes: candlestick, fibonacci, RSI, intraday, prediction analysis.
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


def fetch_gold_data(out_dir: Path):
    """Fetch gold data from MT5 and generate chart images + analysis."""
    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("    -> Missing: pip install MetaTrader5")
        return _fallback_yfinance(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)
    assets_dir = out_dir / "assets"
    assets_dir.mkdir(exist_ok=True)

    if not mt5.initialize():
        print(f"    -> MT5 init failed: {mt5.last_error()}, fallback to yfinance")
        mt5.shutdown()
        return _fallback_yfinance(out_dir)

    symbol = "XAUUSDm"
    if not mt5.symbol_info(symbol):
        symbol = "XAUUSD"
        if not mt5.symbol_info(symbol):
            mt5.shutdown()
            return _fallback_yfinance(out_dir)

    mt5.symbol_select(symbol, True)
    print(f"    -> MT5 connected, fetching {symbol}...")

    rates_d1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 180)
    rates_h4 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H4, 0, 200)
    rates_h1 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H1, 0, 96)
    rates_m15 = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M15, 0, 192)

    tick = mt5.symbol_info_tick(symbol)
    current_bid = tick.bid if tick else 0
    current_ask = tick.ask if tick else 0
    mt5.shutdown()

    if rates_d1 is None or len(rates_d1) < 30:
        return _fallback_yfinance(out_dir)

    df_d1 = _rates_to_df(rates_d1)
    df_h4 = _rates_to_df(rates_h4) if rates_h4 is not None else None
    df_h1 = _rates_to_df(rates_h1) if rates_h1 is not None else None
    df_m15 = _rates_to_df(rates_m15) if rates_m15 is not None else None

    print(f"    -> D1:{len(df_d1)} H4:{len(df_h4) if df_h4 is not None else 0} H1:{len(df_h1) if df_h1 is not None else 0} M15:{len(df_m15) if df_m15 is not None else 0}")

    # Indicators on D1
    df_d1["SMA20"] = df_d1["Close"].rolling(20).mean()
    df_d1["SMA50"] = df_d1["Close"].rolling(50).mean()
    df_d1["SMA200"] = df_d1["Close"].rolling(200).mean()
    delta = df_d1["Close"].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    df_d1["RSI"] = 100 - (100 / (1 + rs))

    last = df_d1.iloc[-1]
    prev = df_d1.iloc[-2]
    change = float(last["Close"] - prev["Close"])
    change_pct = (change / float(prev["Close"])) * 100
    week_ago = df_d1.iloc[-6] if len(df_d1) > 5 else df_d1.iloc[0]
    week_change_pct = ((float(last["Close"]) - float(week_ago["Close"])) / float(week_ago["Close"])) * 100

    recent20 = df_d1.tail(20)
    support = float(recent20["Low"].min())
    resistance = float(recent20["High"].max())

    # Proper swing detection for Fibonacci
    swing_high, swing_low, sh_idx, sl_idx = _find_swing_points(df_d1, lookback=60)

    fib = _calc_fib_levels(swing_high, swing_low)

    sma20 = float(last["SMA20"]) if pd.notna(last["SMA20"]) else 0
    sma50 = float(last["SMA50"]) if pd.notna(last["SMA50"]) else 0
    rsi = float(last["RSI"]) if pd.notna(last["RSI"]) else 50
    trend = "BULLISH" if sma20 > sma50 else ("BEARISH" if sma20 < sma50 else "NEUTRAL")

    analysis = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "symbol": symbol,
        "price": round(current_bid, 2),
        "bid": round(current_bid, 2),
        "ask": round(current_ask, 2),
        "spread": round(current_ask - current_bid, 2),
        "open": round(float(last["Open"]), 2),
        "high": round(float(last["High"]), 2),
        "low": round(float(last["Low"]), 2),
        "close": round(float(last["Close"]), 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "week_change_pct": round(week_change_pct, 2),
        "sma20": round(sma20, 2),
        "sma50": round(sma50, 2),
        "rsi": round(rsi, 1),
        "trend": trend,
        "support": round(support, 2),
        "resistance": round(resistance, 2),
        "fib_levels": fib,
        "swing_high": round(swing_high, 2),
        "swing_low": round(swing_low, 2),
    }

    with open(out_dir / "market_data.json", "w") as f:
        json.dump(analysis, f, indent=2)

    arrow = "\u25B2" if change >= 0 else "\u25BC"
    print(f"    -> {symbol}: ${analysis['price']} {arrow}{analysis['change_pct']:+.2f}% RSI={analysis['rsi']} {trend}")

    _generate_all_charts(df_d1, df_h4, df_h1, df_m15, analysis, sh_idx, sl_idx, assets_dir)
    return analysis


def _rates_to_df(rates):
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    df.set_index("time", inplace=True)
    df.rename(columns={"open": "Open", "high": "High", "low": "Low",
                        "close": "Close", "tick_volume": "Volume"}, inplace=True)
    return df[["Open", "High", "Low", "Close", "Volume"]]


def _find_swing_points(df, lookback=60):
    """Find significant swing high and swing low in the last N bars."""
    recent = df.tail(lookback)
    sh_idx = recent["High"].idxmax()
    sl_idx = recent["Low"].idxmin()
    return float(recent.loc[sh_idx, "High"]), float(recent.loc[sl_idx, "Low"]), sh_idx, sl_idx


def _calc_fib_levels(high, low):
    diff = high - low
    return {
        "0.0": round(high, 2),
        "0.236": round(high - 0.236 * diff, 2),
        "0.382": round(high - 0.382 * diff, 2),
        "0.5": round(high - 0.5 * diff, 2),
        "0.618": round(high - 0.618 * diff, 2),
        "0.786": round(high - 0.786 * diff, 2),
        "1.0": round(low, 2),
    }


def _make_style():
    import mplfinance as mpf
    mc = mpf.make_marketcolors(
        up="#34d399", down="#f87171",
        edge={"up": "#34d39988", "down": "#f8717188"},
        wick={"up": "#34d399", "down": "#f87171"},
        volume={"up": "#34d39933", "down": "#f8717133"},
    )
    return mpf.make_mpf_style(
        marketcolors=mc, facecolor="#0a0e1a", edgecolor="#1a1f2e",
        gridcolor="#1a1f2e", gridstyle="--", gridaxis="both", y_on_right=True,
        rc={"font.size": 10, "axes.labelcolor": "#6b7a99",
            "xtick.color": "#6b7a99", "ytick.color": "#6b7a99",
            "text.color": "#f0f4ff", "figure.facecolor": "#0a0e1a"},
    )


def _generate_all_charts(df_d1, df_h4, df_h1, df_m15, analysis, sh_idx, sl_idx, assets_dir):
    import matplotlib
    matplotlib.use("Agg")
    import mplfinance as mpf
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyArrowPatch

    BG = "#0a0e1a"
    style = _make_style()

    # ===== Chart 1: D1 wide view + SMA + S/R + prediction arrow =====
    d1_view = df_d1.tail(90).copy()
    ap = []
    for col, color, lbl in [("SMA20", "#60a5fa", "SMA20"), ("SMA50", "#fbbf24", "SMA50"), ("SMA200", "#c084fc", "SMA200")]:
        valid = d1_view[col].dropna()
        if len(valid) > 10:
            ap.append(mpf.make_addplot(d1_view[col], color=color, width=1.8, label=lbl))

    hlines = dict(hlines=[analysis["support"], analysis["resistance"]],
                  colors=["#34d399", "#f87171"], linestyle="--", linewidths=1.2)

    fig, axes = mpf.plot(d1_view, type="candle", style=style, volume=True,
                         addplot=ap if ap else None, hlines=hlines,
                         figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                         panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
    fig.set_size_inches(16, 9)
    ax = axes[0]

    # Price label
    c = "#34d399" if analysis["change"] >= 0 else "#f87171"
    arrow = "\u25B2" if analysis["change"] >= 0 else "\u25BC"
    ax.text(0.01, 0.97, f'XAUUSD  ${analysis["price"]:.2f}  {arrow}{analysis["change_pct"]:+.2f}%',
            transform=ax.transAxes, fontsize=20, fontweight="bold", color=c, va="top",
            fontfamily="monospace", bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec="#1a1f2e", alpha=0.9))
    ax.text(0.01, 0.90, f'SMA20:{analysis["sma20"]:.0f}  SMA50:{analysis["sma50"]:.0f}  RSI:{analysis["rsi"]:.0f}  {analysis["trend"]}',
            transform=ax.transAxes, fontsize=11, color="#6b7a99", va="top", fontfamily="monospace")

    # S/R labels on chart
    ax.text(d1_view.index[-1], analysis["support"], f'  S: ${analysis["support"]:.0f}',
            color="#34d399", fontsize=10, va="top", fontweight="bold")
    ax.text(d1_view.index[-1], analysis["resistance"], f'  R: ${analysis["resistance"]:.0f}',
            color="#f87171", fontsize=10, va="bottom", fontweight="bold")

    fig.savefig(str(assets_dir / "chart_main.png"), dpi=100, facecolor=BG, bbox_inches=None)
    plt.close(fig)
    print("    -> Generated chart_main.png (D1 + SMA + S/R)")

    # ===== Chart 2: Fibonacci on H4 (200 bars) =====
    if df_h4 is not None and len(df_h4) > 30:
        h4_view = df_h4.tail(120).copy()
        fib = analysis["fib_levels"]
        fib_prices = [fib[k] for k in ["0.0", "0.236", "0.382", "0.5", "0.618", "0.786", "1.0"]]
        fib_colors = ["#f87171", "#fb923c", "#fbbf24", "#f0f4ff", "#60a5fa", "#c084fc", "#34d399"]

        fig2, axes2 = mpf.plot(h4_view, type="candle", style=style,
                               hlines=dict(hlines=fib_prices, colors=fib_colors, linestyle="--", linewidths=1),
                               figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                               scale_width_adjustment=dict(candle=0.6))
        fig2.set_size_inches(16, 9)
        ax2 = axes2[0]

        # Draw swing line
        if sh_idx in h4_view.index or sl_idx in h4_view.index:
            pass  # swing points may not be in H4 timeframe

        ax2.text(0.01, 0.97, f'FIBONACCI RETRACEMENT  H4',
                 transform=ax2.transAxes, fontsize=18, fontweight="bold", color="#f0f4ff", va="top",
                 bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec="#1a1f2e", alpha=0.9))
        ax2.text(0.01, 0.91, f'Swing ${analysis["swing_low"]:.0f} → ${analysis["swing_high"]:.0f}',
                 transform=ax2.transAxes, fontsize=12, color="#6b7a99", va="top", fontfamily="monospace")

        # Fib level labels on right side of chart
        for i, (level, price) in enumerate(fib.items()):
            y_norm = (price - ax2.get_ylim()[0]) / (ax2.get_ylim()[1] - ax2.get_ylim()[0])
            if 0.05 < y_norm < 0.95:
                ax2.text(0.99, y_norm, f'{level}  ${price:.0f} ', transform=ax2.transAxes,
                         fontsize=10, color=fib_colors[i], ha="right", fontweight="bold", va="center")

        fig2.savefig(str(assets_dir / "chart_fib.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig2)
        print("    -> Generated chart_fib.png (H4 200-bar Fibonacci)")

    # ===== Chart 3: H1 intraday with EMA =====
    if df_h1 is not None and len(df_h1) > 10:
        h1 = df_h1.copy()
        h1["EMA12"] = h1["Close"].ewm(span=12).mean()
        h1["EMA26"] = h1["Close"].ewm(span=26).mean()
        ap1 = []
        if h1["EMA12"].notna().sum() > 5:
            ap1.append(mpf.make_addplot(h1["EMA12"], color="#60a5fa", width=1.5))
        if h1["EMA26"].notna().sum() > 5:
            ap1.append(mpf.make_addplot(h1["EMA26"], color="#fbbf24", width=1.5))

        fig3, axes3 = mpf.plot(h1, type="candle", style=style, volume=True,
                               addplot=ap1 if ap1 else None,
                               figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                               panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
        fig3.set_size_inches(16, 9)
        ax3 = axes3[0]
        ax3.text(0.01, 0.97, f'XAUUSD  H1  INTRADAY',
                 transform=ax3.transAxes, fontsize=18, fontweight="bold", color="#f0f4ff", va="top",
                 bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec="#1a1f2e", alpha=0.9))

        fig3.savefig(str(assets_dir / "chart_h1.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig3)
        print("    -> Generated chart_h1.png (H1 intraday)")

    # ===== Chart 4: M15 scalping with EMA crossover signals =====
    if df_m15 is not None and len(df_m15) > 20:
        m15 = df_m15.copy()
        m15["EMA9"] = m15["Close"].ewm(span=9).mean()
        m15["EMA21"] = m15["Close"].ewm(span=21).mean()
        ap15 = []
        if m15["EMA9"].notna().sum() > 5:
            ap15.append(mpf.make_addplot(m15["EMA9"], color="#c084fc", width=1.5))
        if m15["EMA21"].notna().sum() > 5:
            ap15.append(mpf.make_addplot(m15["EMA21"], color="#34d399", width=1.5))

        fig4, axes4 = mpf.plot(m15, type="candle", style=style, volume=True,
                               addplot=ap15 if ap15 else None,
                               figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                               panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
        fig4.set_size_inches(16, 9)
        ax4 = axes4[0]
        ax4.text(0.01, 0.97, f'XAUUSD  M15  SCALPING',
                 transform=ax4.transAxes, fontsize=18, fontweight="bold", color="#f0f4ff", va="top",
                 bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec="#1a1f2e", alpha=0.9))

        # Mark EMA crossover signals
        ema9 = m15["EMA9"].dropna()
        ema21 = m15["EMA21"].dropna()
        common = ema9.index.intersection(ema21.index)
        last_signal = None  # track latest signal for prediction
        if len(common) > 2:
            for i in range(1, len(common)):
                prev_d = ema9[common[i-1]] - ema21[common[i-1]]
                curr_d = ema9[common[i]] - ema21[common[i]]
                if prev_d < 0 and curr_d >= 0:
                    ax4.annotate("\u25B2 BUY", xy=(common[i], float(m15.loc[common[i], "Low"]) * 0.999),
                                fontsize=9, color="#34d399", fontweight="bold", ha="center",
                                bbox=dict(boxstyle="round,pad=0.15", fc="#34d39922", ec="#34d39966"))
                    last_signal = "BUY"
                elif prev_d > 0 and curr_d <= 0:
                    ax4.annotate("\u25BC SELL", xy=(common[i], float(m15.loc[common[i], "High"]) * 1.001),
                                fontsize=9, color="#f87171", fontweight="bold", ha="center",
                                bbox=dict(boxstyle="round,pad=0.15", fc="#f8717122", ec="#f8717166"))
                    last_signal = "SELL"

        # ===== Trade Setup: Current + Second Chance =====
        last_price = float(m15["Close"].iloc[-1])
        last_date = m15.index[-1]
        m15_high = float(m15.tail(48)["High"].max())
        m15_low = float(m15.tail(48)["Low"].min())
        m15_range = m15_high - m15_low

        ema9_last = float(ema9.iloc[-1]) if len(ema9) > 0 else last_price
        ema21_last = float(ema21.iloc[-1]) if len(ema21) > 0 else last_price
        ema_bullish = ema9_last > ema21_last

        if ema_bullish:
            # --- Trade 1: Current LONG setup ---
            entry1 = last_price
            tp1 = last_price + m15_range * 0.3
            tp2 = last_price + m15_range * 0.6
            sl1 = last_price - m15_range * 0.15
            pred_color = "#34d399"
            pred_label = "LONG"
            # --- Trade 2: Second chance — pullback buy at EMA21 ---
            entry2 = ema21_last  # pullback to EMA21
            tp2_1 = entry2 + m15_range * 0.4
            tp2_2 = entry2 + m15_range * 0.7
            sl2 = entry2 - m15_range * 0.12
            second_label = "PULLBACK BUY"
            second_color = "#60a5fa"
            # --- Trade 3: Counter-trend sell if breaks support ---
            reversal_entry = m15_low - m15_range * 0.02
            reversal_tp = reversal_entry - m15_range * 0.35
            reversal_sl = m15_low + m15_range * 0.1
            reversal_label = "BREAK SELL"
            reversal_color = "#f87171"
        else:
            # --- Trade 1: Current SHORT setup ---
            entry1 = last_price
            tp1 = last_price - m15_range * 0.3
            tp2 = last_price - m15_range * 0.6
            sl1 = last_price + m15_range * 0.15
            pred_color = "#f87171"
            pred_label = "SHORT"
            # --- Trade 2: Second chance — rally sell at EMA21 ---
            entry2 = ema21_last  # bounce to EMA21
            tp2_1 = entry2 - m15_range * 0.4
            tp2_2 = entry2 - m15_range * 0.7
            sl2 = entry2 + m15_range * 0.12
            second_label = "RALLY SELL"
            second_color = "#60a5fa"
            # --- Trade 3: Counter-trend buy if breaks resistance ---
            reversal_entry = m15_high + m15_range * 0.02
            reversal_tp = reversal_entry + m15_range * 0.35
            reversal_sl = m15_high - m15_range * 0.1
            reversal_label = "BREAK BUY"
            reversal_color = "#34d399"

        # ===== Draw Trade 1: Primary signal =====
        ax4.annotate("", xy=(last_date, tp1), xytext=(last_date, entry1),
                     arrowprops=dict(arrowstyle="-|>", color=pred_color, lw=3, ls="--"))

        ax4.axhline(y=entry1, color="#fbbf24", linestyle="-", alpha=0.4, linewidth=1)
        ax4.axhline(y=tp1, color=pred_color, linestyle=":", alpha=0.5, linewidth=1)
        ax4.axhline(y=tp2, color=pred_color, linestyle=":", alpha=0.3, linewidth=1)
        ax4.axhline(y=sl1, color="#f87171" if ema_bullish else "#34d399", linestyle="-.", alpha=0.5, linewidth=1)

        ax4.text(m15.index[1], entry1, f'  ENTRY ${entry1:.0f}', color="#fbbf24",
                 fontsize=9, fontweight="bold", va="bottom",
                 bbox=dict(boxstyle="round,pad=0.12", fc="#fbbf2415", ec="#fbbf2444"))
        ax4.text(m15.index[1], tp1, f'  TP1 ${tp1:.0f}', color=pred_color,
                 fontsize=9, fontweight="bold", va="bottom" if ema_bullish else "top",
                 bbox=dict(boxstyle="round,pad=0.12", fc=f"{pred_color}15", ec=f"{pred_color}44"))
        ax4.text(m15.index[1], tp2, f'  TP2 ${tp2:.0f}', color=pred_color,
                 fontsize=8, fontweight="bold", va="bottom" if ema_bullish else "top",
                 bbox=dict(boxstyle="round,pad=0.10", fc=f"{pred_color}10", ec=f"{pred_color}33"))
        ax4.text(m15.index[1], sl1, f'  SL ${sl1:.0f}',
                 color="#f87171" if ema_bullish else "#34d399", fontsize=8, fontweight="bold",
                 va="top" if ema_bullish else "bottom",
                 bbox=dict(boxstyle="round,pad=0.10", fc="#f8717115", ec="#f8717144"))

        # ===== Draw Trade 2: Second Chance zone (EMA21 pullback) =====
        # Highlight the EMA21 zone as a shaded area
        ema21_zone_top = ema21_last + m15_range * 0.02
        ema21_zone_bot = ema21_last - m15_range * 0.02
        ax4.axhspan(ema21_zone_bot, ema21_zone_top, color=second_color, alpha=0.08)
        ax4.axhline(y=ema21_last, color=second_color, linestyle="--", alpha=0.6, linewidth=1.5)

        # Second chance arrow (smaller, offset to right of chart center)
        mid_idx = len(m15) * 2 // 3
        if mid_idx < len(m15):
            mid_date = m15.index[mid_idx]
            ax4.annotate("", xy=(mid_date, tp2_1), xytext=(mid_date, entry2),
                         arrowprops=dict(arrowstyle="-|>", color=second_color, lw=2, ls="--"))
            ax4.text(mid_date, entry2,
                     f'  2ND CHANCE: {second_label} ${entry2:.0f}\n  TP ${tp2_1:.0f} / SL ${sl2:.0f}',
                     color=second_color, fontsize=8, fontweight="bold",
                     va="top" if ema_bullish else "bottom",
                     bbox=dict(boxstyle="round,pad=0.15", fc=f"{second_color}12", ec=f"{second_color}44"))

        # ===== Draw Trade 3: Reversal / Breakout scenario =====
        reversal_y = reversal_entry
        ax4.axhline(y=reversal_y, color=reversal_color, linestyle=":", alpha=0.3, linewidth=1)
        quarter_idx = len(m15) // 3
        if quarter_idx < len(m15):
            q_date = m15.index[quarter_idx]
            ax4.text(q_date, reversal_y,
                     f'  IF BREAK: {reversal_label} ${reversal_entry:.0f}\n  TP ${reversal_tp:.0f} / SL ${reversal_sl:.0f}',
                     color=reversal_color, fontsize=7, fontweight="bold",
                     va="bottom" if not ema_bullish else "top",
                     bbox=dict(boxstyle="round,pad=0.12", fc=f"{reversal_color}10", ec=f"{reversal_color}33"))

        # ===== Summary box (top-right) =====
        rr1 = abs(tp1 - entry1) / abs(sl1 - entry1) if abs(sl1 - entry1) > 0 else 0
        rr2 = abs(tp2_1 - entry2) / abs(sl2 - entry2) if abs(sl2 - entry2) > 0 else 0
        summary = (
            f"TRADE 1: {pred_label}\n"
            f"  Entry ${entry1:.0f}  TP1 ${tp1:.0f}  SL ${sl1:.0f}\n"
            f"  R:R = 1:{rr1:.1f}\n"
            f"\n"
            f"TRADE 2: {second_label} (2ND CHANCE)\n"
            f"  Entry ${entry2:.0f}  TP ${tp2_1:.0f}  SL ${sl2:.0f}\n"
            f"  R:R = 1:{rr2:.1f}\n"
            f"\n"
            f"TRADE 3: {reversal_label} (IF BREAKOUT)\n"
            f"  Entry ${reversal_entry:.0f}  TP ${reversal_tp:.0f}"
        )
        ax4.text(0.99, 0.97, summary,
                 transform=ax4.transAxes, fontsize=8, fontweight="bold", color="#f0f4ff",
                 va="top", ha="right", fontfamily="monospace",
                 bbox=dict(boxstyle="round,pad=0.5", fc=BG, ec="#6b7a9944", alpha=0.92),
                 linespacing=1.4)

        fig4.savefig(str(assets_dir / "chart_m15.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig4)
        print("    -> Generated chart_m15.png (M15 + signals + prediction)")

    # ===== Chart 5: RSI (wider, proper scale) =====
    rsi_data = df_d1.tail(120)
    rsi_col = rsi_data["RSI"].dropna()
    if len(rsi_col) > 10:
        fig5, ax5 = plt.subplots(figsize=(16, 4.5), facecolor=BG)
        ax5.set_facecolor(BG)
        ax5.plot(rsi_col.index, rsi_col, color="#fbbf24", linewidth=2)
        ax5.fill_between(rsi_col.index, rsi_col, 50,
                         where=(rsi_col >= 50), alpha=0.08, color="#34d399")
        ax5.fill_between(rsi_col.index, rsi_col, 50,
                         where=(rsi_col < 50), alpha=0.08, color="#f87171")
        ax5.axhline(y=70, color="#f87171", linestyle="--", alpha=0.5, linewidth=1)
        ax5.axhline(y=30, color="#34d399", linestyle="--", alpha=0.5, linewidth=1)
        ax5.axhline(y=50, color="#6b7a99", linestyle="-", alpha=0.2, linewidth=1)
        ax5.text(0.01, 0.92, f'RSI(14) = {analysis["rsi"]:.0f}',
                 transform=ax5.transAxes, fontsize=16, fontweight="bold", color="#fbbf24", va="top",
                 bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec="#1a1f2e", alpha=0.9))

        zone = "OVERBOUGHT" if analysis["rsi"] > 70 else ("OVERSOLD" if analysis["rsi"] < 30 else "")
        if zone:
            zc = "#f87171" if "OVER" in zone and "BOUGHT" in zone else "#34d399"
            ax5.text(0.15, 0.92, zone, transform=ax5.transAxes, fontsize=14, color=zc,
                     fontweight="bold", va="top")

        ax5.set_ylim(10, 90)
        ax5.set_ylabel("RSI", color="#6b7a99", fontsize=11)
        ax5.tick_params(colors="#6b7a99", labelsize=9)
        ax5.grid(True, alpha=0.1, color="#1a1f2e")
        for sp in ax5.spines.values():
            sp.set_color("#1a1f2e")
        plt.tight_layout()
        fig5.savefig(str(assets_dir / "chart_rsi.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig5)
        print("    -> Generated chart_rsi.png (RSI 120-bar)")


def _fallback_yfinance(out_dir):
    """Fallback for GitHub Actions where MT5 is unavailable."""
    try:
        import yfinance as yf
    except ImportError:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    assets_dir = out_dir / "assets"
    assets_dir.mkdir(exist_ok=True)

    print("    -> Fallback: Yahoo Finance...")
    df = yf.Ticker("GC=F").history(period="6mo")
    if df.empty:
        return None

    df["SMA20"] = df["Close"].rolling(20).mean()
    df["SMA50"] = df["Close"].rolling(50).mean()
    df["SMA200"] = df["Close"].rolling(200).mean()
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df["RSI"] = 100 - (100 / (1 + gain / loss))

    last = df.iloc[-1]
    prev = df.iloc[-2]
    change = float(last["Close"] - prev["Close"])
    sma20 = float(last["SMA20"]) if pd.notna(last["SMA20"]) else 0
    sma50 = float(last["SMA50"]) if pd.notna(last["SMA50"]) else 0
    rsi = float(last["RSI"]) if pd.notna(last["RSI"]) else 50
    sh, sl, shi, sli = _find_swing_points(df, 60)
    fib = _calc_fib_levels(sh, sl)

    analysis = {
        "date": datetime.now().strftime("%Y-%m-%d"), "symbol": "XAUUSD",
        "price": round(float(last["Close"]), 2),
        "change": round(change, 2),
        "change_pct": round(change / float(prev["Close"]) * 100, 2),
        "week_change_pct": 0,
        "sma20": round(sma20, 2), "sma50": round(sma50, 2),
        "rsi": round(rsi, 1),
        "trend": "BULLISH" if sma20 > sma50 else "BEARISH",
        "support": round(float(df.tail(20)["Low"].min()), 2),
        "resistance": round(float(df.tail(20)["High"].max()), 2),
        "fib_levels": fib, "swing_high": round(sh, 2), "swing_low": round(sl, 2),
    }
    with open(out_dir / "market_data.json", "w") as f:
        json.dump(analysis, f, indent=2)

    _generate_all_charts(df, None, None, None, analysis, shi, sli, assets_dir)
    return analysis


if __name__ == "__main__":
    r = fetch_gold_data(Path("test_gold"))
    if r:
        print(json.dumps(r, indent=2))
