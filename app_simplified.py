import streamlit as st
import pandas as pd
import yfinance as yf
from ta.momentum import RSIIndicator
from ta.trend import SMAIndicator, MACD
from datetime import datetime

st.set_page_config(page_title="Copilot Simplifié", layout="wide")

def normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty: 
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]
    for col in ["Open","High","Low","Close","Volume"]:
        if col in df.columns and isinstance(df[col], pd.DataFrame):
            df[col] = df[col].iloc[:,0]
    return df

def compute_signals(df: pd.DataFrame):
    df = normalize_ohlcv(df).copy()
    if df.empty or len(df) < 50:
        return None
    close = pd.to_numeric(df["Close"], errors="coerce")
    high  = pd.to_numeric(df["High"],  errors="coerce")

    sma20 = SMAIndicator(close, 20).sma_indicator()
    sma50 = SMAIndicator(close, 50).sma_indicator()
    rsi14 = RSIIndicator(close, 14).rsi()
    macd  = MACD(close, 12, 26, 9)
    macd_line = macd.macd()
    macd_sig  = macd.macd_signal()

    trend_up      = bool(sma20.iloc[-1] > sma50.iloc[-1])
    macd_up       = bool(macd_line.iloc[-1] > macd_sig.iloc[-1] and macd_line.iloc[-2] <= macd_sig.iloc[-2])
    rsi_bounce    = bool(rsi14.iloc[-1] > 40 and rsi14.iloc[-2] <= 40)
    breakout20    = bool(close.iloc[-1] > high.rolling(20).max().shift(1).iloc[-1])

    if trend_up and close.iloc[-1] > sma20.iloc[-1]:
        tendance = "Haussière"
    elif close.iloc[-1] < sma50.iloc[-1]:
        tendance = "Baissière"
    else:
        tendance = "Range"

    checks = {
        "breakout20": breakout20,
        "trend_up": trend_up,
        "macd_up": macd_up,
        "rsi_bounce": rsi_bounce
    }
    confiance = sum(1 for v in checks.values() if v)
    if confiance >= 3:
        signal = "Fort";   action = "✅ Acheter / Conserver"
    elif confiance == 2:
        signal = "Moyen";  action = "⏳ Attendre / Entrée sur repli"
    elif confiance == 1:
        signal = "Faible"; action = "⏳ Attendre"
    else:
        signal = "Neutre"; action = "❌ Éviter / Observer"

    details = {
        "close": float(close.iloc[-1]),
        "sma20": float(sma20.iloc[-1]),
        "sma50": float(sma50.iloc[-1]),
        "rsi14": float(rsi14.iloc[-1]),
        "macd": float(macd_line.iloc[-1]),
        "macd_signal": float(macd_sig.iloc[-1]),
        "checks": checks
    }
    commentaire = build_commentary(tendance, details)
    return tendance, signal, action, details, commentaire

def build_commentary(tendance: str, d: dict) -> str:
    parts = []
    if d["checks"]["breakout20"]: parts.append("Breakout20 validé")
    if d["checks"]["trend_up"]:   parts.append("TrendUp (SMA20 > SMA50)")
    if d["checks"]["macd_up"]:    parts.append("MACD haussier")
    if d["checks"]["rsi_bounce"]: parts.append("RSI rebond > 40")

    msg = [f"Tendance: {tendance}."]
    if parts: msg.append("Signaux: " + ", ".join(parts) + ".")
    if tendance == "Haussière" and d["checks"]["breakout20"]:
        msg.append("Entrée possible maintenant; pullback sur SMA20 = timing propre.")
    elif tendance == "Haussière":
        msg.append("Conserver; attendre un repli vers SMA20 pour renforcer.")
    elif tendance == "Range":
        msg.append("Attendre cassure de range pour éviter les faux départs.")
    else:
        msg.append("Sous SMA50: privilégier l'attente ou des rebonds très tactiques.")
    return " ".join(msg)

st.title("Copilot Simplifié — Pro mais clair")
st.caption("Résumé : Valeur • Tendance • Signal • Action. Détails = RSI/MACD/MM + commentaire pro.")

default_list = "AIR.PA, TTE.PA, MEDCL.PA, ADOC.PA, AMZN, NVDA, FIG, BTC-USD, LINK-USD, RNDR-USD, NEAR-USD, ETH-USD, ARB-USD"
wl_text = st.text_input("Watchlist (sépare par des virgules)", value=default_list)
tickers = [t.strip() for t in wl_text.split(",") if t.strip()]

colp = st.columns([1,1,1,1,1])
with colp[0]:
    period = st.selectbox("Période (daily)", ["6mo","1y","2y"], index=1)
with colp[1]:
    intrv = st.selectbox("Intervalle", ["1d","1h"], index=0)
with colp[2]:
    run = st.button("Scanner")
with colp[3]:
    auto = st.checkbox("Auto-refresh (60s)")
with colp[4]:
    st.write(datetime.now().strftime("📅 %Y-%m-%d %H:%M"))

if auto:
    st.autorefresh(interval=60*1000, key="auto_refresh")

if run or auto:
    rows = []
    raw_details = {}
    for t in tickers:
        try:
            df = yf.download(t, period=period, interval=intrv, auto_adjust=True, progress=False)
            if df is None or df.empty:
                rows.append((t, "—", "—", "—")); continue
            res = compute_signals(df)
            if not res:
                rows.append((t, "—", "—", "—")); continue
            tendance, signal, action, details, comment = res
            rows.append((t, tendance, signal, action))
            raw_details[t] = (details, comment)
        except Exception:
            rows.append((t, "—", "—", "—"))

    dfv = pd.DataFrame(rows, columns=["Valeur","Tendance","Signal","Action"])
    st.dataframe(dfv, use_container_width=True)

    st.markdown("### Détails par valeur")
    for t in tickers:
        if t in raw_details:
            details, comment = raw_details[t]
            with st.expander(f"{t} — détails / commentaire"):
                c1, c2, c3, c4, c5, c6 = st.columns(6)
                c1.metric("Cours", f"{details['close']:.2f}")
                c2.metric("SMA20", f"{details['sma20']:.2f}")
                c3.metric("SMA50", f"{details['sma50']:.2f}")
                c4.metric("RSI14", f"{details['rsi14']:.1f}")
                c5.metric("MACD", f"{details['macd']:.3f}")
                c6.metric("Signal", f"{details['macd_signal']:.3f}")
                st.write("**Commentaire pro :** ", comment)
else:
    st.info("Saisis/valide ta watchlist puis clique **Scanner**. Tu peux activer *Auto‑refresh* pour un scan toutes les 60s.")
