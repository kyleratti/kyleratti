---
layout: post
title: "Serving 10+ TB of Video Bandwidth Per Month"
date: 2020-07-15 21:48:36 -0400
categories: programming
tags:
  - tuckbot
  - a-mirror-bot
  - nginx
hasSolution: true
---

The more technical people I speak to about my Reddit Mirror Bot project, [Tuckbot](https://github.com/kyleratti/tuckbot-downloader), the more interest there is in the logistics on serving a relatively large amount of video traffic for a hobby project.

If you're not familiar with this project, Tuckbot is a mirror bot I built for the Reddit community [/r/PublicFreakout](https://reddit.com/r/PublicFreakout) using TypeScript with React and NodeJS. It scans new link submissions to the subreddit, attempts to download the video using the brilliant [youtube-dl](https://youtube-dl.org/) application, uploads the video to [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces/), and shares the link on Reddit for visitors to use.

This post is going to be a fairly deep dive on the approach I took to address serving 10TB of video bandwidth per month, why I took it, and how I implemented it.

## Average Traffic

Tuckbot originally launched in August of 2018 in a very basic form. At some point, I took it offline and re-launched at `version 2.0` in September of 2019. It was during the re-launch that I added Google Analytics to the site for the first time, and since that time traffic has remained pretty consistent:

<table style="max-width: 500px">
  <thead>
    <tr>
      <th style="width: 40%">Month</th>
      <th style="width: 30%">Users</th>
      <th style="width: 30%">Page Views</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>October 2019</td>
      <td class="rightAlign">177,730</td>
      <td class="rightAlign">236,837</td>
    </tr>
    <tr>
      <td>November 2019</td>
      <td class="rightAlign">187,280</td>
      <td class="rightAlign">288,631</td>
    </tr>
    <tr>
      <td>December 2019</td>
      <td class="rightAlign">149,510</td>
      <td class="rightAlign">222,779</td>
    </tr>
    <tr>
      <td>January 2020</td>
      <td class="rightAlign">161,697</td>
      <td class="rightAlign">243,043</td>
    </tr>
    <tr>
      <td>February 2020</td>
      <td class="rightAlign">131,054</td>
      <td class="rightAlign">184,339</td>
    </tr>
    <tr>
      <td>March 2020</td>
      <td class="rightAlign">179,569</td>
      <td class="rightAlign">257,491</td>
    </tr>
    <tr>
      <td>April 2020</td>
      <td class="rightAlign">168,523</td>
      <td class="rightAlign">240,601</td>
    </tr>
    <tr>
      <td>May 2020</td>
      <td class="rightAlign">315,833</td>
      <td class="rightAlign">458,651</td>
    </tr>
    <tr>
      <td>June 2020</td>
      <td class="rightAlign">471,219</td>
      <td class="rightAlign">688,215</td>
    </tr>
    <tr>
      <td>July 1-26, 2020</td>
      <td class="rightAlign">229,970</td>
      <td class="rightAlign">344,913</td>
    </tr>
  </tbody>
</table>

This comes out to an average of **215,823 users** and **316,550 page views** _per month!_ While I do question the accuracy of how Google Analytics determines these were unique users, it's still a huge amount of page views and traffic!

## Leveraging CloudFlare to Serve 316,550 Monthly Views

[CloudFlare](https://cloudflare.com/) runs a massive global infrastructure of reverse proxy servers for web applications that's available in free and paid tiers. I have historically been a huge proponent of CloudFlare and their services; for small hobby projects like mine, they offer a service that hides your upstream server's IP address, checks that the request to your website is legitimate, and cache static content to speed up your site and reduce your bandwidth usage. That's pretty slick!

By default, CloudFlare only caches text-based and image file - _not_ video file - however it turns out you _can_ force video files to be cached: The Page Rules feature of CloudFlare allows you to set specific URL patterns to **Cache Everything** on CloudFlare's edge:

<img src="/assets/2020-07-15-reddit-mirror-bot-cdn/img/cloudflare-pagerule.png" alt="CloudFlare Page Rule for https://cdn.tuckbot.tv/*.mp4 that sets the 'Cache Level' setting to 'Cache Everything'" />

## Getting Banned from CloudFlare

If you're using that Page Rules trick, don't expect to use it too long; while storing all of your video files on CloudFlare's edge is fantastic for reducing the amount of bandwidth from _your_ edge, it's pretty terrible for _CloudFlare's_ edge and actually a direct violation of their Terms of Serivce. Sorry, Mitchell at CloudFlare.

And really, I should've seen it coming: you can't reasonably expect CloudFlare, at no cost, to cache 5TB of videos across their edge and serve 20TB of bandwidth to visitors. So as Tuckbot grew and more videos were being served, they banned me.

Yep. Fair.

<h2 id="solution">Building a Simple CDN Infrastructure</h2>

Having received no notification or explanation as to why CloudFlare was no longer caching or proxying **tuckbot.tv**, but knowing exactly why CloudFlare was no longer caching or proxying **tuckbot.tv**, I was scrambing to build a mini "CDN" that could handle a peak of 400 users/minute. Sticking with what I know, I decided to use three **NGINX** servers in a reverse proxy configuration in front of my application server with heavy caching:

<img src="/assets/2020-07-15-reddit-mirror-bot-cdn/img/tuckbot-cdn.svg" alt="Graphic of 2 proxy servers reading from an application server which reads from cloud-based object storage" />

Because my `cdn.tuckbot.tv` subdomain strictly serves video files, the NGINX configuration for this design is really straightforward:

```nginx
proxy_cache_path /var/cache/tuckbot levels=1:2 keys_zone=cdncache:10m max_size=150g inactive=20160m use_temp_path=off;
# /var/cache/tuckbot = The path to this cache on disk
# levels=1:2 = The caching hierarchy for the cache. Lots of files in a single directory can slow down access, so 2+ is the recommended config.
# keys_zone=cdncache:10m = The size of cache records in memory to avoid hitting the disk for cache lookups
# max_size=150g = The maximum size of the cache on disk. Since this is on a dedicated CDN server, 150GB was about 85% of my available disk space.
# inactive=20160m = The number of minutes a file can live in the cache. 20160 minutes is 14 days. NOTE: The oldest files may be purged sooner if disk space is running low.
# use_temp_path=off = Whether or not files should first be written to a temporary path before being copied to the path specified earlier. Disabled to avoid unnecessary disk IO.

server {
  server_name cdn.tuckbot.tv;

  location / {
    proxy_ignore_headers Set-Cookie Cache-Control Expires;
    # This server handles its own cache control and expiration
    proxy_hide_header Set-Cookie;
    # Removes the upstream Set-Cookie header from the response
    proxy_cache cdncache;
    # Indiciates what proxy_cache to use (matches name above)
    proxy_cache_valid 200 30d;
    # The length of time a 200 HTTP status code upstream is considered valid (30 days)
    add_header X-Proxy-Cache $upstream_cache_status;
    # Add a header to the response that tells us whether or not the cache was hit or missed (and sent to the application server)
    proxy_pass http://upstream-app-server.com;
    # The URL to proxy uncached files to (application server)
    proxy_set_header Host cdn.tuckbot.tv;
    # Set the specific host name for the HTTP request
    # You will need to do this if you target a generic "appserver1" host
    # but multiple hosts (or vhosts) are served from that server
  }
}
```

## How This Works

I applied the configuration above to three virtual servers from [NFOServers](https://www.nfoservers.com/virtual-dedicated-private-server-rentals.php). Small and unpaid endorsement: I've used virtual machines and dedicated hardware from NFOServers since I ran Garry's Mod servers in high school and NFO consistently provide the best hardware and network performance for the price.

Most of Tuckbot's traffic comes from the United States, so it made the most sense to set up the CDN servers there. Sorry, non-North American visitors - if I was made of money, I'd set up servers near you, too! Looking at the Google Analytics data, the traffic is split fairly evenly between the East and West Coasts:

<img src="/assets/2020-07-15-reddit-mirror-bot-cdn/img/tuckbot-june-traffic.png" alt= "Map of the United States of America with each state outlined and overlayed in blue to indicate the amount of traffic from that state. Highest concentrations (and darkest overlays) appeared in California, Texas, Florida, and New York." />

In a real world scenario, you would want to use your own load-balancing solution to intelligently route the traffic, but this is a hobby project on a budget, so I used [DNS load balancing](https://serverfault.com/a/102882). **Tl;dr:** some visitors will hit the server closest to them, others will hit the first server returned by the DNS lookup:

```shell_session
$ nslookup cdn.tuckbot.tv

Non-authoritative answer:
Name:   cdn.tuckbot.tv
Address: 192.223.31.196
Name:   cdn.tuckbot.tv
Address: 64.94.101.236
```

This is fine for our purposes. After all, this is a hobby project and not Facebook's next CDN. Now when a visitor loads a video on Tuckbot, their device picks a CDN server and sends the video request. If the CDN server has the file cached, it serves the cached file. If not, the CDN server retrieves the file from the usptream application server, caches it, and then serves it to the visitor.

Easy enough!

## Wrapping Up

And that's it! I think this solution is a fairly clever balance of complexity, cost, and value: for \$30/mo I have **450GB** of cache disk space and **36TB** of bandwidth between three CDN servers, each closest to the majority of visitors, and I only have to hit my upstream server and S3 storage a maximum of three times every 14 days.

We'll see where this takes me - I'd love to expand on it more as the Tuckbot project matures.
