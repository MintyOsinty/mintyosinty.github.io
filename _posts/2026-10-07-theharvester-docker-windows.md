---
layout: post
title: "Running theHarvester on Windows with Docker"
date: 2026-10-07
categories: [tools, osint]
tags: [theharvester, docker, windows, osint, recon]
description: "A step-by-step guide to building theHarvester's Docker version on Windows, from installing Docker Desktop to your first email and subdomain hunt."
---

theHarvester is one of the classic OSINT recon tools. Point it at a domain and it pulls subdomains, email addresses, IPs, URLs and more from dozens of public sources, such as certificate transparency logs, search engines, threat-intel platforms and code repositories.

## Linux first, but Windows works too

theHarvester is a **Linux-based tool**, and it runs best on Linux. If you have a Kali Linux VM (or any Linux machine), that's the smoothest route. On Kali, it's a single command:

```bash
sudo apt install theharvester
```

You'll find it in the Kali menu under Information Gathering. Kali's official help page for the tool is linked in the Further reading section at the end.

If you don't have a Linux VM, you can still run it on Windows. This guide walks through running the official Docker version there. Docker quietly runs a small Linux environment in the background, so theHarvester still gets the Linux setup it expects, and you don't have to build or manage a VM yourself. You get **HarvestView**, a point-and-click web dashboard, plus the full command-line tool, all inside a locked-down container.

**Not a command-line person?** You only need PowerShell for the one-time setup. After that, you can do everything from the HarvestView GUI in your browser and the Docker Desktop app.

I'll also cover the snags I hit along the way, so you don't lose an afternoon to them.

> **Before you start:** Only run theHarvester against domains you own or have written permission to assess. Passive lookups are low-impact, but the active options send traffic straight to the target. More on that at the end.

---

## What you'll need

- Windows 10 or 11 (64-bit)
- Hardware virtualization enabled. Check in **Task Manager → Performance → CPU** for "Virtualization: Enabled"
- About 5 GB of free disk space
- PowerShell. All commands below are PowerShell, not Command Prompt.

---

## Step 1: Install Docker Desktop and Git

Open PowerShell and run:

```powershell
winget install --id Docker.DockerDesktop
winget install --id Git.Git
```

Reboot when the installs finish. Docker Desktop uses **WSL 2** (Windows Subsystem for Linux) behind the scenes. If it asks to enable or update WSL, let it.

---

## Step 2: Start Docker and wait for it

Launch **Docker Desktop** from the Start menu.

Docker doesn't start the moment you open it. It has to boot a small Linux VM first, which can take **30 seconds to 2 minutes**, and longer on the first few launches. When it's ready, the bottom-left corner of the Docker Desktop window shows **Engine running** in green.

If you try to run commands before then, you'll get an error like this:

```
failed to connect to the docker API at npipe:////./pipe/docker_engine
```

That error doesn't mean anything is broken. The engine just isn't up yet. Wait for "Engine running" and try again.

To check from PowerShell, this command waits until Docker is ready:

```powershell
while (-not (docker info 2>$null)) { Write-Host "Waiting for Docker..."; Start-Sleep 5 }; Write-Host "Docker is ready"
```

**Tip:** Docker Desktop doesn't run after a reboot unless you tell it to. Turn on **Settings → General → Start Docker Desktop when you sign in to your computer**, and it'll be warmed up by the time you need it.

---

## Step 3: Download theHarvester

```powershell
cd $HOME
git clone https://github.com/laramies/theHarvester.git
cd theHarvester
```

---

## Step 4: Create your operator key

HarvestView's API is protected by a secret key that you generate yourself. The official instructions use Linux commands, so here's the PowerShell version:

```powershell
New-Item -ItemType Directory -Force .secrets | Out-Null
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
(($b | ForEach-Object { $_.ToString('x2') }) -join '') | Set-Content -NoNewline -Encoding ascii .secrets\operator-api-key
```

This creates a random 64-character key in `.secrets\operator-api-key`. Treat it like a password.

---

## Step 5: Build and start the container

With Docker showing **Engine running**:

```powershell
docker compose up --build -d
```

The first build takes a few minutes because it downloads Python and a headless Chromium browser for screenshots. When it finishes, check the status:

```powershell
docker compose ps
```

Wait until the status reads **healthy**. The container also appears under **Containers** in Docker Desktop, where you can start, stop and view logs with a click.

