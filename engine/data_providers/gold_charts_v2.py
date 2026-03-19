"""
GOLD DATA LAB v2 — Pro-level chart generation with SMC concepts.
Visualizes: Order Blocks, FVG, Liquidity, Divergence, BOS/CHOCH, Trade Setups.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

BG = "#0a0e1a"
GOLD = "#fbbf24"
GREEN = "#34d399"
RED = "#f87171"
BLUE = "#60a5fa"
PURPLE = "#c084fc"
WHITE = "#f0f4ff"
MUTED = "#6b7a99"
GRID = "#1a1f2e"
ORANGE = "#fb923c"
CYAN = "#22d3ee"


def _make_style():
    import mplfinance as mpf
    mc = mpf.make_marketcolors(
        up="#34d399", down="#f87171",
        edge={"up": "#34d39988", "down": "#f8717188"},
        wick={"up": "#34d399", "down": "#f87171"},
        volume={"up": "#34d39933", "down": "#f8717133"},
    )
    return mpf.make_mpf_style(
        marketcolors=mc, facecolor=BG, edgecolor=GRID,
        gridcolor=GRID, gridstyle="--", gridaxis="both", y_on_right=True,
        rc={"font.size": 10, "axes.labelcolor": MUTED,
            "xtick.color": MUTED, "ytick.color": MUTED,
            "text.color": WHITE, "figure.facecolor": BG},
    )


def generate_animated_charts(df_d1, df_h4, df_h1, df_m15, analysis, sh_idx, sl_idx, assets_dir, pro=None):
    """Generate all chart sequences with pro analysis overlays."""
    import matplotlib
    matplotlib.use("Agg")

    assets_dir.mkdir(parents=True, exist_ok=True)
    style = _make_style()

    _gen_d1_structure(df_d1, analysis, pro, style, assets_dir)
    _gen_fib_steps(df_h4, analysis, pro, style, assets_dir)
    _gen_h1_smc(df_h1, analysis, pro, style, assets_dir)
    _gen_m15_entries(df_m15, analysis, pro, style, assets_dir)
    _gen_rsi_divergence(df_d1, analysis, pro, assets_dir)

    print(f"    -> All pro charts generated in {assets_dir}")


def _gen_d1_structure(df, analysis, pro, style, out):
    """D1 with market structure: swing points, BOS, CHOCH, trend."""
    import mplfinance as mpf
    import matplotlib.pyplot as plt

    view = df.tail(90).copy()
    ap = []
    for col, color in [("SMA20", BLUE), ("SMA50", GOLD)]:
        if col in view.columns and view[col].notna().sum() > 10:
            ap.append(mpf.make_addplot(view[col], color=color, width=1.5))

    hlines = dict(hlines=[analysis["support"], analysis["resistance"]],
                  colors=[GREEN, RED], linestyle="--", linewidths=1)

    fig, axes = mpf.plot(view, type="candle", style=style, volume=True,
                         addplot=ap if ap else None, hlines=hlines,
                         figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                         panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
    fig.set_size_inches(16, 9)
    ax = axes[0]

    # Price label
    c = GREEN if analysis["change"] >= 0 else RED
    arrow = "\u25B2" if analysis["change"] >= 0 else "\u25BC"
    ax.text(0.01, 0.97, f'XAUUSD D1  ${analysis["price"]:.2f}  {arrow}{analysis["change_pct"]:+.2f}%',
            transform=ax.transAxes, fontsize=16, fontweight="bold", color=c, va="top",
            fontfamily="monospace", bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec=GRID, alpha=0.9))

    if pro:
        # Draw swing points (HH/HL/LH/LL)
        for sp in pro.swing_points:
            if sp.index in view.index:
                color = GREEN if sp.type in ("HH", "HL") else RED
                va = "bottom" if sp.type in ("HH", "LH", "SH") else "top"
                ax.annotate(sp.type, xy=(sp.index, sp.price),
                           fontsize=8, color=color, fontweight="bold", ha="center", va=va,
                           bbox=dict(boxstyle="round,pad=0.1", fc=f"{color}15", ec=f"{color}44"))

        # Draw BOS levels
        for bos in pro.bos_levels:
            if bos["index"] in view.index:
                bc = GREEN if "bullish" in bos["type"] else RED
                ax.axhline(y=bos["price"], color=bc, linestyle="-", alpha=0.3, linewidth=1)
                ax.text(view.index[1], bos["price"], f'  BOS ${bos["price"]:.0f}',
                       fontsize=7, color=bc, fontweight="bold", va="bottom",
                       bbox=dict(boxstyle="round,pad=0.08", fc=f"{bc}10", ec=f"{bc}33"))

        # Draw CHOCH
        for ch in pro.choch_levels:
            if ch["index"] in view.index:
                cc = CYAN
                ax.annotate(f'CHOCH', xy=(ch["index"], ch["price"]),
                           fontsize=9, color=cc, fontweight="bold", ha="center",
                           bbox=dict(boxstyle="round,pad=0.15", fc=f"{cc}20", ec=cc))

        # Trend + Bias
        ax.text(0.99, 0.97,
                f'BIAS: {pro.bias}\nD1: {pro.trend_d1}\nH4: {pro.trend_h4}\nH1: {pro.trend_h1}\nConfidence: {pro.confidence:.0f}%',
                transform=ax.transAxes, fontsize=10, fontweight="bold", color=WHITE, va="top", ha="right",
                fontfamily="monospace",
                bbox=dict(boxstyle="round,pad=0.4", fc=BG, ec=MUTED + "44", alpha=0.9))

    fig.savefig(str(out / "d1_structure.png"), dpi=100, facecolor=BG, bbox_inches=None)
    plt.close(fig)
    print("    -> d1_structure.png (market structure + BOS/CHOCH)")


def _gen_fib_steps(df_h4, analysis, pro, style, out):
    """Fibonacci step-by-step (4 frames) with OB/FVG overlay on final."""
    import mplfinance as mpf
    import matplotlib.pyplot as plt

    if df_h4 is None or len(df_h4) < 30:
        return

    view = df_h4.tail(120).copy()
    fib = analysis["fib_levels"]
    fib_items = list(fib.items())
    fib_colors = [RED, ORANGE, GOLD, WHITE, BLUE, PURPLE, GREEN]

    for step in range(4):
        fig, axes = mpf.plot(view, type="candle", style=style,
                             figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                             scale_width_adjustment=dict(candle=0.6))
        fig.set_size_inches(16, 9)
        ax = axes[0]

        if step >= 1:
            ax.axhline(y=analysis["swing_high"], color=RED, linestyle="-", alpha=0.7, linewidth=2)
            ax.axhline(y=analysis["swing_low"], color=GREEN, linestyle="-", alpha=0.7, linewidth=2)
            ax.text(0.01, 0.97, f'SWING: ${analysis["swing_low"]:.0f} \u2192 ${analysis["swing_high"]:.0f}',
                    transform=ax.transAxes, fontsize=13, color=WHITE, fontweight="bold", va="top",
                    bbox=dict(boxstyle="round,pad=0.2", fc=BG, ec=GRID, alpha=0.9))

        if step >= 2:
            for i in range(min(4, len(fib_items))):
                level, price = fib_items[i]
                ax.axhline(y=price, color=fib_colors[i], linestyle="--", alpha=0.5, linewidth=1)
                ax.text(view.index[2], price, f'  {level} ${price:.0f}',
                       color=fib_colors[i], fontsize=9, fontweight="bold", va="bottom")

        if step >= 3:
            for i in range(len(fib_items)):
                level, price = fib_items[i]
                ax.axhline(y=price, color=fib_colors[i % len(fib_colors)], linestyle="--", alpha=0.4, linewidth=1)
                ax.text(view.index[2], price, f'  {level} ${price:.0f}',
                       color=fib_colors[i % len(fib_colors)], fontsize=8, fontweight="bold", va="bottom")

            # Overlay OBs on fib chart
            if pro:
                for ob in pro.order_blocks[:3]:
                    if ob.high < ax.get_ylim()[1] and ob.low > ax.get_ylim()[0]:
                        obc = GREEN + "18" if ob.type == "bullish" else RED + "18"
                        ax.axhspan(ob.low, ob.high, color=obc)
                        ax.text(view.index[-5], (ob.high + ob.low) / 2,
                               f'OB {ob.type[0].upper()} ({ob.strength:.0%})',
                               fontsize=8, color=GREEN if ob.type == "bullish" else RED,
                               fontweight="bold", ha="center",
                               bbox=dict(boxstyle="round,pad=0.1", fc=BG, ec=GRID, alpha=0.8))

                # FVG zones
                for fvg in pro.fair_value_gaps[:3]:
                    if fvg.high < ax.get_ylim()[1] and fvg.low > ax.get_ylim()[0]:
                        fc = CYAN + "10"
                        ax.axhspan(fvg.low, fvg.high, color=fc)
                        ax.text(view.index[-10], (fvg.high + fvg.low) / 2,
                               f'FVG', fontsize=7, color=CYAN, fontweight="bold", ha="center")

            # Current price zone
            cp = analysis["price"]
            prices = sorted([p for _, p in fib_items], reverse=True)
            for j in range(len(prices) - 1):
                if prices[j] >= cp >= prices[j + 1]:
                    ax.axhspan(prices[j + 1], prices[j], color=GOLD + "08")
                    break

        label = ["H4 CHART", "SWING POINTS", "FIB LEVELS", "FIB + OB + FVG"][step]
        ax.text(0.99, 0.03, label, transform=ax.transAxes, fontsize=12, color=GOLD,
                fontweight="bold", va="bottom", ha="right",
                bbox=dict(boxstyle="round,pad=0.2", fc=BG, ec=GOLD + "44", alpha=0.9))

        fig.savefig(str(out / f"fib_step{step + 1}.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig)

    print("    -> fib_step1-4.png (animated fib + OB + FVG)")


def _gen_h1_smc(df_h1, analysis, pro, style, out):
    """H1 with OB zones, FVG, and predicted formation path."""
    import mplfinance as mpf
    import matplotlib.pyplot as plt

    if df_h1 is None or len(df_h1) < 20:
        return

    view = df_h1.copy()
    view["EMA12"] = view["Close"].ewm(span=12).mean()
    view["EMA26"] = view["Close"].ewm(span=26).mean()
    ap = []
    if view["EMA12"].notna().sum() > 5:
        ap.append(mpf.make_addplot(view["EMA12"], color=BLUE, width=1.5))
    if view["EMA26"].notna().sum() > 5:
        ap.append(mpf.make_addplot(view["EMA26"], color=GOLD, width=1.5))

    fig, axes = mpf.plot(view, type="candle", style=style, volume=True,
                         addplot=ap if ap else None,
                         figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                         panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
    fig.set_size_inches(16, 9)
    ax = axes[0]

    ax.text(0.01, 0.97, 'XAUUSD H1 — SMART MONEY ANALYSIS',
            transform=ax.transAxes, fontsize=14, fontweight="bold", color=WHITE, va="top",
            bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec=GRID, alpha=0.9))

    if pro:
        # Draw OB zones
        for ob in pro.order_blocks[:3]:
            ylim = ax.get_ylim()
            if ob.low > ylim[0] and ob.high < ylim[1]:
                obc = GREEN if ob.type == "bullish" else RED
                ax.axhspan(ob.low, ob.high, color=f"{obc}12")
                ax.text(view.index[len(view) // 2], ob.high,
                       f' OB {ob.type.upper()} ({ob.strength:.0%})',
                       fontsize=8, color=obc, fontweight="bold", va="bottom",
                       bbox=dict(boxstyle="round,pad=0.08", fc=BG, ec=f"{obc}44", alpha=0.8))

        # Draw FVG
        for fvg in pro.fair_value_gaps[:3]:
            ylim = ax.get_ylim()
            if fvg.low > ylim[0] and fvg.high < ylim[1]:
                ax.axhspan(fvg.low, fvg.high, color=f"{CYAN}08")
                mid = (fvg.high + fvg.low) / 2
                ax.text(view.index[3], mid, f'  FVG ${fvg.low:.0f}-${fvg.high:.0f}',
                       fontsize=7, color=CYAN, fontweight="bold",
                       bbox=dict(boxstyle="round,pad=0.06", fc=BG, ec=f"{CYAN}33", alpha=0.8))

        # Draw liquidity zones
        for lz in pro.liquidity_zones[:3]:
            ylim = ax.get_ylim()
            if ylim[0] < lz.price < ylim[1]:
                ax.axhline(y=lz.price, color=ORANGE, linestyle=":", alpha=0.5, linewidth=1)
                ax.text(view.index[-3], lz.price,
                       f'  LIQ ${lz.price:.0f} ({lz.strength}x)',
                       fontsize=7, color=ORANGE, fontweight="bold", va="bottom",
                       bbox=dict(boxstyle="round,pad=0.06", fc=BG, ec=f"{ORANGE}33", alpha=0.8))

    # Prediction arrow
    last_price = float(view["Close"].iloc[-1])
    last_date = view.index[-1]
    h1_range = float(view.tail(24)["High"].max()) - float(view.tail(24)["Low"].min())
    ema12 = float(view["EMA12"].iloc[-1]) if view["EMA12"].notna().any() else last_price
    ema26 = float(view["EMA26"].iloc[-1]) if view["EMA26"].notna().any() else last_price
    bullish = ema12 > ema26

    if pro and pro.setups:
        top = pro.setups[0]
        target = top.tp1
        pc = GREEN if top.direction == "LONG" else RED
        ax.annotate("", xy=(last_date, target), xytext=(last_date, last_price),
                    arrowprops=dict(arrowstyle="-|>", color=pc, lw=3, ls="--"))
        ax.text(last_date, target, f'  TP1 ${target:.0f}', color=pc,
               fontsize=10, fontweight="bold",
               va="bottom" if target > last_price else "top",
               bbox=dict(boxstyle="round,pad=0.12", fc=f"{pc}15", ec=f"{pc}44"))

    fig.savefig(str(out / "h1_smc.png"), dpi=100, facecolor=BG, bbox_inches=None)
    plt.close(fig)
    print("    -> h1_smc.png (H1 + OB + FVG + liquidity)")


def _gen_m15_entries(df_m15, analysis, pro, style, out):
    """Generate 3 M15 charts, one per trade setup from pro analysis."""
    import mplfinance as mpf
    import matplotlib.pyplot as plt

    if df_m15 is None or len(df_m15) < 20:
        return

    m15 = df_m15.copy()
    m15["EMA9"] = m15["Close"].ewm(span=9).mean()
    m15["EMA21"] = m15["Close"].ewm(span=21).mean()

    ap_base = []
    if m15["EMA9"].notna().sum() > 5:
        ap_base.append(mpf.make_addplot(m15["EMA9"], color=PURPLE, width=1.5))
    if m15["EMA21"].notna().sum() > 5:
        ap_base.append(mpf.make_addplot(m15["EMA21"], color=GREEN, width=1.5))

    setups = pro.setups if pro else []
    if not setups:
        return

    for i, setup in enumerate(setups[:3]):
        fig, axes = mpf.plot(m15, type="candle", style=style, volume=True,
                             addplot=ap_base if ap_base else None,
                             figsize=(16, 9), figscale=0.5, title="", returnfig=True,
                             panel_ratios=(5, 1), scale_width_adjustment=dict(candle=0.6, volume=0.4))
        fig.set_size_inches(16, 9)
        ax = axes[0]

        ec = GREEN if setup.direction == "LONG" else RED
        last_date = m15.index[-1]

        # Entry line
        ax.axhline(y=setup.entry, color=GOLD, linestyle="-", alpha=0.6, linewidth=2)
        ax.text(m15.index[1], setup.entry, f'  ENTRY ${setup.entry:.0f}', color=GOLD,
                fontsize=10, fontweight="bold", va="bottom",
                bbox=dict(boxstyle="round,pad=0.12", fc="#fbbf2415", ec="#fbbf2444"))

        # TP lines
        for tp_val, tp_label, alpha in [(setup.tp1, "TP1", 0.7), (setup.tp2, "TP2", 0.5), (setup.tp3, "TP3", 0.3)]:
            ax.axhline(y=tp_val, color=ec, linestyle="--", alpha=alpha, linewidth=1.2)
            ax.text(m15.index[1], tp_val, f'  {tp_label} ${tp_val:.0f}', color=ec,
                    fontsize=9, fontweight="bold",
                    va="bottom" if tp_val > setup.entry else "top",
                    bbox=dict(boxstyle="round,pad=0.1", fc=f"{ec}10", ec=f"{ec}33"))

        # SL line
        sl_c = RED if setup.sl < setup.entry else GREEN
        ax.axhline(y=setup.sl, color=sl_c, linestyle="-.", alpha=0.6, linewidth=1.5)
        ax.text(m15.index[1], setup.sl, f'  SL ${setup.sl:.0f}', color=sl_c,
                fontsize=9, fontweight="bold",
                va="top" if setup.sl < setup.entry else "bottom",
                bbox=dict(boxstyle="round,pad=0.1", fc=f"{sl_c}12", ec=f"{sl_c}44"))

        # Prediction arrow
        ax.annotate("", xy=(last_date, setup.tp1), xytext=(last_date, setup.entry),
                    arrowprops=dict(arrowstyle="-|>", color=ec, lw=3, ls="--"))

        # OB zone if nearby
        if pro:
            for ob in pro.order_blocks[:2]:
                ylim = ax.get_ylim()
                if ob.low > ylim[0] and ob.high < ylim[1]:
                    obc = GREEN if ob.type == "bullish" else RED
                    ax.axhspan(ob.low, ob.high, color=f"{obc}08")

        # Title with score
        score_bar = "\u2588" * int(setup.confluence_score) + "\u2591" * (10 - int(setup.confluence_score))
        ax.text(0.01, 0.97, f'{setup.label}  [{score_bar}] {setup.confluence_score}/10',
                transform=ax.transAxes, fontsize=14, fontweight="bold", color=ec, va="top",
                bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec=f"{ec}66", alpha=0.9))

        # Reasons box
        reasons_text = "\n".join(f"\u2022 {r}" for r in setup.reasons[:4])
        ax.text(0.99, 0.97, f'R:R 1:{setup.risk_reward}\n\n{reasons_text}',
                transform=ax.transAxes, fontsize=9, fontweight="bold", color=WHITE, va="top", ha="right",
                fontfamily="monospace",
                bbox=dict(boxstyle="round,pad=0.4", fc=BG, ec=MUTED + "44", alpha=0.9),
                linespacing=1.5)

        # Description
        ax.text(0.01, 0.03, f'{setup.direction}  Entry ${setup.entry:.0f}  SL ${setup.sl:.0f}  TP1 ${setup.tp1:.0f}  TP2 ${setup.tp2:.0f}  TP3 ${setup.tp3:.0f}',
                transform=ax.transAxes, fontsize=11, color=MUTED, fontweight="bold", va="bottom",
                fontfamily="monospace",
                bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec=GRID, alpha=0.9))

        fig.savefig(str(out / f"m15_entry{i + 1}.png"), dpi=100, facecolor=BG, bbox_inches=None)
        plt.close(fig)

    print(f"    -> m15_entry1-{min(3, len(setups))}.png (pro trade setups)")


def _gen_rsi_divergence(df_d1, analysis, pro, out):
    """RSI chart with divergence lines drawn."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if "RSI" not in df_d1.columns:
        from data_providers.pro_analysis import compute_rsi
        df_d1["RSI"] = compute_rsi(df_d1)

    rsi_data = df_d1.tail(90)
    rsi_col = rsi_data["RSI"].dropna()
    if len(rsi_col) < 10:
        return

    fig, (ax_price, ax_rsi) = plt.subplots(2, 1, figsize=(16, 9), facecolor=BG,
                                            gridspec_kw={"height_ratios": [2, 1]})

    # Price chart (top)
    ax_price.set_facecolor(BG)
    ax_price.plot(rsi_data.index, rsi_data["Close"], color=GOLD, linewidth=2)
    ax_price.fill_between(rsi_data.index, rsi_data["Close"], alpha=0.05, color=GOLD)
    ax_price.set_ylabel("Price", color=MUTED, fontsize=10)
    ax_price.tick_params(colors=MUTED, labelsize=8)
    ax_price.grid(True, alpha=0.08, color=GRID)
    for sp in ax_price.spines.values():
        sp.set_color(GRID)

    # RSI chart (bottom)
    ax_rsi.set_facecolor(BG)
    ax_rsi.plot(rsi_col.index, rsi_col, color=GOLD, linewidth=2)
    ax_rsi.fill_between(rsi_col.index, rsi_col, 50,
                        where=(rsi_col >= 50), alpha=0.08, color=GREEN)
    ax_rsi.fill_between(rsi_col.index, rsi_col, 50,
                        where=(rsi_col < 50), alpha=0.08, color=RED)
    ax_rsi.axhline(y=70, color=RED, linestyle="--", alpha=0.5, linewidth=1)
    ax_rsi.axhline(y=30, color=GREEN, linestyle="--", alpha=0.5, linewidth=1)
    ax_rsi.set_ylim(10, 90)
    ax_rsi.set_ylabel("RSI(14)", color=MUTED, fontsize=10)
    ax_rsi.tick_params(colors=MUTED, labelsize=8)
    ax_rsi.grid(True, alpha=0.08, color=GRID)
    for sp in ax_rsi.spines.values():
        sp.set_color(GRID)

    # Draw divergences
    if pro:
        for div in pro.divergences:
            if div.start_idx in rsi_data.index and div.end_idx in rsi_data.index:
                dc = GREEN if "bullish" in div.type else RED
                ls = "-" if "regular" in div.type else "--"

                # Price line
                ax_price.plot([div.start_idx, div.end_idx],
                             [div.price_start, div.price_end],
                             color=dc, linewidth=2.5, linestyle=ls)
                # RSI line
                ax_rsi.plot([div.start_idx, div.end_idx],
                           [div.rsi_start, div.rsi_end],
                           color=dc, linewidth=2.5, linestyle=ls)

                # Label
                label = div.type.replace("_", " ").upper()
                ax_rsi.text(div.end_idx, div.rsi_end, f'  {label}',
                           fontsize=8, color=dc, fontweight="bold",
                           bbox=dict(boxstyle="round,pad=0.1", fc=BG, ec=f"{dc}44", alpha=0.9))

    # RSI value
    rsi_val = analysis.get("rsi", 50)
    zone = "OVERBOUGHT" if rsi_val > 70 else ("OVERSOLD" if rsi_val < 30 else "")
    zone_c = RED if rsi_val > 70 else (GREEN if rsi_val < 30 else MUTED)

    ax_price.text(0.01, 0.95, f'RSI DIVERGENCE ANALYSIS',
                  transform=ax_price.transAxes, fontsize=14, fontweight="bold", color=WHITE, va="top",
                  bbox=dict(boxstyle="round,pad=0.3", fc=BG, ec=GRID, alpha=0.9))
    ax_rsi.text(0.01, 0.9, f'RSI = {rsi_val:.0f} {zone}',
                transform=ax_rsi.transAxes, fontsize=13, fontweight="bold", color=zone_c, va="top",
                bbox=dict(boxstyle="round,pad=0.2", fc=BG, ec=GRID, alpha=0.9))

    if pro and pro.divergences:
        div_summary = f'{len(pro.divergences)} divergence(s) detected'
        ax_price.text(0.99, 0.95, div_summary, transform=ax_price.transAxes,
                     fontsize=11, color=CYAN, fontweight="bold", va="top", ha="right",
                     bbox=dict(boxstyle="round,pad=0.2", fc=BG, ec=f"{CYAN}44", alpha=0.9))

    plt.tight_layout()
    fig.savefig(str(out / "rsi_divergence.png"), dpi=100, facecolor=BG)
    plt.close(fig)
    print("    -> rsi_divergence.png (RSI + divergence lines)")
