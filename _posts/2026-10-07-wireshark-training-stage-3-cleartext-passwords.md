---
layout: post
title: "Wireshark Training, Stage 3: Steal a Password (From 1999)"
date: 2026-10-07 12:00:00
tags: [wireshark, security, training]
level: Beginner
description: "Read a username, password and every command someone typed, straight out of an old Telnet session. Then learn why HTTPS, SSH and VPNs keep the same thing from happening to you on public Wi-Fi."
---

> **WIRESHARK TRAINING**
>
> Stage 1: [Hunt Down an ARP Storm](/blog/wireshark-training-stage-1-arp-storm/)<br>
> Stage 2: [Catch Network Congestion in the Act](/blog/wireshark-training-stage-2-tcp-congestion/)<br>
> **▶ Stage 3: Steal a Password (From 1999)** (you are here)

At the end of Stage 2 you pulled a password out of a web request. This time you'll go further: you'll read an entire login session, keystroke for keystroke, as if you were looking over someone's shoulder. Then you'll learn exactly what protects you from this today.

## What you need

- **Wireshark**, and the moves from Stages [1](/blog/wireshark-training-stage-1-arp-storm/) and [2](/blog/wireshark-training-stage-2-tcp-congestion/)
- **The capture file:** [telnet-cooked.pcap](https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/telnet-cooked.pcap) (9 KB), from Wireshark's [Sample Captures](https://wiki.wireshark.org/SampleCaptures) library
- **The [Wireshark cheat sheet](/cheatsheets/wireshark/)**

Open the file with **File → Open**.

## The briefing

It's November 1999. Someone is logging into a remote computer using **Telnet**, the standard way to control another machine from a command line back then. Your job: find out who they logged in as, their password, and everything they did once they were in.

### 60-second crash course: what's wrong with Telnet?

Telnet sends **everything as plain text**: your username, your password, every command you type and every response you get back. Nothing is scrambled. Anyone who can see the traffic between you and the server can read it all.

That's called **cleartext**, and it's why Telnet has been replaced by **SSH** almost everywhere. Some old routers, printers and industrial devices still use it, which is why security folks still check for it.

## Mission 1: Who's talking?

Go to **Statistics → Conversations** and click the **TCP** tab.

**Question:** How many TCP conversations are there? Which computer is the client, which is the server, and what port is the server using?

<details markdown="1">
<summary>Show answer</summary>

There's **one** conversation. The client, **192.168.0.2**, connects to the server, **192.168.0.1**, on **port 23**.

Port 23 is Telnet's standard port. It's also on your cheat sheet under ports to watch. If you ever see port 23 traffic on a network you manage, find out why.

</details>

## Mission 2: Read the whole session

Here's one of the most useful tricks in Wireshark. Click any packet, then right-click it and choose **Follow → TCP Stream**. Wireshark stitches every packet in the conversation back together and shows it as one readable transcript:

- **Red** text is what the **client** sent.
- **Blue** text is what the **server** sent back.

The first few lines look like gibberish full of dots. That's the two computers agreeing on settings like screen size and terminal type. Scroll past it.

**Question:** What username and password did the person use?

<details markdown="1">
<summary>Show answer</summary>

- **Username:** `fake`
- **Password:** `user`

You'll see the server's **login:** prompt in blue, then `fake` in red. Then the server asks for **Password:** in blue, and `user` comes back in red.

Notice something: when you type a password into Telnet, it **doesn't show up on your screen**. That makes it *feel* secret. But hiding it on the screen does nothing for the network. The password still travels as plain text, and Wireshark reads it just fine.

</details>

**Question:** What kind of computer did they log into?

<details markdown="1">
<summary>Show answer</summary>

The server greets them with **OpenBSD/i386 (oof)** and later a welcome banner for **OpenBSD 2.6-beta**. So it's an OpenBSD machine named `oof`. The banner even proudly calls OpenBSD "proactively secure," which is a little ironic given what we just watched happen to the password.

</details>

## Mission 3: Find the exact packets

Follow Stream is great for reading, but in a report you need to point at specific packets. Close the stream window. Wireshark automatically filtered to that conversation, so clear the filter. Then try this one from your cheat sheet:

```
frame contains "Password"
```

**Question:** Which frame is the server's password prompt, and which frame carries the actual password?

<details markdown="1">
<summary>Show hint</summary>

The filter finds the prompt. Clear it, click that frame, and look at the next few packets coming **from 192.168.0.2**. Click each one and check the bytes pane at the bottom.

</details>

<details markdown="1">
<summary>Show answer</summary>

- **Frame 36** is the server's **Password:** prompt.
- **Frame 38** carries the password, `user`, from the client.
- The username, `fake`, is in **frame 31**, right after the **login:** prompt in frame 29.

Click frame 38 and look at the bottom pane. You'll see `user` sitting right there in the raw bytes. No decoding needed.

</details>

> **WHAT ARE THOSE ODD DUPLICATE PACKETS?**
>
> Some packets, like frames 32 and 52, look like copies of the packet right before them. A few of them were cut short when the capture was recorded, and Wireshark may color them or flag them with warnings. They're quirks of the recording, not part of the mission, so you can skip them.

## Mission 4: What did they do?

Go back to **Follow → TCP Stream** and read past the login.

**Question:** List every command the person typed after logging in.

<details markdown="1">
<summary>Show answer</summary>

