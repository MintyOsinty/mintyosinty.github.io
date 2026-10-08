---
layout: post
title: "Wireshark Training, Stage 2: Catch Network Congestion in the Act"
date: 2026-10-07 12:01:00
tags: [wireshark, networking, training]
level: Intermediate
description: "Watch a router warn two computers that the network is jammed, and see how TCP slows down without losing a single packet. Plus a surprise hiding in the very first request."
---

> **WIRESHARK TRAINING**
>
> Stage 1: [Hunt Down an ARP Storm](/blog/wireshark-training-stage-1-arp-storm/)<br>
> **▶ Stage 2: Catch Network Congestion in the Act** (you are here)<br>
> Stage 3: [Steal a Password (From 1999)](/blog/wireshark-training-stage-3-cleartext-passwords/)

In Stage 1 you looked at a single noisy protocol. Now you'll follow a full **TCP conversation** from start to finish and watch the network push back on it in real time.

## What you need

- **Wireshark**, and the moves from [Stage 1](/blog/wireshark-training-stage-1-arp-storm/)
- **The capture file:** [tcp-ecn-sample.pcap](https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/tcp-ecn-sample.pcap) (119 KB), from Wireshark's [Sample Captures](https://wiki.wireshark.org/SampleCaptures) library
- **The [Wireshark cheat sheet](/cheatsheets/wireshark/)**

Open the file with **File → Open**.

## The briefing

One computer (`1.1.23.3`) is downloading a file from another (`1.1.12.1`). Somewhere between them, a router is getting overloaded. Your job: find the moment the network got jammed, and work out how the two computers handled it.

### 60-second crash course: how networks handle a traffic jam

Every router has a small waiting line (a **queue**) for packets. When traffic comes in faster than it can go out, the queue fills up.

- **The old way:** when the queue is full, the router simply **drops** packets. The sender notices something went missing, sends it again (a **retransmission**), and slows down. It works, but dropped packets mean delays, stutters and wasted bandwidth.
- **The better way: ECN.** With **Explicit Congestion Notification**, the router doesn't throw the packet away. It stamps it "congestion experienced" and passes it along. The receiver tells the sender about the stamp, and the sender slows down *before* anything gets lost.

Think of it as the difference between a bouncer turning people away at the door and a bouncer saying "come in, but tell your friends to hold off for a bit."

ECN uses four markers, spread across two headers:

| Where | Marker | Meaning |
|---|---|---|
| IP header | **ECT** (ECN-Capable Transport) | "This packet can be stamped instead of dropped" |
| IP header | **CE** (Congestion Experienced) | "A router stamped me. The network is jammed!" |
| TCP header | **ECE** flag (ECN-Echo) | Receiver to sender: "Heads up, I got a stamped packet" |
| TCP header | **CWR** flag (Congestion Window Reduced) | Sender to receiver: "Got it, I've slowed down" |

## Mission 1: The handshake

Every TCP conversation starts with a three-way handshake: **SYN, SYN/ACK, ACK**. Use the filter from your cheat sheet:

```
tcp.flags.syn == 1
```

Click frame **1**, then in Packet Details expand **Transmission Control Protocol → Flags**.

**Question:** Besides SYN, which two extra flags are set in frame 1? Then check frame 2. What does the server send back?

<details markdown="1">
<summary>Show answer</summary>

Frame 1 has **ECN-Echo (ECE)** and **Congestion Window Reduced (CWR)** set along with SYN. During the handshake, those two flags don't mean "congestion." Together they mean **"I know how to do ECN. Do you?"**

Frame 2, the SYN/ACK, comes back with **ECE** set. That means **"Yes, I do too."** ECN is now switched on for this whole conversation.

</details>

## Mission 2: What's being downloaded?

Clear the filter and use this one:

```
http
```

**Question:** What file is being requested, from what kind of device, and how big is it?

<details markdown="1">
<summary>Show hint</summary>

Click the request (frame 4) and expand **Hypertext Transfer Protocol** in Packet Details. For the size, click the response (frame 5) and look for **Content-Length**.

</details>

<details markdown="1">
<summary>Show answer</summary>

It's a **GET /show-tech** request. The server identifies itself as **cisco-IOS**, so this is someone downloading a Cisco router's full diagnostic report over the web. The response says **Content-Length: 83122**, about 83 KB.

Hold on to frame 4. There's something else in it we'll come back to at the end.

</details>

## Mission 3: Read the IP stamp

Clear the filter. Click frame **5** (the first packet of data from the server). In Packet Details, expand **Internet Protocol Version 4 → Differentiated Services Field**.

**Question:** What does the **Explicit Congestion Notification** line say?

<details markdown="1">
<summary>Show answer</summary>

It says **ECN-Capable Transport codepoint '10' (2)**. That's ECT: "this packet is allowed to be stamped instead of dropped." Everything looks normal so far.

The number in brackets is what you filter on. `ip.dsfield.ecn == 2` shows every ECN-capable packet that wasn't stamped.

</details>

## Mission 4: Find the jam

Now hunt for the stamp. Code 3 means Congestion Experienced:

```
ip.dsfield.ecn == 3
```

