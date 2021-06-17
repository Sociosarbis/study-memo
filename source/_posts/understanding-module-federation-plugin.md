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
3. `__webpack_require__.f.j`：加载其他的异步模块，这里的`j`大概表示`jsonp`，传统的`webpack`异步加载方式

先说下共享模块，共享模块在`ModuleFederationPlugin`中声明以后，会被抽取成独立的`chunk`，类似我们使用`import(module)`，`module`也会成为`chunk`。

如果共享模块声明为`eager`则不会做`chunk`的分离，而是保留到`main chunk`中，这样可以以同步的方式引入。

但这么做会有问题，就算是被包含在`main chunk`里，但由于被声明为共享模块，模块的加载前会先`init`共享域`share scope`（通过`__webpack_require__.I`方法），假如`init`的时候也需要初始化`remoteEntry`，由于`remoteEntry`必然是以异步引入，导致`init`会返回`Promise`，连带这个声明了`eager`的模块在初始的时候也不能同步引入，然后就会报`Shared module is not available for eager consumption`这个错误（因为被认为初始化未完成）。

加载`remoteEntry`的时候，首先也会执行`remoteEntry`中的`__webpack_require__.I`方法。

`remoteEntry`的名为`default`的`shareScope`将会作为与引入它的`chunk`（`importer`）的共享域。相同版本的共享模块，会进行覆盖，不会重复加载两个相同版本但不同`url`的文件。共享域中也可能`register`不同版本的模块，但假如把`singleton`设置为`true`，则只会使用第一个进行加载的有效版本的模块。这里的有效版本默认是取`package.json`中对应的依赖版本声明。另外如果两个版本都是有效版本，则优先使用版本号更大的那个。





