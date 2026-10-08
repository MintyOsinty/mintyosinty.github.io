---
layout: post
title: "Wireshark Training, Stage 1: Hunt Down an ARP Storm"
date: 2026-10-07 12:02:00
tags: [wireshark, networking, training]
level: Beginner
description: "Open a real capture from a cable modem, find the one device flooding the network with ARP broadcasts, and learn the Wireshark moves you'll use on every investigation."
---

> **WIRESHARK TRAINING**
>
> **▶ Stage 1: Hunt Down an ARP Storm** (you are here)<br>
> Stage 2: [Catch Network Congestion in the Act](/blog/wireshark-training-stage-2-tcp-congestion/)<br>
> Stage 3: [Steal a Password (From 1999)](/blog/wireshark-training-stage-3-cleartext-passwords/)

Reading about packets only gets you so far. In this three-stage series you'll open **real captures from real networks** and find **real problems** in them. Every stage gives you a mission, the filters you need, hints if you get stuck, and hidden answers so you can check your work.

Each stage builds on the last, so start here even if you've used Wireshark before.

## What you need

- **Wireshark installed.** If you don't have it yet, the [Tools Arsenal](/#tools) has step-by-step download instructions.
- **The capture file:** [arp-storm.pcap](https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/arp-storm.pcap) (47 KB). It comes from Wireshark's own [Sample Captures](https://wiki.wireshark.org/SampleCaptures) library. More on that library at the end of the series.
- **The [Wireshark cheat sheet](/cheatsheets/wireshark/)** open in another tab. Every filter in this series is on it.

Open Wireshark, choose **File → Open**, and pick `arp-storm.pcap`. You can also drag the file onto the Wireshark window.

## The briefing

This capture was taken on a **home cable modem connection**. The owner noticed a constant stream of traffic they didn't create. Your job: figure out what that traffic is, who is sending it, and what it's trying to do.

### 60-second crash course: what is ARP?

Your computer talks to other devices by **IP address** (like `192.168.1.20`), but on the local network, data actually travels by **MAC address** (a hardware ID like `aa:bb:cc:11:22:33`). ARP, the Address Resolution Protocol, connects the two:

1. **ARP request:** a device shouts to *everyone* on the network: "Who has 192.168.1.20? Tell 192.168.1.1." This shout is a **broadcast**, sent to `ff:ff:ff:ff:ff:ff`, so every device has to receive it.
2. **ARP reply:** only the owner of that IP answers, directly back to the asker: "192.168.1.20 is at aa:bb:cc:11:22:33."

A few ARP requests are normal. When one device sends a **constant flood** of them, every device on the network has to process every one. That's an **ARP storm**.

## Mission 1: Get the big picture

Before you start clicking on individual packets, find out what you're dealing with. Go to **Statistics → Capture File Properties**.

**Question:** How many packets are in this capture, how long does it last, and what's the average number of packets per second?

<details markdown="1">
<summary>Show hint</summary>

Scroll to the **Statistics** table near the bottom of the window. Look at the *Captured* column for the Packets, Time span, and Average pps rows.

</details>

<details markdown="1">
<summary>Show answer</summary>

- **622 packets**
- **About 29 seconds**
- **About 21 packets per second**

That's roughly 21 packets every second, all day long. Keep that number in mind.

</details>

Now go to **Statistics → Protocol Hierarchy**.

**Question:** What protocols make up this capture?

<details markdown="1">
<summary>Show answer</summary>

**100% ARP.** Every single packet is ARP. There's no web browsing, no DNS, nothing else. When a capture is all one protocol, that's your first clue something is off.

</details>

## Mission 2: Find the source

Click the first packet in the list. Look at the **Info** column and the **Source** and **Destination** columns.

**Question:** What is this packet asking, and who is it being sent to?

<details markdown="1">
<summary>Show answer</summary>

The Info column reads **"Who has 24.166.173.159? Tell 24.166.172.1"**. It's an ARP request. The destination is **Broadcast** (`ff:ff:ff:ff:ff:ff`), so it went to every device on the network segment, including this cable modem.

</details>

Now find out *who* is sending all of these. Go to **Statistics → Endpoints** and click the **Ethernet** tab.

**Question:** How many devices are in this capture, and which one is sending everything?

<details markdown="1">
<summary>Show hint</summary>

One of the endpoints is the broadcast address, which isn't a real device. Look at the **Tx Packets** (transmitted) column for the other one.

</details>

<details markdown="1">
<summary>Show answer</summary>

There are only two endpoints, and one of them is just the broadcast address. **Every one of the 622 packets** was sent by one device: `00:07:0d:af:f4:54`.

Wireshark shows it as **Cisco_af:f4:54**. The first half of every MAC address identifies the manufacturer, and Wireshark looks it up for you. `00:07:0d` belongs to Cisco, which makes this almost certainly **a Cisco router at the internet provider**.

</details>

> **PRO MOVE: CHECK THE MANUFACTURER**
>
> When you find a noisy device, look at its manufacturer name in the Source column. "Cisco" or "Juniper" usually means a router. "Hikvision" means a security camera. "Raspberry Pi" means someone plugged in a project board. It narrows down the suspect fast.

## Mission 3: Count the replies

