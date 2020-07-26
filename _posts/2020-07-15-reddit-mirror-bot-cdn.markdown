---
layout: post
title: "Reddit Mirror Bot: Building the CDN"
date: 2020-07-15 21:48:36 -0400
categories: programming
tags:
  - tuckbot
  - a-mirror-bot
  - nginx
---

The more technical people I speak to about my Reddit Mirror Bot project, [Tuckbot](https://github.com/kyleratti/tuckbot-downloader), the more people are interested in the logistics on serving the amount of traffic it sees.

If you're not familiar with this project, Tuckbot is a mirror bot I built for the Reddit community [/r/PublicFreakout](https://reddit.com/r/publicfreakout) using TypeScript on NodeJS. It scans new link submissions to the subreddit, attempts to download the video via [youtube-dl](https://youtube-dl.org/), uploads it to [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces/), and shares the link on Reddit for members to use.

## Bandwidth

Hosting videos for streaming is not as straightforward as you might think. You need to be mindful of audio codecs, video codecs, video containers, device support for codecs and containers, visitor connection speed, visitor location, source quality, player compatibility, and, most importantly for the sake of a hobby, **storage and bandwidth cost.**

Being a hobby project, I made the decision to not get caught up in most of those - my main goal was just to build something useful with NodeJS, TypeScript, and React.

In fact, [a `convert(...)` function still exists](https://github.com/kyleratti/tuckbot-downloader/blob/e500fb6983f64c0f6606849b7bdbc39f358ba103/src/downloaders/videodownloader.ts#L143)
