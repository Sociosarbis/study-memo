---
title: 在webview中缓存大文件
tags:
  - webview
  - video
  - service worker
  - cache
  - indexedDB
date: 2021-07-24 18:20:23
---

## 需求背景及简述
视频配音，需要根据开始和结束时间分段播放视频，涉及视频跳至某一时刻的操作。另因需要在播放视频的时候同时进行录音，所以希望视频在播放的时候最好不要出现等待数据加载的情况，这样就要求在答题开始前完整下载整个视频。

## 解决过程

### 完整下载视频
以前有个误解，只要设置`video`的`preload`属性，它便会自动将整个视频下载下来。但事实并非如此，目前的方法是通过`XHR`请求视频资源。

这样出现了一个小问题，原来我们的视频资源是没有对页面所在的域名增加跨域允许的，此问题通过联系`CDN`服务商增加`Access-Control-Allow-Origin`响应头解决。

**值得注意**的是，我们经常看到`Access-Control-Allow-Origin`会设为`*`（允许所有域名），但如果是只对特定域名的话，除了域名以外还需要添上其协议，如`www.abc.com`需要改为`https://www.abc.com`。

### 缓存视频

#### 视频不能缓存的原因
视频是可以下载下来了，但却发现每次重新进入页面时，资源并没有被缓存，都是需要重新请求下载，这无疑会影响载入速度。尝试寻找原因，先看看视频的响应头是否有缓存控制相关的（是有的），实际在浏览器中也能正确地被缓存。

**与图片，JS等资源可以正确地被缓存相比，那视频为什么没被`webview`缓存呢？**
这里可以提出两个假设：
1. `webview`默认只会缓存特定扩展名的资源
2. `webview`默认对缓存资源的大小有限制

验证**假设1**，我们可以修改请求资源的`url`来改为其他扩展名，然后再代理到实际的文件。使用`whistle`可以配置如下的规则
```bash
cdn-resource.abc.com/acpf/data/upload/bt/2021/07/22/60f934011029c.png cdn-resource.abc.com/acpf/data/upload/bt/2021/07/22/60f934011029c.mp4
```
经试验，**假设1**不成立。

验证**假设2**，我们先将资源下载到本地，然后使用`ffmpeg`截取视频的头一秒作为新视频，示例命令如下：
```bash
ffmpeg -i 60f934011029c.mp4 -ss 00:00:00 -t 00:00:01 out.mp4
```
然后配置`whistle`如下规则
```bash
cdn-resource.abc.com/acpf/data/upload/bt/2021/07/22/60f934011029c.mp4 file://D:\MyDownloads\out.mp4 resCors://*
```
经试验，资源可被正确缓存，**假设2**成立


#### 缓存方案
我们也许可以让本地开发调整相关配置来开放此限制，但这个问题并非必须寻求本地开发的协助，`web`端也有本地缓存的方案，所以不妨仅使用`web`端的能力来解决问题。

网上查找相关的方案，主要可以找到这几个技术`ApplicationCache`，`service worker`, `indexedDB`。

`ApplicationCache`在`Android`的文档和`caniuse`上都有说这是个废弃的`API`，并将会在新版本移除，推荐使用新标准的`service worker`。

查阅`caniuse`，发现`service worker`至少在`safari 11.3`上才获得支持。**注意`service worker`本身并不是缓存API cache本身，chrome43版本以后页面环境也可以使用cache API了，但`service worker`原生支持对请求的劫持，所以不妨折腾多一点，把`service worker`也引入进来**。前面说到`service worker`和`cache`有兼容问题，所以需要找到一个`fallback`的方案。

这里就到`indexedDB`登场了，`indexedDB`不像`localstorage`只能储存字符串，还可以存储对象（例如存储`blob`对象），`indexedDB`在`safari 8`就已支持。

这两种离线存储的空间限制，从网上的资料上看，大概各个浏览器的实现都不太一样，但基本只是跟设备的物理储存挂钩。

#### 方案实现
以下是`service woker`和`indexedDB`的实现代码

1. `service worker`涉及页面`service worker`的注册和`service worker`的`worker`主逻辑的编写。
以下代码基本来源自`create-react-app`中的模板代码

注册`service worker`的逻辑，提供`register`和`unregister`两个方法。值得注意的是，`navigator.serviceWorker.register`的第二个参数，`scope`我们设为了`/`。`scope`是相对于当前页面地址的路径，默认为空，即当前地址，表示它可控制以这个地址为前缀的页面。

如果是`/`开头表示直接相对于域名。例如`scope`为`/hello`，域名为`www.abc.com`，那么则表示它能控制`www.abc.com/hello`为前缀的页面。所以这里设为`/`可以让我们控制这个域名下的所有页面。

