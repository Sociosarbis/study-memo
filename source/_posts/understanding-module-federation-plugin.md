---
title: 理解module federation插件
tags:
  - module federation
  - webpack
  - plugin
date: 2021-06-14 23:24:14
---
`webpack 5`新增了`ModuleFederationPlugin`来声明不同应用（这里应用的定义，我觉得可以狭义地认为是各个独立的`webpack`**build**出来的`bundle`）间的引用关系和定义应用间的**共享模块**，并为每个应用额外生成一个`JS`文件来作为其他应用引用它的入口（一般称这个文件为`remoteEntry`）。

这些`remoteEntry`事实上也是`exteranl`模块，这部分也跟原来的`dll`插件也有点相像，不一样的是`remoteEntry`不需要我们在`html`中手动引用（浏览器环境下），而是`webpack`通过自己的模块加载系统`dynamic import`（文件加载地址在`ModuleFederation`中定义）这些文件。

`webpack 5`的**异步加载**会对不同类型的模块使用不同的处理逻辑。处理的`handlers`挂载在`__webpack_require__.f`对象上，这些`handlers`的统一入口是`__webpack_require__.e`函数。

目前我所看到的类型有这三种：

1. `__webpack_require__.f.remotes`：加载`remoteEntry`
2. `__webpack_require__.f.consumes`：加载共享模块
3. `__webpack_require__.f.j`：加载其他的异步模块