---

## Step 6: Open HarvestView

Open your browser and go to:

**http://127.0.0.1:5000**

If you're asked for a key, paste the output of:

```powershell
Get-Content .secrets\operator-api-key
```

The service only listens on `127.0.0.1`, so other machines on your network can't reach it. Leave it that way.

---

## Step 7: Using the GUI

HarvestView is the graphical side of theHarvester. Anything the command line can do, you can also do with a few clicks.

**Starting a run**

1. Enter the domain you want to investigate.
2. Pick your sources. They're grouped by activity level: **P0** passive sources, **P1** DNS interaction and **P2** direct interaction. Each one lists what it returns (subdomains, emails, IPs and so on) and whether it needs an API key. Sources marked **Needs configuration** stay unavailable until you add a key (see Step 10).
3. Start the run and watch each source report its progress as it finishes.

**Working with results**

- Browse findings by type: hostnames, emails, IPs, URLs, ASNs and more. Every finding shows which source it came from.
- Check each source's outcome: completed, partial (usually a provider rate limit) or errored.
- From a hostname result, you can launch follow-up actions such as a screenshot or a DNS brute-force. Each action creates its own run, and your original results stay untouched. These are active actions, so only use them on authorized targets.

**Saving and scheduling**

- **Export** a run as JSONL, the most complete format, or export all your completed runs as a SQLite database. You can also import evidence back in later.
- The **Schedules** page (`http://127.0.0.1:5000/schedules`) lets you set up recurring runs against one or more domains. That's handy for keeping an eye on your own attack surface over time.

**Managing the container without commands**

You don't need PowerShell for day-to-day use either. In **Docker Desktop → Containers**, use the ▶ and ■ buttons to start and stop theHarvester, and click the container to view its logs.

If you'd rather automate things, the interactive API docs are at `http://127.0.0.1:5000/docs`.

---

## Step 8: Your first test run

The best test target is **a domain you own**. You'll know roughly what should show up, which makes it easy to confirm everything works.

**1. Check that the API responds.** This lists the data sources the container knows about:

```powershell
$key = Get-Content .secrets\operator-api-key
Invoke-RestMethod http://127.0.0.1:5000/api/v1/sources -Headers @{ 'X-API-Key' = $key }
```

**2. Run a passive search from the command line.** The container starts HarvestView by default, but you can run the CLI through the same image:

```powershell
docker compose run --rm --entrypoint theHarvester theharvester.svc.local -d yourdomain.com -b crtsh,certspotter,otx,urlscan,hackertarget
```

You should see hostnames like `www.yourdomain.com` along with a status for each source.

**3. Sanity-check the results.** Open `https://crt.sh/?q=yourdomain.com` in your browser. The subdomains theHarvester found from crt.sh should match.

**4. Repeat the run in HarvestView** with the same domain and sources, and confirm each source reports **completed**. You should see the same hostnames as the CLI run. An occasional "partial" or rate-limit status is the provider throttling you, not a theHarvester problem.

**GUI only?** You can skip steps 1 and 2 and do the whole test in HarvestView. Run crtsh, certspotter, otx, urlscan and hackertarget against your domain, then compare the hostnames with crt.sh.

---

## Step 9: Hunting for email addresses

The test above mostly finds subdomains. To go after email addresses, select the email-capable sources in HarvestView (the source list shows which ones return emails), or use the `emails` selector on the command line, which runs every source that can return them:

```powershell
docker compose run --rm --entrypoint theHarvester theharvester.svc.local -d yourdomain.com -b emails
```

| No API key needed | API key required |
|---|---|
| duckduckgo, yahoo, baidu, mojeek | hunter, tomba, rocketreach |
| gitlab, apis-guru | github-code, intelx |
| hudsonrock, windvane | dehashed, zoomeye, brave, sherlockeye |

Email is where the keyless sources are weakest. Most of them scrape search engines, which often block automated queries. A small domain may also have few public addresses to find. An empty result doesn't necessarily mean anything's wrong.

---

## Step 10: Adding API keys (optional, but worth it)

In HarvestView, many sources show **Needs configuration / Credentials required: API key**. They're all optional, and around 25 sources work with no key at all. Adding a few free keys does widen your coverage a lot, though.

Keys live in this file inside your clone, which the container reads at startup:

