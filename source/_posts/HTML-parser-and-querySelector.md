---
title: HTML parser和querySelector实现分析
tags:
  - HTML
  - parser
  - querySelector
date: 2019-11-13 18:39:41
---
## 前言
* 最近在学习React Native的开发，把web端的网站转成app，由于部分api的缺失，需要从web的HTML里提取信息，那么就需要一个解析HTML的工具。
* cheerio就是其中一个有名的库，但遗憾的是cheerio本身不支持在React Native环境运行。
* 记得之前看过微信团队的一个开源项目[kbone](https://github.com/wechat-miniprogram/kbone)是通过在小程序中模拟浏览器环境让面向web端开发的应用也能运行在小程序中。里面就包含了**HTML parser**和**querySelector**的实现，这两个的实现主要是
参考了[HTMLParser](https://johnresig.com/files/htmlparser.js)和[Jquery的sizzle](https://github.com/jquery/sizzle/tree/master)。
* 具体实现可以到上面的仓库查看相关代码，下面介绍实现的主要逻辑

## 分析
1. **HTML parser**
  1. 建立一个栈stack 
  2. 抛开正则表达式不讲，最重要的逻辑是把遇到的**开始标签(opening tag)**时，会做如下操作：
    1. 如果栈不为空，就**把新的标签加到栈顶的children数组**中
    2. 把它**存到stack**
  3. 当遇到**结束标签(closing tag)**时，把stack中相同类型的标签压出
2. **querySelector**
  1. 初始的时候，遍历parser解析出的HTML tree，把node的id，class和tag分别加入到**idMap**, **classMap**，**tagMap**中
  2. selector的解析，**一般我们读的时候是从左往右读的，但这个实现的解析的是从右往右的**。
    1. 根据最右的规则，决定是从idMap, classMap还是tagMap从取出**最初的候选列表**
    2. 从右往左，根据一个个规则去过滤（收窄）候选列表
      * *这样做的好处，能想到的是，从右往左实际上是一种自下而上的方式，可以避免自上而下需要递归的问题。*
    3. 去重和排序候选列表。去重不说，**排序它使用的方法是**，先找到两个node的最小的共同祖先A，设B为A下的子节点（B可能为node的祖先或者node本身），根据两个B的先后顺序，来决定node的先后顺序

## 感想
  1. JS现在可以做跨平台的开发，虽然有些方法在浏览器中是有的，但可能别的平台没有，这时候就需要开发者去了解DOM API的实现方式。
  2. 假如浏览器的querySelector也是类似上述的实现方式，那么对于CSS selector的优化，可以做如下三点:
    1. 优先度应该是**id，class再到tag**，**class方面尽量使用出现频率较少的那个**，**尽量不要用\***，因为用*相当于选择了所有的tag类型
    2. 关系选择器方面，**尽量不要用跨层的空格selector**，而要使用表示直接关系的
    3. **selector要尽量短**，因为每多一层就多一次判断
