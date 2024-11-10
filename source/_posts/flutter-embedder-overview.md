---
title: Flutter Embedder概览
tags:
  - flutter
  - embedder
date: 2024-11-10 20:58:39
---
## 前言
前段时间，`华为`发布了`Harmony-Next`。据介绍，它是完全区别于`安卓`的自主开发的系统，不支持运行`apk`。
那作为一名`flutter`的开发者，自然也关心`flutter`能否支持`鸿蒙`应用的开发。在`flutter`的`issues`里，`flutter`的开发者表示没有官方支持`鸿蒙`系统的计划，但开发者可以通过实现`embedder`去自行支持。
于是这激起了我去了解`embedder`的兴趣。

## 过程
主要是通过阅读`go-flutter`的源码去了解的，后来了解了另外一个项目`flt`，作为对照来加深对`embedder`的了解。
他们最明显不同的地方是，前者是`go`实现，使用`glfw`框架，使用`opengl`做渲染的；后者是`rust`实现，使用`crossterm`库，直接在终端渲染。
它们分别对应的是`flutter engine`支持的其中两种渲染配置，一种是`opengl`（直接调用`opengl`的`api`，使用`gpu`硬件）；另一种是`software`（生成`image`像素`buffer`，再通过`SoftwareSurfacePresentCallback`，将数据传出，交由`host`自由渲染）。实际上`flutter`还支持`vulkan`和`metal`两种渲染器，这还表明默认使用的`skia`（或未来的`impeller`）绘图库支持硬件和软件的绘制方式。

`embedder`是`flutter engine`定义的一个`abi`，目标是在对应的平台上运行`flutter engine`，`flutter engine`本身是跨平台的（因为正如上面所说，`skia`是跨平台的），核心只是提供了渲染界面和与`flutter engine`与通信的功能。

通信方面，`embedder`定义了一些`callback`需要`host`去实现，由`flutter engine`调用，而`host`则可以直接调用`flutter engine`提供的方法。

可以看到`flutter engine`，主要调两类`callback`，一种是渲染相关的，一种是在某时刻将要在`engine`内执行的任务（`FlutterEngineTask`）。而为了执行`callback`或者说是处理事件，`embedder`需要提供一个`event loop`。
其实事件循环如果只是简单的实现，没有想象中那么复杂。`go-flutter`使用的是`glfw`类似`sleep`的机制，主线程休眠一段事件，等待`engine`线程或者本身`glfw`的事件，然后再去处理；而`flt`则是使用`mpsc`的消息模型，使用`receive`等待，收到一条信息以后，就直接处理。

因为`FlutterEngineTask`都会有一个触发时间，所以每次循环以后只会把到时间的任务，传回给`engine`进行处理。

系统相关的信息，比如窗口大小的改变，鼠标指针的交互，`flutter engine`则分别都有对应的方法（`FlutterEngineSendWindowMetricsEvent`和`.FlutterEngineSendPointerEvent`），让`host`通知到自己。

其他的一些事件是通过`channel`的方式，而这个`channel`跟我们写的`flutter plugin`里用到的`channel`是同一个东西。比如`go-flutter`在处理键盘操作时，用到是`flutter/keyevent`这个`channel`，跟我们写的插件不一样的地方是，这个名字是官方定义的，也可以说使用的是官方的键盘插件。

## 总结
以上就是阅读两个`embedder`实现源码后的一些所得，填补了一点这方面的空白。这两个项目的代码量都不算很多，也比较易懂，虽然都是试验性质的，但至少可以通过它们认识到`embedder`并没有想象中那样的复杂。

**ps：** 这篇文章只是日记或者学习备忘的性质，没有什么深刻的见解，真知灼见应该只有真正动手去做的时候才会获得。