```
theHarvester\data\api-keys.yaml
```

Open it:

```powershell
notepad .\theHarvester\data\api-keys.yaml
```

Fill in only the providers you have keys for, and leave the rest of the template alone. Indentation matters in YAML:

```yaml
apikeys:
  github:
    key: your-github-token
  hunter:
    key: your-hunter-key
  virustotal:
    key: your-virustotal-key
```

Some providers need two values. For example, Tomba takes `key` plus `secret`. Save the file, then restart the container with the restart button in Docker Desktop, or with:

```powershell
docker compose restart
```

Refresh HarvestView, and the configured sources become selectable.

**Good free keys to start with:**

- **Hunter**: the single best source for email addresses
- **GitHub** personal access token: finds emails and subdomains in public code
- **VirusTotal**, **SecurityTrails**, **LeakIX**, **Netlas**, **FullHunt**, **BeVigil**: solid subdomain coverage on free tiers
- **Shodan**: limited on a free account, much better with a paid membership

Free-tier limits change often, so check each provider's site. Also note that Censys's free plan can't use the search API theHarvester relies on.

> **Don't leak your keys.** `api-keys.yaml` sits inside a Git repository. Never commit it or push it anywhere public.

---

## Everyday commands

Starting, stopping and viewing logs can all be done from Docker Desktop's Containers screen. If you prefer the terminal, run these from your `theHarvester` folder:

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Check status | `docker compose ps` |
| Watch logs | `docker compose logs -f theharvester.svc.local` |
| Update to the latest version | `git pull` then `docker compose up --build -d` |
| See every CLI option | `docker compose run --rm --entrypoint theHarvester theharvester.svc.local -h` |

Your run history lives in a Docker volume, so it survives stops, restarts and rebuilds.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `failed to connect to the docker API at npipe:////./pipe/docker_engine` | Docker Desktop isn't running or hasn't finished starting. Open it and wait for **Engine running**. |
| Docker Desktop spins forever on startup | Force a clean restart: <code>Get-Process "*docker*" &#124; Stop-Process -Force</code>, then `wsl --shutdown`, then relaunch Docker Desktop. If that doesn't help, run `wsl --update` in an admin PowerShell and reboot. |
| `wsl -l -v` shows `docker-desktop` as **Stopped** | Docker Desktop failed to boot its VM. Do the clean restart above. Running `wsl -d docker-desktop echo ok` shows the underlying error. |
| Docker won't start at all | Check that virtualization is enabled (Task Manager → Performance → CPU). If it's disabled, turn on Intel VT-x or AMD-V in your BIOS. |
| "not a directory" error when starting | `theHarvester\data\api-keys.yaml` or `proxies.yaml` is missing, so Docker created a folder in its place. Make sure both exist as files. |
| Port 5000 already in use | Run `$env:THEHARVESTER_PORT=5050` before `docker compose up -d`, then browse to port 5050. |
| Saving output with `-f` fails | The container's filesystem is read-only. Save into the data volume instead, e.g. `-f /var/lib/theharvester/report`, or export from HarvestView. |

---

## Use it responsibly

theHarvester splits its activity into three levels:

- **P0, passive:** queries public datasets only. The target never sees you.
- **P1, DNS interaction:** resolution, brute-forcing and reverse lookups (`-r`, `-c`, `-n`)
- **P2, direct interaction:** HTTP probing, takeover checks, screenshots, API path scans (`-t`, `-a`, `--screenshot`)

P1 and P2 only run when you ask for them, and they send traffic toward the target. Keep them for your own domains or engagements where you have written authorization.

Also treat what you collect as sensitive. Email addresses, breach data and infrastructure details belong to real people and organizations. Keep reports out of public repos, and share them only with the people the engagement is for.

---

## Further reading

- **[theHarvester on Kali Linux Tools](https://www.kali.org/tools/theharvester/)**: Kali's official help page for theHarvester. It covers the install command, a usage example, and the full `theHarvester -h` option list. Kali's packaged version can trail the latest GitHub release, so some options and source names may differ slightly from this guide.
- **[theHarvester on GitHub](https://github.com/laramies/theHarvester)**: the official repository, with the latest README, source list and documentation.

---

*theHarvester was created by Christian Martorella and is maintained by its open-source community. Full documentation is on the [official GitHub repository](https://github.com/laramies/theHarvester).*
