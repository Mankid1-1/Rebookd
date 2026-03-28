/**
 * Self-contained busy page — zero external assets.
 * Branded with Rebooked colours: Navy, Teal, Gold.
 */

export const BUSY_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="15">
<title>Rebooked — Be Right Back</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0D1B2A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
.card{text-align:center;max-width:480px;width:100%;padding:3rem 2rem;border:1px solid rgba(0,168,150,.25);border-radius:16px;background:rgba(255,255,255,.03)}
.logo{font-size:1.75rem;font-weight:700;color:#E8920A;letter-spacing:-.5px;margin-bottom:2rem}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem;color:#fff}
p{color:#94A3B8;font-size:1rem;line-height:1.6;margin-bottom:2rem}
.dots{display:flex;justify-content:center;gap:6px;margin-bottom:1.5rem}
.dots span{width:10px;height:10px;border-radius:50%;background:#00A896;animation:pulse 1.4s ease-in-out infinite}
.dots span:nth-child(2){animation-delay:.2s}
.dots span:nth-child(3){animation-delay:.4s}
@keyframes pulse{0%,80%,100%{opacity:.25;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
.hint{color:#64748B;font-size:.8rem}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Rebooked</div>
  <div class="dots"><span></span><span></span><span></span></div>
  <h1>We'll be right back</h1>
  <p>Rebooked is experiencing higher than usual traffic right now. This page will automatically refresh in a few seconds — no need to do anything.</p>
  <p class="hint">If you have an account, you'll be let through as soon as capacity frees up.</p>
</div>
</body>
</html>`;

export const BUSY_PAGE_JSON = {
  error: "Server is temporarily busy",
  message: "Rebooked is experiencing higher than usual traffic. Please retry shortly.",
  retryAfter: 30,
};
