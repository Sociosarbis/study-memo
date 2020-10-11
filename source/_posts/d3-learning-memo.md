---
title: D3学习备忘
tags:
  - d3
  - chart
  - svg
---

# 前言
在web前端开发中，时常会碰到显示图表的需求。而在这个领域中，国内最有名的库莫过于`Echarts`了，其他的还有`Ant`的`g2`，`highchart`和`chart.js`等，这些库的特点是开箱即用，基于配置，根据官方提供的demo，进行一定的调整就能够满足开发的任务的，也有提供自定义的方案，满足特殊的需求。

不过我总感觉不能满足于这种高级封装库提供的便利，因为这样比较难提升自己的开发能力，所以希望去折腾些较底层的库，让自己可以多动些脑筋。（也有一种潮流是直接使用`React`这类前端框架，做可视化的工作（同样也是数据驱动视图），不过这样子就相当于再造一个轮子了）

而`d3`就是一个很好的选择，历史悠久，使用者众多，作者`Mike Bostock`也是个很有创造力的开发者，独力写了很多优秀的`可视化demo`，除了`d3`还创建了可视化分享平台`Observerblehq`。

`API`设计方面采用了类似`JQuery`的链式调用，代码组织的特点是分成了多个独立的模块，分开仓库进行管理，所以也方便使用者按需引入。`d3`的类的创建，不使用`new`的方式，而通过函数返回一个新的对象，对象相关的变量，存储在闭包内。

我觉得`d3`主要是一个可视化数据处理工具函数的库，不提供图形渲染引擎，所以可以让使用者全盘掌控显示的内容。

# API概念说明

## d3.selection

`d3`的DOM操作的风格十分类似`Jquery`

1. 创建DOM元素并返回一个类似`Jquery`集合的`Selection`对象

```typescript
d3.create('svg')
```

2. 选择DOM元素，`select`和`selectAll`都会返回一个`Selection`。
```typescript
selection.select('rect')
selection.selectAll('rect')
// 或者使用d3的静态方法
d3.select('rect')
d3.selectAll('rect')
```

3. 绑定数据。绑定数据的方法有`data`和`datum`两种，`data`会返回一个新的集合并逐一把每一行数据绑定给`selection`中的成员，如原`selection`中的成员数量比`data`的行数小，则新创建的`selection`会使用占位用的`empty`补足；`datum`则是将整组数据逐一绑定给每一个`selection`成员，不会产生新的集合。
```typescript
let arr: any[]
selection.data(arr)
// 设置selection各成员绑定的数据
selection.datum(arr)
```

4. 绑定数据的行数与`selection`的数量有出入时，`d3`会产生`enter`和`exit`的集合。但是并不会默认给`enter`的集合自动创建对应的DOM元素，这时可使用`join`去创建。

```typescript
let arr: any[]
selection.data(arr).join('rect'/** 元素的标签名 */)
// 与上面等价
selection.data(arr).enter().append('rect')
```

5. `selection.call`接收一个以`selection`为参数的回调函数，目前看来用途主要给`selection`添加一些子元素，这样就不会改变外部链式调用的主体。

```typescript
selection.call((s) => s.append('path'))
```

6. `selection.each`方法并不会回传一个子`selection`，而是回传三个参数`d`（**子data**）, `i`（索引），`nodesGroup`（`selection`内部的DOM集合），回调函数的`this`等同于`nodesGroup[i]`
```typescript
selection.each(function (d, i, nodesGroup) {
  // 由于并不是子selection，所以需要进行select把DOM变成d3的selection对象
  d3.select(this)
})
```

## d3.Shape
1. `d3.lineRadial`与`d3.line`作用同样都是生成线段，不同的是`lineRadial`的坐标系是**极坐标系**，而且需要注意的是**0rad**是**12点方向，角度增长为顺时针**，每个点由`angle`和`radius`方法定义。