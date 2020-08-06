---
layout: post
title: "How proxy_buffering Cost Me $22 in 72 hours"
date: 2020-08-02
categories: programming
tags:
  - tuckbot
  - nginx
  - mistakes
  - proxy_buffering
  - caching
---

Last month I wrote about [caching video files in NGINX](/programming/2020/07/15/reddit-mirror-bot-cdn.html) to reduce the amount of bandwidth being served through my primary host, [DigitalOcean](https://digitalocean.com/).

Since writing that article, I've paid almost **\$22 in overages** (or 73% of monthly operating costs) **in 72 hours** as a result of a misconfiguration of the NGINX CDN servers. Ironic, right?

## How It Happened

After I wrote that article last month, I decided to play around with the [proxy_buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) option in NGINX. From its name, you can assume it involves keeping a piece of the upstream server's response on the proxy's disk before passing it downstream in the response. Logically, this is a waste of disk IO and has performance overhead. After all, the proxy server is configured to keep a copy on disk, so why should we be concerned about buffering the response to the visitor? The documentation even says as much:

> When buffering is disabled, the response is passed to a client synchronously, immediately as it is received.

You know that saying about **assumptions**? How they make an **Ass** out of **U** and **Me**? As it turns out, it doesn't stop there: **they'll balloon hosting expenses for your hobby project, too,** but I guess that's harder to fit into a catchy saying.

{% include solution.html %}

## Disabling Proxy Buffering Disables Caching

Although not stated in the NGINX docs, setting `proxy_buffering` to `off` will bypass your `proxy_cache` configuration. This actually took me a minute to wrap my head around at first, but it makes sense when you think about it: if `proxy_buffering off` is bypassing your proxy's buffer and responding to the visitor bit-for-bit as the upstream server responds to it, why would it stop to read from your proxy's cache?

Well, it doesn't, and I have the invoices and bandwidth graphs to prove it. See if you can spot where I pushed this change:

![cdn-02 graph showing a spike in average bandwidth from < 30Mbps to > 80Mbps](/assets/2020-08-02-how-proxy_buffering-cost-22-dollars/img/cdn-02-graph.png)

![cdn-03 graph showing a spike in average bandwidth from < 30Mbps to > 60Mbps](/assets/2020-08-02-how-proxy_buffering-cost-22-dollars/img/cdn-03-graph.png)

![app-02 graph showing a spike in average bandwidth from < 30Mbps to > 140Mbps](/assets/2020-08-02-how-proxy_buffering-cost-22-dollars/img/app-02-graph.jpg)

My app server went from serving an average of 6Mbps to around 140Mbps, and spiked at one point to nearly 800Mbps!

On the CDN side, because I told the CDN servers to disable buffering (and caching), I was **using twice the amount of bandwidth** as each request required **downloading from the app server** and **uploading to the visitor**.

I also applied this same configuration to the app server, meaning every request from the CDN was being proxied to my app server, and every request to the app server was **also bypassing the app server's cache and pulling directly from object storage**. This one particularly hurt because DigitalOcean's bandwidth, while already very expensive, is counted twice: once when downloading from object storage, and once when uploading from the app server to the CDN.

Here's an example, using a 20MB file, of how this got so expensive so fast:

> `$Visitor Request` &rarr; `LA CDN` &rarr; `NYC CDN` &rarr; `App Server` &rarr; `Object Storage`

Or if we visualize it, the black arrows are the request being filtered up the infrastructure, and the red arrows are the bandwidth being consumed by the servers uploading and downloading to each other:

<img src="/assets/2020-08-02-how-proxy_buffering-cost-22-dollars/img/bandwidth-flow.svg" alt="Graphic showing the consumption of 20MB of bandwidth as each server uploads and downloads to each other to fulfill the visitor request" />

In this instance, we've moved this 20MB video **seven** times across billable networks - three times at DigitalOcean, and four times at my CDN. Simple math says `7 * 20MB = 140MB` was consumed to serve a single 20MB video to a single visitor. Compare that to what happens normally:

> `LA CDN: 20MB uploaded` &rarr; `$Visitor Request`

### Make Sure You Understand What You're Doing

It's important to remember that just because you can make an educated guess on how something works, **it doesn't mean you actually understand how something works.**

Although I am using NGINX in an unconventional configuration for an equally unconventional purpose, stopping to research this setting and its use-cases would have yielded more information in evaluating how it would've impacted this configuration. _And_ avoid overage charges.

### Trust but Verify, Especially Yourself

I love the saying **"Trust but Verify!"** People seem to be easily offended by it - presumbly because they hear "I don't care, show me" - but I've found it to be one of the most useful steps in debugging; sometimes I visualize the problem differently from how it's described, sometimes there's additional context that is critical to the issue, and sometimes the description is just flat out incorrect.

It's important to trust that the issue is as described, or that your solution solves the issue, **but you need to verify** the issue happens as described or your solution works as expected. This is especially true when you are the one reporting/implementing and the one confirming/approving.

### Test, Test, Test!

I'm not sure why testing is such a drag for developers and engineers, but it causes enough pain that there's plenty of memes about it. Maybe it's the thought that if we just spent time analyzing the problem and creating a solution, why would it be wrong? How?! <span class="glow">_Don't you know I'm a coding God?!_</span>

Test, test, test, and really, test again! If your issue is repeatable and can be verified, **so can your solution!** And frankly, it would've taken one command to verify `proxy_buffering off` breaks the caching setup.

Before:

```shell
$ curl -s -o /dev/null -D - https://cdn.tuckbot.tv/htw8mn.mp4
HTTP/1.1 200 OK
Server: nginx
X-Origin-Cache: HIT
X-Primary-Cache: HIT
X-Node-Cache: HIT
```

After:

```shell
$ curl -s -o /dev/null -D - https://cdn.tuckbot.tv/htw8mn.mp4
HTTP/1.1 200 OK
Server: nginx
X-Origin-Cache: MISS
X-Primary-Cache: MISS
X-Node-Cache: MISS
```

## That's All I've Got

\$22 later, I now know that disabling proxy buffering in NGINX also disables proxy caching. And so do you.

Don't worry -- I won't charge you _nearly_ that much! Your invoice is in the mail, and return postage is not included :).