但这里会有个问题，我原来没有想到的。`servie worker`只要注册了就会常驻在浏览器中的，所以即便在不是当时注册了它的页面下，只要在其`scope`的控制范围，它也会生效，这样就有可能不必要地在其他页面中出现。

另外有两个值得注意的点`service worker`需要放在与页面相同的域名下。`scope`的设置范围默认是不能高于`service worker`的`url`地址。

例如`www.abc.com/resource/service-worker.js`，它不能设为`/`, 至多只能为`/resource`。要解除这个限制，可以在返回`service worker`文件的响应头中添加`service-worker-allowed: : /`。现在是在`nginx`中添加的。
```ts
// serviceWorker.ts
type Config = {
  onUpdate?: (r: ServiceWorkerRegistration) => any
  onSuccess?: (r: ServiceWorkerRegistration) => any
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
)

function registerValidSW(swUrl: string, config: Config) {
  navigator.serviceWorker
    .register(`${swUrl}`, { scope: '/' })
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://bit.ly/CRA-PWA.'
              )

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration)
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.')
            }
          }
        }
      }
      // Execute callback
      if (config && config.onSuccess) {
        config.onSuccess(registration)
      }
    })
    .catch(error => {
      console.error('Error during service worker registration:', error)
    })
}

function checkValidServiceWorker(swUrl: string, config: Config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' }
  })
    .then(response => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type')
      if (response.status === 404 || (contentType != null && contentType.indexOf('javascript') === -1)) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config)
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.')
    })
}

export function register(config: Config) {
  if ('serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.VUE_APP_SW_PUBLIC_PATH || '', window.location.href)
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used to
      // serve assets; see https://github.com/facebook/create-react-app/issues/2374
      return
    }
    const swUrl = `${process.env.VUE_APP_SW_PUBLIC_PATH}/service-worker.js`
    if (isLocalhost) {
      // This is running on localhost. Let's check if a service worker still exists or not.
      checkValidServiceWorker(swUrl, config)

      // Add some additional logging to localhost, pointing developers to the
      // service worker/PWA documentation.
      navigator.serviceWorker.ready.then(() => {
        console.log(
          'This web app is being served cache-first by a service ' +
            'worker. To learn more, visit https://bit.ly/CRA-PWA'
        )
      })
    } else {
      // Is not localhost. Just register service worker
      registerValidSW(swUrl, config)
    }
    return true
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.unregister()
    })
  }
}
``` 

完成这次缓存任务的`worker`的逻辑代码。代码中引入`workbox`系列的工具库。

`clientsClaim`是通知注册此`worker`的页面，自己将开始控制页面

`registerRoute`是注册拦截请求的处理函数，处理函数的返回类型是`Promise<response>`。

```ts
/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for the list of available Workbox modules, or add any other
// code you'd like.
// You can also remove this file if you'd prefer not to use a
// service worker, and the Workbox build step will be skipped.

import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

clientsClaim()

// Precache all of the assets generated by your build process.
// Their URLs are injected into the manifest variable below.
// This variable must be present somewhere in your service worker file,
// even if you decide not to use precaching. See https://cra.link/PWA

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with your index.html shell. Learn more at
// https://developers.google.com/web/fundamentals/architecture/app-shell
// An example runtime caching route for requests that aren't handled by the
// precache, in this case same-origin .png requests like those from in public/
registerRoute(
  // Add in any other file extensions or routing criteria as needed.
  ({ request }) => !!request.headers.get('app-cache'),
  // Customize this strategy as needed, e.g., by changing to CacheFirst.
  new CacheFirst({
    cacheName: 'media',
    plugins: [
      // Ensure that once this runtime cache reaches a maximum size the
      // least-recently used images are removed.
      new ExpirationPlugin({
        maxEntries: 100
      })
    ]
  })
)

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

```

2. 下面是`indexedDB`的实现，`indexedDB`因为`API`比较冗余，所以一般会用`Dexie.js`这个库，不过因为我之前已经在其他项目写过`indexedDB`的`wrapper`，所以这里我用自己的实现（[地址](https://github.com/Sociosarbis/soc-common/blob/6cb8a9c1bf7bd404d6fb1c016b2e057ae4ddf565/src/js/browser/indexDB.ts)）。

另外我还专门为这次的需求，封装了个`DBCache`类，也仿照`workbox`实现了`maxEntries`。[地址](https://github.com/Sociosarbis/soc-common/blob/6cb8a9c1bf7bd404d6fb1c016b2e057ae4ddf565/src/js/browser/DBCache.ts)。

使用`indexedDB`的时候，需要将`XHR`的`responseType`设为`blob`。`Blob`可以通过`URL.createObjectURL`转为临时地址供`video`使用

## 总结
在解决问题的过程中，再次熟悉了`service worker`和`indexedDB`的使用，是一次充实的学习经历。另：本文忽略了`service worker`的`indexedDB`的`API`的讲解，读者可以搜索相关的文档补足。

