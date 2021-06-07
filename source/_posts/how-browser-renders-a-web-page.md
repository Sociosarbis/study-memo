---
title: 浏览器是如何渲染网页的
tags:
  - browser
  - rendering
  - DOM
  - CSSOM
date: 2021-06-07 21:15:51
---

浏览器的渲染过程可以用`critical rendering path`来描述。

其包含以下几个步骤：
1. `DOM`（文档对象模型）的构建
`DOM`是以我们熟悉的`HTML`的元素节点构成的树状数据结构，可以通过`devtools`的`element`（元素）面板进行查看。

`HTML`的解析并非是等整个文档下载下来后再进行的，而是从上至下的，并以一个个节点为单位逐步构建`DOM`。

当遇到需要下载的外部资源如`script`, `link`, `img`标签，则会将下载任务放到后台进行。这些外部资源当中，只有`script`会阻塞`HTML`的解析（内嵌的`script`也会阻塞解析的执行）。

有时候我们并不希望下载`script`的时候停止`HTML`解析。于是`HTML5`为`script`标签增加了`async`（下载完后自动执行），`defer`（下载并`HTML`解析完成后，根据在各`defer` `script`在文档中的位置（从上至下）按顺序执行）两个属性标志`HTML`解析不需等待当前`script`执行。

虽然下载外部`CSS`不会阻塞`HTML`的解析但会阻塞页面的渲染，具体的表现是它会阻塞在文档中处于它下面的节点的渲染。`CSS`是`render blocking`，`script`是`parser blocking`，这两种阻塞的不同点的其中一个表现是，在下载`css`文件的时候，假如它下面还有其他需要下载资源（为什么知道还有其他资源需要下载，因为`HTML`的解析没有被阻塞），这些资源也会并行下载。

`DOMContentLoaded`事件是对应于`HTML`解析完成的，而`window.load`事件则是`HTML`（初始的）外部资源都已下载完成时触发。

2. `CSSOM`（CSS对象模型）的构建
当`DOM`构建完以后，浏览器会读取所有来源（外部，内嵌，内联，浏览器默认）的`CSS`来构建`CSSOM`，`CSSOM`是类似于`DOM`的树状结构，不同的是它的节点带有`CSS`信息，同时它会把非UI元素（如`link`,`title`,`script`等）剔除。另外，`CSS`的层叠式描述来源于样式可以继承的特性。
3. 渲染树的构建
渲染树是`DOM`和`CSSOM`的组合结果，它会将不可见元素（`display:none`，换句话说不占任何空间的）剔除。
4. 布局
布局过程会计算渲染树中各节点的大小和位置，这个过程另一个熟悉的名字`reflow`（回流），触发`reflow`的事件有：
  
    1. 增删和更新元素
    2. 改变文字内容
    3. 移动元素
    4. 元素播放动画
    5. 获取元素的位置尺寸等属性或样式，如`offsetHeight`和`getComputedStyle`
    6. 改变CSS样式
    7. 改变元素类名
    8. 增删样式表
    9. 改变窗口大小
    10. 滚动
    11. 改变字体
    12. 激活伪元素
可以看出到`reflow`是很容易就会触发的。
5. 绘制

进行各元素的绘制，同时浏览器会为某些会频繁更新外观，有动画效果的（[绘图层的创建理由的列举](https://github.com/chromium/chromium/blob/master/third_party/blink/renderer/platform/graphics/compositing_reasons.cc)）元素额外创建一个绘图层，绘图层也有保证元素重叠时正确的绘制顺序的作用。使用`devtools`的`layer`（层）或`rendering`（绘制）面板可看到层相关的信息。不同的绘图层的绘制过程是互不影响的。注意这一步还未将像素绘制到屏幕上。

6. 合成

    1. 主线程将绘图层和绘制顺序的信息传到合成线程
    2. 各个绘图层会被传递到光栅线程中使用GPU进行光栅化（绘图层可能会很大，所以合成线程会将绘图层划分成一些小块发送到光栅线程），结果会储存到GPU内存中
    3. 合成线程会根据是否可能会展示到屏幕上来确定小块的光栅顺序
    4. 光栅完成后，合成线程将要绘制的小块生成合成帧，绘制到屏幕上

    由于合成过程不在主线程进行，所以改变`transform`和`opacity`这两个只作用于合成过程的属性的动画会比较流畅。从运算量来说影响`layout`的`css`属性 > `paint` > `composite`。
    
    下面是`css`属性及其影响环节的参考表格：
    [CSS properties by style operation required](https://docs.google.com/spreadsheets/u/0/d/1Hvi0nu2wG3oQ51XRHtMv-A_ZlidnwUYwgQsPQUg1R2s/pub)
    
本文主要引用自：
[How the browser renders a web page? — DOM, CSSOM, and Rendering](https://medium.com/jspoint/how-the-browser-renders-a-web-page-dom-cssom-and-rendering-df10531c9969)