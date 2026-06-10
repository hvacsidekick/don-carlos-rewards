# Windows Build Notes

**Project:** Don Carlos Rewards App
**Applies to:** Local development on Windows (Next.js 15.5.19)
**Phase 1 reference:** M-1 (build flakiness mitigation)

---

## TL;DR

If `npm run build` ever fails on Windows with an intermittent `ENOENT`
(file-rename/open race) during **"Collecting build traces / Finalizing"**, add
Windows Defender real-time-scan exclusions for this repo:

```powershell
npm run win:defender-exclude
```

(The script self-elevates to administrator and is safe to re-run.)

This is **not currently required** — the build is green on this machine — but the
mitigation is documented and scripted so it is one command away if the race
resurfaces on another Windows box.

---

## 1. Background

`next build` on Windows can intermittently fail in the final stages with a
filesystem race, e.g.:

```
ENOENT  rename '.next\export\500.html' -> '.next\server\pages\500.html'
ENOENT  open   '.next\static\<id>\_ssgManifest.js'
```

**Root cause:** Windows Defender real-time protection briefly holds a handle on a
file Next.js has just written inside `.next`, so the immediately-following
`rename`/`open` loses the race. This is a Windows-specific antivirus contention
issue, **not** a defect in the app's source. Linux/CI builds are unaffected.

### Current reproduction status

- The **original** Phase 1 builder report noted "2 of 4 clean builds failed."
- The hostile **audit** re-ran 5 consecutive clean builds — **5/5 green** — and
  **withdrew** the blocker as non-reproducible.
- The **re-audit** and this **verification** each ran a fresh clean build —
  exit 0, no ENOENT. See `PHASE_1_REAUDIT_REPORT.md` §1 and
  `PHASE_1_VERIFIED.md`.

So today the issue does not reproduce. The notes below exist as a documented
fallback, per the Phase 1 paper-trail requirement (M-1).

---

## 2. Recommended mitigation — Defender exclusions

The repo ships a helper script:

- **Script:** `scripts/windows-defender-exclude.ps1`
- **npm alias:** `npm run win:defender-exclude`

It adds real-time-scan exclusions for:

| Exclusion | Why |
|---|---|
| repo root | covers all build inputs/outputs |
| `.next/` | the output dir where the rename/open race occurs |
| `node_modules/` | reduces scan contention on the compiler's reads |
| the `node` process | excludes the Next.js compiler/worker pool itself |

Run it once per machine (requires administrator; the script self-elevates):

```powershell
npm run win:defender-exclude
```

Verify the exclusions were applied:

```powershell
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```

> **Security note:** excluding a directory from real-time scanning reduces
> antivirus coverage for that path. Only exclude trusted project directories on a
> developer machine. Do **not** apply these exclusions on shared or production
> hosts.

---

## 3. Build verification checklist (Windows)

Before relying on a local Windows build for a merge:

1. `npm run build` → expect **exit 0** and the route table printed.
2. If it fails with `ENOENT` in the finalizing/trace stage, run
   `npm run win:defender-exclude`, then re-build.
3. For extra confidence on a flaky machine, run **3 consecutive** clean builds.

---

## 4. Fallbacks

If exclusions do not resolve the race on a particular machine:

- **WSL2 / Linux:** build inside a Linux environment (no Defender file-lock
  contention).
- **CI:** release builds run on Linux CI, which is unaffected by this
  Windows-only race. Treat CI as the source of truth for release artifacts.

---

## 5. References

- `scripts/windows-defender-exclude.ps1` — the exclusion helper.
- `PHASE_1_AUDIT_REPORT.md` — withdrew the flakiness blocker (5/5 green).
- `PHASE_1_REAUDIT_REPORT.md` §1 / §4 — clean build; M-1 paper-trail note.
- `PHASE_1_VERIFIED.md` — final sign-off, including the build re-run.
- Next.js Windows ENOENT during build traces — known class of issue in the
  Next.js 15.x tracker; mitigated by AV exclusions as above.
