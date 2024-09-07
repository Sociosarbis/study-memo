---
title: Key Points Of Preact Signal
tags:
  - signal
  - preact
  - vue
  - reactivity
date: 2024-12-07 19:09:27
---
## 前言
最新的一期`Javascript Weekly`记载`Vue 3.5`发布了，其中第一点改动提到了重构它`reactity`的实现。而这个实现的灵感来自于`preact`的`signal`，使用了`doubly linked-list`和`version number`，而它的核心源码只有一个文件，算是比较易读的。

## 本文
### 数据结构
```ts
type Node = {
  _source: Signal,
  _prevSource?: Node,
  _nextSource?: Node,

  _target: Computed | Effect,
  _prevTarget?: Node,
  _nextTarget?: Node
  _version: number
}

class Signal {
  _version: number
  _node?: Node
  _targets?: Node
}

class Computed extends Signal {
  _sources?: Node
}

class Effect {
  _sources?: Node
  _nextBatchedEffect?: Effect
}
```
`source`表示依赖项，`target`表示订阅者，`sources`通常存的是依赖链，是正序的，而`targets`存的是订阅链，跟倒序的。`targets`倒序可能是因为`batched effect`是先进后出的，这样子从末尾开始`notify`可以保证`effect`按正向执行。

### 依赖追踪
初始时，首先会在`Computed/Effect`执行`callback`前设自己为全局的`evalContext`，在`callback`执行时如果`get` `signal`的`value`，则会创建一个`node`, 其`source`设为这个`signal`，`target`设为这个`Computed/Effect`，再把这个`node`加入到`Computed/Effect`的依赖链中以及`signal`的订阅链中。

随后，当某些`source`发生变化时，会执行这些订阅者的`callback`。而此时，订阅者会执行`prepareSources`这个步骤，目的是通过将依赖链的所有`node`的`version`置为`-1`，标记上次的依赖项，当`callback`执行完，在`cleanupSources`这一步中，把`version`依然是`-1`的`node`剔除出依赖链；`prepareSources`除上述的作用以外，还会把`node`设到`source._node`里，`_node`其实是跟当前`evalContext`关联的，有种让`source`切换到`evalContext`相关的依赖链的上下文的意思。

### 通知去重
`Computed/Effect`被通知后`flags`会更新为`NOTIFIED`，如果在同一个`batch`里再被通知，就不会重复地加入过`batchedEffect`的链表中。

### 批量更新
实现比较简单，`batch`执行`callback`、更新`value`前增加`batchDepth`，执行完`callback`以后减少`batchDepth`，当`batchDepth`等于`1`时才逐个执行`effect`

### 其他
`Computed`的`callback`是`lazily evaluate`的，而`effect`则是`eager`的，这个跟`vue`的`computed`和`watchEffect`是一样的。

## 后记
看`preact`的`blog`文，`signal`的初版是用`Set`来实现的，但`Set`的问题是创建会比较`expensive`，遍历的速度相对比较慢，而且由于依赖的顺序可能会改变，这时候用`Set`来实现，可能得删除后重新加入，但这样的话文章里说会有新内存分配的可能性，这样会影响性能。而`doubly linked-list`则很好地解决这些问题。
