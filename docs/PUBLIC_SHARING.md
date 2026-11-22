# Public Sharing & Tunnels

Why `localhost` links fail for other people and how to share deployments publicly.

## The problem

`http://localhost:5173/sites/<id>/` only resolves on **your** machine. Anyone else opening it hits *their* localhost → nothing loads.

## Option A — Quick tunnel (demo, no account)

Cloudflare quick tunnel (we used this):

```powershell
# PowerShell (NOT bash $HOME syntax)
& "$env:USERPROFILE\Downloads\cloudflared.exe" tunnel --url http://localhost:5173
```

- Binary: `cloudflared.exe` (downloaded to `~/Downloads`).
- Gives `https://<random>.trycloudflare.com` — share that + `/sites/<id>/`.
- Works for **viewing deployed sites and sign-in** after we set `VITE_API_URL=` (same-origin `/api`) and added the domain to Firebase authorized domains.
- **URL changes every restart**; the PC must stay on.

### One-time setup we already did for the tunnel domain

- `apps/web/.env`: `VITE_API_URL=` (empty → same-origin API/socket via Vite proxy).
- Firebase Authorized domains: added `transmission-galaxy-geek-weblogs.trycloudflare.com` via Identity Toolkit config API.
- API CORS already allows localhost/127.0.0.1 dev origins; same-origin proxy means browsers never hit the API cross-origin.

If the tunnel URL changes, re-add the new `*.trycloudflare.com` host to Firebase authorized domains or sign-in will fail with `auth/unauthorized-domain`.

## Option B — ngrok

`ngrok http 5173` needs a newer agent (≥3.30) and an authtoken; the installed 3.22.1 is too old and can’t self-update without admin. Use cloudflared instead unless you upgrade ngrok.

## Option C — Permanent public deploy (real fix)

1. Deploy FLASHLIVE on a VPS/cloud VM: `docker compose up --build`.
2. Point a domain at it; set `WEB_ORIGIN=https://your-domain`.
3. Update GitHub OAuth App callback to `https://your-domain/api/github/callback` and `GITHUB_CALLBACK_URL`.
4. Add the domain to Firebase **Authorized domains**.
5. Keep `VITE_API_URL=` empty so API/socket stay same-origin.

Until then, treat tunnels as demo-only.
