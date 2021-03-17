---
title: 使用rust & webAssembly开发导出excel文件功能后的感想
tags:
  - rust
  - webAssembly
  - excel
---
## 前言

已经超过半年没写过文章了，原因除了肯定会有的懒以外，主要还是因为，
其一，根据过去的经验，写一篇文章要花比较长的时间，要先透彻地明白自己所讲的问题；
其二，部分学习和总结是已经写成代码了，再写成文字似乎就重复了；
其三，只想写一些自觉有新意的内容。

说回这次的要实现的功能。在以前公司做导出excel文件是放在后端做的，所以当数据量和使用人数过多的时候就出现了接口超时的问题。为了减轻后端的压力，所以这次打算后端提供必要的数据，excel文件由前端生成。

说到文件生成，我第一时间就想到了`web worker`和`webAssembly`的使用，加上之前学了下`rust`，正好可以学以致用。

这个功能做完以后，粗略地测试了下，导出一个`263KB`文件，`webAssembly`和`js`的实现的导出速度。
webAssembly|js
-----------|---
62ms| 52ms

所以从效果上来说，`webAssembly`实现完全是白做了。查了些资料，我觉得原因主要是：
1. 生成Excel的计算量不大，数据的传送反而占了比较多的时间
2. 数据要传给`webAssembly`，需要先转成`JSON`，再`encode`为`Uint8Array`，这个是与`JS`的实现相比额外的消耗。

## 项目介绍
[项目地址](https://github.com/Sociosarbis/json2excel)

这个项目是一个fork项目，除去原有的核心的文件构建逻辑，我做的改动主要有：
1. 对`verticalAlign`的支持
2. 支持数字类型的单元格数据
3. 添加作为回退方案的`js`实现

* 改动1其实只是按照原来的做法，增加对`verticalAlign`的处理。

* 改动2的问题是对既可能是字符串又可能是数字的数值处理，处理的方法是改成枚举类型，然后还要增加两行宏`#[derive(Deserialize)]`，`#[serde(untagged)]`,前者是支持`serde`库进行反序列化，后者是让`serde`自动判断反序列转化的类型。详细可以在这里[查阅](https://serde.rs/enum-representations.html)
```rust
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Value {
    Number(f64),
    String(String)
}
```

* 改动3是因为webAssembly只有在17年后的浏览器有支持，所以需要`js`方案作兼容，此方案用到了`exceljs`这个库，由于是运行在`worker`环境，不可通过`script`标签加载，另一方面第三方库是希望作为外部引用的，所以需要给打包生成的`worker`文件头部增加`importScript`方法。经过一些资料的查找，只需要设置`rollup`的`output.banner`即可


