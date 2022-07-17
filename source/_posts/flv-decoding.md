---
title: flv解包流程
tags:
  - flv
  - demuxer
  - codec
  - h.265
date: 2022-07-17 16:50:06
---

## 前言
前段时间公司需要做视频流的展示，视频流采用的是`flv`文件格式和`h.265`编码格式。

因为浏览器不支持`flv`并且一般也不支持直接播放`h.265`编码的视频，所以最终使用了[`WXInlinePlayer`](https://github.com/ErosZy/WXInlinePlayer)来实现视频的播放。

## 正文
因为`h.265`的解码十分消耗`CPU`的资源，所以想去了解`flv`视频流底层一点的知识，再进一步找到优化的方案。

于是就去查看了`WXInlinePlayer`里`C++`实现的`demuxer`相关的代码，于是整理了如下的流程图来说明`flv`格式解包。

{% raw %}
```mermaid
flowchart LR

e1["读取flv header"]-->e2["输出元信息"]-->e3["signature(3 bytes)"]
e2-->e4["version(1 byte)"]
e2-->e5["flags(1 byte，标志是否包含视频/音频)"]
e2-->e6["header size(4 byte)，\n作用像是header与body的分隔标志\n必须等于9，不然会视作不合法"]

e1-->e7["读取body"]-->e8["读取上个packet的size(4 bytes)"]-->e9["读取当前packet的所有tag"]-->
e10["tag的信息"]-->e11["类型(1 byte)"]
e10-->e12["大小(3 bytes)"]
e10-->e13["时间戳(4 bytes)"]
e10-->e14["stream ID(在同类型中自增)"]
e10-->e15["根据类型作不同处理"]-->e16["video tag"]-->e17["frameType(4 bits)"]
e16-->e18["codecId(4 bits)"]
e16-->e19["packetType(1 byte，\n0表示data为解码配置，\n1表示data为需解码的数据"]
e16-->e20["composition timestamp(3 bytes)"]
e16-->e21["读取data((大小 - 5) bytes)"]
e21-->e22["组合成NALU(Network Abstract Layer Unit)\n交给codec解码"]
e22-->e23["输出YUV格式的图片"]

e15-->e24["audio tag"]-->e25["format(4 bits)"]
e24-->e26["rate(2 bits)"]
e24-->e27["大小(1 bit)"]
e24-->e28["type(1 bit)"]
e24-->e29["packetType(1 byte)，含义与video tag的一致"]
e24-->e30["读取data((大小 - 2) bytes)"]
e30-->e31["组合成ADTS（Audio Data Transport Stream）\n后返回（给浏览器的audio context直接解码）"]
```
{% endraw %}

## 总结
实际上`flv`是`视频`和`音频`数据的容器，包含很多个`音视频`的数据包，对它们进行拆分后需交给对应的解码器解码。
`flv`直播流本质应该跟读取大文件类似，会从直播的视频数据某个位置截取作为文件的开头返回给客户端；
另一方面浏览器会创建的长连接会不断地拉取文件下一部分的新数据。
`mp4`跟`flv`一样也是`音视频`数据的容器，只是浏览器原生支持其播放，`flv.js`做的工作实际上是`demux(解包) flv`后再`remax(组装)`成`mp4`，再`feed`给`mse`进行播放。