1. `/sbin/ping www.yahoo.com`: they tested the internet connection. It's 1999, so of course it's Yahoo.
2. `ls`: they listed the files in their home folder. Nothing came back, so the folder looked empty.
3. `ls -a`: they listed the hidden files too, which revealed files like `.profile`, `.cshrc` and `.rhosts`.
4. `exit`: they logged out.

An eavesdropper sees **all of it**: the commands *and* the output. On a real server that could mean file names, configuration details, or a sensitive file someone opened with `cat`.

</details>

**Question:** Scroll back to the very top of the stream, in the gibberish section. What does the client leak about itself before the login even starts?

<details markdown="1">
<summary>Show answer</summary>

Look for readable words between the dots. The client announces its terminal type, **xterm-color**, and a display setting that names its own computer: **bam.zing.org**. Before anyone typed a single character, an eavesdropper already knew the name of the machine they were connecting from. The server's **Last login** message later confirms it.

</details>

## Debrief: what you found

| Frame | What an eavesdropper learns |
|---|---|
| Start of the stream | The client's computer name and terminal type |
| 27 | The server's operating system and name |
| 31 | The username: `fake` |
| 38 | The password: `user` |
| After login | Every command and every result |

One small capture file, and an attacker would have everything they need to log in as this person later.

## The real lesson: this is what insecure Wi-Fi is about

Telnet is mostly gone, but the problem it shows is not. **Any connection that isn't encrypted can be read by anyone who can see the traffic.**

On a wired network at home, that's a short list of people. On **public Wi-Fi**, at a coffee shop, an airport or a hotel, the network is shared with strangers. If the Wi-Fi has **no password at all**, the radio signal between your device and the access point usually isn't encrypted, so others nearby may be able to capture it. Even networks with a shared password don't protect you from whoever runs them, or from a fake hotspot with a convincing name. Old protocols like Telnet, FTP and plain HTTP would hand over your logins exactly like this capture did.

### What actually protects you

The fix is to encrypt the **connection itself**, so it doesn't matter who can see the traffic:

| Instead of... | Use... | Why |
|---|---|---|
| Telnet (port 23) | **SSH** (port 22) | Same remote command line, fully encrypted |
| FTP (port 21) | **SFTP** or **FTPS** | Encrypted file transfers |
| HTTP (port 80) | **HTTPS** (port 443) | Encrypted websites. Look for the padlock |
| Any of the above on untrusted Wi-Fi | **A VPN** | Wraps *all* your traffic in an encrypted tunnel |

If you replayed this same session over **SSH** and opened it in Wireshark, you'd see the connection happen, but the contents would be scrambled. Wireshark would label it **Encrypted packet** instead of showing usernames and commands. Try it yourself: on your own computer, run a capture while you visit a site with HTTPS, and filter for `tls`. You'll usually see the site's name in the handshake, but the pages themselves are unreadable.

### Quick habits for public Wi-Fi

- Check for **HTTPS** and the padlock before logging in to anything.
- Use a **VPN** when you're on a network you don't control.
- Don't ignore browser certificate warnings. They can mean someone is in the middle.
- Turn off auto-connect to open networks, so your device doesn't quietly join a fake one.
- On networks you manage, **disable Telnet and FTP** and switch to SSH and SFTP.

> **PLAY FAIR**
>
> Sample captures like these exist so you can practice safely. On real networks, **only capture traffic on networks you own or have written permission to monitor.** Capturing other people's traffic without permission can break the law, even on "open" Wi-Fi.

## Moves you just learned

- **Statistics → Conversations** to see who talked to whom
- **Follow → TCP Stream** to read a whole conversation as a transcript
- Searching packet contents with `frame contains`
- Reading raw bytes in the bottom pane
- Spotting **cleartext** protocols and knowing what replaces them

## Series complete. Now keep training!

You've cleared all three stages. Here's the good news: Wireshark's **[Sample Captures](https://wiki.wireshark.org/SampleCaptures)** page has **hundreds more** captures waiting for you, all free and organized by protocol. A few worth exploring next:

- **DNS, DHCP and HTTP:** the everyday traffic every network runs on
- **Wi-Fi (802.11) and Bluetooth:** wireless traffic, captured straight from the air
- **SIP and RTP (VoIP):** real phone calls. Some can be played back as audio under **Telephony → VoIP Calls**
- **SMB:** Windows file sharing, a favorite target in security investigations
- **USB:** yes, Wireshark can even capture keyboards and flash drives
- **SSL and SSH with decryption keys:** see what encrypted traffic looks like, then unlock it with the included keys
- **Viruses and worms:** real malware traffic from famous outbreaks, safe to study as packets
- **Oddballs:** car networks, drone controls, cryptocurrency, even old Gopher servers

The same page also has an **Other Sources of Capture Files** section that links to even more collections.

**Tips for picking one:**

- **Read the description first.** Each file has a sentence or two explaining what's in it, and sometimes the exact frame where the interesting part happens.
- **Start small.** A file under 100 KB is easy to explore. Big files can be overwhelming.
- **Use your moves.** Start every new file the same way: **Capture File Properties**, **Protocol Hierarchy**, **Conversations**. Then follow your nose.

Keep the [cheat sheet](/cheatsheets/wireshark/) open, and happy hunting.

*Capture file from the [Wireshark Sample Captures](https://wiki.wireshark.org/SampleCaptures) library.*