**Question:** Which frame is the **first** to be stamped, and how many stamped packets are there in total?

<details markdown="1">
<summary>Show answer</summary>

**Frame 48** is the first, about 6.8 seconds into the download. Its ECN line now reads **Congestion Experienced (3)**. A router along the way was overloaded and stamped it.

The status bar at the bottom shows **52 displayed**. That's 52 stamped packets out of the 168 data packets the server sent, nearly **1 in 3**. This network was busy the whole time.

</details>

## Mission 5: Follow the warning

The receiver (`1.1.23.3`) got a stamped packet. Now it has to warn the sender. Clear the filter and look at the packets right after frame 48.

**Question:** Which frame is the receiver's first warning, and which flag carries it?

<details markdown="1">
<summary>Show hint</summary>

Use this filter to show only the warnings (the SYN part leaves out the handshake from Mission 1):

```
tcp.flags.ece == 1 && tcp.flags.syn == 0
```

</details>

<details markdown="1">
<summary>Show answer</summary>

**Frame 50.** It's an ACK from the receiver with the **ECN-Echo (ECE)** flag set: "I got a stamped packet, slow down." The receiver keeps setting ECE on its ACKs until the sender confirms.

</details>

**Question:** After frame 50, which frame is the server's confirmation that it slowed down?

<details markdown="1">
<summary>Show hint</summary>

The confirmation is the **CWR** flag. Filter for `tcp.flags.cwr == 1` and find the first one after frame 50.

</details>

<details markdown="1">
<summary>Show answer</summary>

**Frame 61.** The server sends data with **Congestion Window Reduced (CWR)** set: "Message received, I've cut my speed."

That completes the full loop: **CE stamp (48) → ECE warning (50) → CWR confirmation (61)**. Scroll through the capture and you'll see the same pattern repeat over and over, because the network stays busy for the whole download.

</details>

## Mission 6: Count the damage

Here's the payoff. In the old way, congestion meant dropped packets and retransmissions. Try this:

```
tcp.analysis.retransmission || tcp.analysis.lost_segment
```

**Question:** How many retransmissions or lost segments are there?

<details markdown="1">
<summary>Show answer</summary>

**Zero.** The router was jammed for most of the download, and 52 packets were stamped, but **not a single packet was lost or had to be resent.** The whole file arrived intact.

That's ECN doing its job. The network said "slow down" *before* it had to start throwing packets away.

</details>

> **WHAT ABOUT ALL THOSE REPEATED ACKS?**
>
> You might notice groups of ACKs right next to each other that acknowledge the same data, like frames 50, 51 and 52. Look closely and only the **window size** changes. Wireshark labels these **TCP Window Update**. It's the receiver saying "I've freed up more room in my buffer." It's normal, not a problem.

## Debrief: what you found

| Frame | What happened |
|---|---|
| 1 to 3 | The handshake. Both sides agree to use ECN |
| 4 | The request for the router's diagnostic report |
| 48 | A router stamps the first packet: Congestion Experienced |
| 50 | The receiver warns the sender with ECE |
| 61 | The sender confirms it slowed down with CWR |
| Whole capture | 52 stamps, zero retransmissions |

### In the real world

When a download is slow, the first thing most people check is retransmissions with `tcp.analysis.flags`. That's a great start, but this capture shows a second kind of evidence. **CE stamps prove a network is congested even when nothing is being lost.** If you see lots of them, some router between the two devices is overloaded. The fix lives there: more bandwidth, better traffic prioritization (QoS), or moving traffic to a less busy path.

## Bonus mission: the surprise in frame 4

Go back to frame 4 and expand **Hypertext Transfer Protocol** again. Look for the line that starts with **Authorization**. Or use this filter, which is on your cheat sheet:

```
http.authorization
```

**Question:** What's the username and password?

<details markdown="1">
<summary>Show hint</summary>

Click the small arrow next to **Authorization** to expand it. Wireshark decodes it for you.

</details>

<details markdown="1">
<summary>Show answer</summary>

**Username `admin`, password `cisco`.** The raw header reads `Basic YWRtaW46Y2lzY28=`. That jumble looks scrambled, but it's just **Base64**, a way of writing text that anyone can reverse instantly. Wireshark shows it decoded as **Credentials: admin:cisco**.

The person downloading the report logged into the router over plain HTTP, so their password traveled across the network for anyone in the middle to read. (As a bonus fail, `cisco` is also an old default password.)

**Base64 is not encryption.** That's exactly what Stage 3 is about.

</details>

## Moves you just learned

- Reading **TCP flags** and the IP **ECN** field in Packet Details
- Tracing a **cause and effect** chain across frames
- Using `tcp.analysis.*` filters to check for loss
- Telling real problems (retransmissions) from normal noise (window updates)
- Pulling **credentials** out of HTTP traffic

---

**Next up: [Stage 3: Steal a Password (From 1999) ▶](/blog/wireshark-training-stage-3-cleartext-passwords/)**

*Capture file from the [Wireshark Sample Captures](https://wiki.wireshark.org/SampleCaptures) library. Only capture traffic on networks you own or have permission to monitor.*
