---
title: 固定头列的表格
tags:
  - table
  - fixed header
  - fixed column
  - vue
  - better-scroll
date: 2021-08-28 22:23:39
---
## 需求背景
在移动实现一个固定头列的表格，效果大概是像[element-ui](https://element.eleme.cn/#/zh-CN/component/table#gu-ding-lie-he-biao-tou)展示的这个一样。

## 实现过程
最开始的版本，我简单地将第一列，表头和表体拆开。分别监听它们的`scroll`事件，然后同步它们的`scroll`位置。这个方法与`element-ui`的差不多，只是没有使用`table`元素实现。

但在测试的时候发现，表头和第一列和表体的滚动会有些不同步，这点其实在`element-ui`的示例也能看出来。

这个问题似乎如果用事件驱动的方式，总可能会出现视图不同步的问题，特别是在移动端的表现千差万别的情况下。

而如果它们是一体的话，那就能保证是同步的了。所以我们换另一种思路，将它们三者合为一体，但又要在滚动的时候将第一列和表头分别固定在左端和顶部。要解决这个矛盾，我们只需要设置第一列和表头的`transform`让它们作抵消`scroll`的偏移。

但这样又回到最初的问题带来的结论，我们似乎不能通过事件的回调完全实时地同步，例如上面说的`transform`和`scroll`，当垂直滑动时，同步表头的`transform`；当水平滑动时，同步第一列的`transform`。

为了避免滚动时需要同步位置的问题，这里就分别引入多一个第一列和表头，它们分别定位于左端和顶部，悬浮在真正的表格上。使用的逻辑如下：
1. 水平滚动，显示表头（真），显示第一列（伪）
2. 垂直滚动，显示第一列（真），显示表头（伪）
3. 滚动停止时，再分别同步表头（真）和第一列（真）的`transform`，真伪不同时不存在，一方显示，另一方隐藏

但在移动端可能会同时出现水平和垂直的滚动，这样可能还是不能避免实时同步的问题。为了禁止两种滚动的同时出现，我引入了`better-scroll`，它默认是只进行单向的滚动。

至此基本就解决了固定头列的不同步的问题。但前面说到，我们需要做一个完全一致的假的第一列和表头，而使用的框架是`vue`，如果写到`template`中，就会比较冗余。

能想到的解决方法有：
1. 用`JSX`写`render`，这样子就能用暂存渲染的逻辑并进行复用
2. 假的`DOM`可以直接用`API` `clone`出来

第`2`个方法可能会涉及到管理假`DOM`的内容更新问题，维护比较麻烦。第`1`个方法是可行的，但由于之前我并没有将表格抽取为一个组件，直接重写会比较麻烦而且本身也应该是作为一个独立组件存在。所以我选择将表格抽取成一个与业务关系不大的组件，提供`header`和`cell`两个`scoped slot`去让使用者按业务要求进行渲染。

作为一个独立组件后，即便是写`template`也不会太冗余。

## 展示DEMO
<iframe src="https://codesandbox.io/embed/trusting-zeh-jddoy?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="trusting-zeh-jddoy"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

这个实现目前我感觉有以下不太完美的地方：
1. 直接操作`DOM`
2. 没有使用`table`元素
3. 表格需要使用者指定宽高
4. 当一轴滚动时，另一轴会同时出现微小的移动

在实现过程中处理了`better-scroll`的一个bug，当设置是只允许同时出现一个方向的滚动时，它的惯性计算还是会出现两个方向，所以我作了个`touchEnd`时，让`startX`等于`x`或者`startY`等于`y`的处理