Paste this into the filter bar at the top and press **Enter**:

```
arp.opcode == 2
```

Opcode 1 is a *request* and opcode 2 is a *reply*. This filter shows only replies.

**Question:** How many ARP replies are there?

<details markdown="1">
<summary>Show answer</summary>

**Zero.** The filter bar turns green, but the packet list is empty. Every packet in the file is a request (`arp.opcode == 1` shows all 622).

**This is a trap, though.** Remember that replies are sent *directly* back to the asker, not broadcast. This capture was taken on one customer's modem, so it would never see replies going from other customers back to the router. **"Not in my capture" doesn't always mean "didn't happen."** Always ask yourself *where* a capture was taken and what that spot could actually see.

</details>

## Mission 4: Who's it looking for?

The router is asking about a lot of different addresses. Click on any ARP packet, then in the middle pane (**Packet Details**) expand **Address Resolution Protocol (request)**. Right-click **Target IP address** and choose **Apply as Column**.

Now click the new **Target IP address** column header to sort by it. Scroll through and look for addresses that show up again and again.

**Question:** One address gets asked about 10 times. Which one, and what does that tell you?

<details markdown="1">
<summary>Show hint</summary>

Try this filter to check your guess. Swap in the address you think it is:

```
arp.dst.proto_ipv4 == 69.76.222.157
```

</details>

<details markdown="1">
<summary>Show answer</summary>

**69.76.222.157** is asked about 10 times, every 2 to 3 seconds (frames 70, 141, 181, 239, 297, 357, 407, 449, 516 and 553).

When a device keeps asking about the same address over and over, it means **it never got an answer**. That customer is probably offline, but traffic keeps arriving for them, so the router keeps shouting for an answer that never comes.

</details>

Now do the same trick with the **Sender IP address** field: Apply as Column, then sort.

**Question:** How many different sender IP addresses does this one router use, and what do they have in common?

<details markdown="1">
<summary>Show answer</summary>

**Nine different sender IPs.** Eight of them end in `.1`:

`24.166.172.1`, `65.26.71.1`, `65.26.92.1`, `65.28.78.1`, `67.52.222.1`, `69.23.182.1`, `69.76.216.1` and `69.81.17.1`. The ninth is `24.145.164.129`.

Addresses ending in `.1` are usually **gateways**, the router address for a block of customers. (Gateways don't *have* to end in `.1`, and the ninth one is likely a gateway for a smaller block.) This one Cisco device is acting as the gateway for several customer networks, all sharing the same cable segment. The busiest is `24.166.172.1`. Filter for it with `arp.src.proto_ipv4 == 24.166.172.1` and you'll find **292 packets**, almost half the capture.

</details>

## Mission 5: See the storm

Clear the filter, then go to **Statistics → I/O Graphs**. The graph shows how many packets arrived over time. If the **Interval** box at the bottom isn't already set to **1 sec**, set it, so each point means "packets per second."

**Question:** Is this a sudden burst, or something else?

<details markdown="1">
<summary>Show answer</summary>

It's a **steady, flat line** sitting around 20 packets per second for the whole capture. It's not a spike. It's constant background noise.

That steadiness matters. A short burst might be one device booting up. A flat, endless line means **something is always running**, and every device on the segment pays for it all the time.

</details>

## Debrief: what you found

| Clue | What it told you |
|---|---|
| 100% ARP, about 21 per second | Something is flooding the network with broadcasts |
| One sender MAC, made by Cisco | It's a single router, not lots of devices |
| Nine sender IPs, mostly ending in `.1` | That router is the gateway for many customer networks |
| The same target asked 10 times | It's shouting for customers who aren't answering |
| A flat line in the I/O graph | It's constant, not a one-time event |

**The verdict:** the internet provider's router is broadcasting ARP requests for its customers across a shared cable network. Every modem on the segment, including this one, hears every request. It isn't an attack, but it's wasteful noise that every customer pays for.

### In the real world

ARP storms on a network you manage usually come from one of these:

- **A switching loop.** Two cables connect the same switches, and broadcasts circle forever. This is the classic network-killer.
- **A scanner.** Something is sweeping every address in a range. Sometimes it's a legitimate tool, sometimes it isn't.
- **A misconfigured or failing device** stuck asking the same question over and over.
- **A network that's simply too big**, with hundreds of devices all broadcasting.

The fixes match the cause:

- turn on **Spanning Tree** to stop loops
- use **storm control** on the switch to cap broadcasts
- split big networks into smaller **VLANs**
- find the noisy device's MAC address in the switch's **MAC address table** to see which port it's plugged into

## Moves you just learned

- **Capture File Properties** for the size, length and rate of a capture
- **Protocol Hierarchy** for what's in a capture
- **Endpoints** for who's talking and how much
- **Apply as Column** and sorting, to spot patterns fast
- **I/O Graphs** for traffic over time
- Thinking about **where** a capture was taken

---

**Next up: [Stage 2: Catch Network Congestion in the Act ▶](/blog/wireshark-training-stage-2-tcp-congestion/)**

*Capture file from the [Wireshark Sample Captures](https://wiki.wireshark.org/SampleCaptures) library. Only capture traffic on networks you own or have permission to monitor.*
