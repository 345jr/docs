---
title: 让家里 Mac 上的 Pi 在户外可用
sidebar_position: 2
description: 一个尚未落地的方案记录——用 45.136.177.22（xTom 美西、1G 内存）做入口，通过 SSH 反向隧道 + nginx + 域名 pi-mac.lopop.top，把家里 Mac mini 上的 pi-web 接进户外访问。
tags: [pi, pi-web, 内网穿透, SSH 反向隧道, nginx, 方案记录]
---

# 让家里 Mac 上的 Pi 在户外可用

> 状态：**方案已定，尚未实施**。这里只记录思路与待办，落地后回来补实测。

## 一、目标

两台 VPS 上的 pi 在户外随手可用，家里 Mac mini（M4、常开）上的 pi-web 却只能局域网访问。目标是**户外打开一个域名，就是家里那台 Pi**。

现状：

| 位置 | 访问方式 | 说明 |
|---|---|---|
| Mac mini（家宽） | `http://192.168.1.15:30141` | `PI_WEB_HOSTNAME=0.0.0.0`、**未设密码**；NAT 后面，公网不可达 |
| 107.174.102.11（ColoCrossing） | `:30141` 裸端口 + 密码 | `307 → /login`，线路一般 |
| 45.136.177.22（xTom 美西） | nginx 443 | 线路好（回国优化），**1G 内存**，已给 SkyDrop 当源站 |
| `lopop.top` | — | NS 已在 Cloudflare，`skydrop.lopop.top` 走 CF 代理 |

结论：**用 45 做入口**（吃它的线路），但它内存小，只做转发、不跑 pi。

## 二、「内网穿透」是什么

家宽在 NAT 后面，外网无法主动连进来。让内网机器可被外网访问的做法有三类：

| 类型 | 机制 | 前提 | 工具 |
|---|---|---|---|
| 端口映射 | 路由器把公网端口转到内网机 | 得有公网 IP（家宽多是 CG-NAT） | 路由器 DMZ |
| **反向隧道** | 内网机主动外连公网服务器，服务器开个洞把流量回传 | 只要一台能出网的公网机 | **ssh -R**、frp、nps、ngrok |
| P2P 打洞 | 两端装客户端，STUN 直连，失败退化中继 | 两端都能装软件 | Tailscale、ZeroTier |

群里说的「内网穿透」基本是第二类（frp 最流行）。关键在于**流量方向是内网 → 公网**，所以家宽没有公网 IP 也完全能用。

## 三、选定方案

路径：`手机 → 45（nginx:443）→ SSH 隧道 → Mac:30141`

选 **ssh -R** 而不是 frp / cloudflared：

- sshd 本来就在跑，**额外内存 ≈ 0**；1G 机器上少装一个常驻服务就少一个风险。
- cloudflared 若装在 Mac 上，路径会变成 `手机 → CF 边缘 → Mac`，45 完全不参与，好线路白瞎。

## 四、待办

- [ ] Mac 生成专用密钥 `~/.ssh/id_ed25519_relay`，公钥贴到 45 的 `authorized_keys`
- [ ] Cloudflare 加 A 记录：`pi-mac` → `45.136.177.22`，**先用灰云（DNS only）**
- [ ] 45 上加 nginx vhost（转发到 `127.0.0.1:30142`），`certbot --nginx -d pi-mac.lopop.top`
- [ ] Mac `.zshrc`：`PI_WEB_PASSWORD`（随机强密码）、`PI_WEB_ALLOWED_HOSTS=pi-mac.lopop.top`、`PI_WEB_IDLE_TIMEOUT_MS=0`
- [ ] Mac 建 `~/Library/LaunchAgents/local.pi-mac-relay.plist` 常驻隧道（`KeepAlive` 自动重连）
- [ ] 手机访问 → 密码登录 → 添加到主屏幕（PWA）

隧道命令：

```bash
ssh -N -R 127.0.0.1:30142:127.0.0.1:30141 \
  -i ~/.ssh/id_ed25519_relay \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  pi@45.136.177.22
```

nginx 里必须有的三行（为流式输出服务）：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_buffering off;   # 不关的话 agent 回复会憋着不吐
```

## 五、已知坑

| 坑 | 处理 |
|---|---|
| 走反代后 `400 Invalid host` | `PI_WEB_ALLOWED_HOSTS` 加域名 |
| 空闲 10 分钟服务被关 | `PI_WEB_IDLE_TIMEOUT_MS=0` |
| CF 橙云缓冲长连接、且绕开 45 | A 记录用**灰云** |
| 1G 内存 | 45 只做转发；`proxy_buffering off` 本来也更省内存；确认 swap |
| 家宽上行小、会抖 | `ExitOnForwardFailure` + `KeepAlive` 自动重连 |
| Mac 当前无密码 | 必须先设 `PI_WEB_PASSWORD`，否则同 Wi-Fi 任何设备都能执行 shell |

## 六、备选

- **Tailscale**：不暴露公网、零维护最省心；但流量走它自己的直连/中继，45 的线路用不上。
- **Cloudflare Tunnel**：免证书免端口；同理绕 CF 边缘，45 不参与。
- **IPv6 直连**：Mac 已有 `240e:` 公网 IPv6，可以试 `http://[ipv6]:30141`，但地址会轮换。
