---
title: 按照官方指南实践vue SSR
tags:
  - vue
  - SSR
---
## 前言
年末跟新公司的同事聊过node中间件和服务端渲染的问题，大概的意思就是将原来nginx的特定路由的分发，交由我们前端组负责，使用node代替的想法，希望前端组能够不依赖后端的同学，独立完成一些服务端的工作，方便后面去做服务端渲染。
于是，趁着春节假期，在家里花点时间，做一下vue的服务端渲染的实践。

## 实践笔记
由于之前的项目一般都是通过vue-cli去生成的，所以初步的想法是思考将已有项目改为SSR的方法。
于是实践便由`vue create ssr-demo`命令生成的项目开始了。
第一步，一般是去查看[官方指南](https://ssr.vuejs.org/guide/)。可喜的是，在某一页中看到了一个官方demo的[github链接](https://github.com/vuejs/vue-hackernews-2.0)，有示例项目作为参照，认识会更具体一些。

**SSR大体来说是用同一份代码，分别以server环境和client环境为目标做两次打包（具体来说可以是使用两份配置，运行两次webpack），server端收到请求运行对应环境的bundle，render出html，发回client端；而html里包含了client环境bundle的script，css资源的链接。加载完script以后会hydrate（激活）服务器渲染出来的app的html（如给DOM添加listener）。**

所以在改造项目时，**需要意识到server环境和client环境的API的不同**。
**改造过程中已知的两个环境的不同点有：**
1. server端在渲染component时，生命周期只会进行到`created`，所以最好是做到**全局**和周期`created`之前的代码是环境通用的代码。
2. 需要预获取的数据的component，可以在构造options提供`serverPrefetch`的option，这是一个this指向vue instance的function，如果返回一个promise，会等这个promise resolved后再去做component的render。
3. client端的bundle的webpack config一般可能会加splitChunks来做代码分割，可是server端的bundle则需要将所有代码打包成一块，所以不做代码分割。
4. server端的入口文件需要export一个接收ssr context对象，返回可resolve出app实例的promise。
5. server端需要添加`VueSSRServerPlugin`，webpack打包最终生成一个json；client端则添加`VueSSRClientPlugin`，除了生成的js，css等文件以外，还会生成一个`client-manifest`的json文件（用于提供生成的文件的信息，让服务端渲染的html能够正确插入client端生成文件资源的标签）。
6. server端的配置还需要在`DefinePlugin`中加上`Process.env.VUE_ENV='server'`的配置。

**共同点**
1. 由于生成的html由服务端渲染而成（或者说由服务端渲染负责），所以原有的htmlWebpackPlugin也去掉。而prefetch，preload和pwa的插件依赖于htmlWebpackPlugin，所以在配置中都要去掉。

**遇到的问题和解决方法**
1. vue-cli生成的项目，除非释出webpack的配置，否则都是通过创建的vue.config.js对webpack进行调整。而当在开发的时候，因为不去用默认的webpack的devServer，所以需要获取根据vue.config.js生成的webpack配置。而`@vue/cli-service/lib/Service`的Service实例提供了一个
`resolveWebpackConfig`的方法，去得到相应的wepack配置。
2. 第二个问题时`1`中的Service实例怎么找到对应的vue.config.js文件呢？现在有client和server两个config，需要动态替换vue config来生成webpack配置。通过阅读网上方案和`@vue/cli-service/lib/Service`的源代码，得知可在创建Service实例前，通过改变`process.env.VUE_CLI_SERVICE_CONFIG_PATH`为对应`vue.config.js`的**绝对路径**，便可实现动态切换需求。
3. `1`中提到需要自己去写一个devServer，主要就是要实现打包资源请求的响应和模块热更替。修改的关键是添加`webpack-dev-middleware`,`webpack-hot-middleware`和`HotModuleReplacementPlugin`。
  1. `webpack-dev-middleware`的功能是处理打包资源请求的响应，同时也把compiler的fileSystem改为`memory-fs`（将打包的文件缓存在内存里），如果有与请求匹配的打包后的asset，则将之返回。
  2. `webpack-hot-middleware`的是做监听webpack的recompile事件，然后通知客户端的工作。
  3. `HotModuleReplacementPlugin`则是给文件的`module`添加`hot`的属性，提供一些关于请求更新后的模块资源等API，`webpack-hot-middleware`包含了这些API的使用，所以一般不需要自行配置。
4. 虽然`3`中的`webpack-hot-middleware`帮忙处理了webpack的recompile的模块更新问题，不过还有一个`index.template.html`文件需要做热更新，在这里是使用`chokidar`做文件更新监听，再利用`webpack-hot-middleware`的`publish`方法通知客户端。
5. 到了生成`production`环境文件的时候，依然还是使用vue-cli进行生成，所以像`2`中所述，需要在`package.json`的script中填写`vue.config.js`的**绝对路径**。跨平台的环境变量设置可以使用`cross-env`，但是要得到这个**绝对路径**，需要知道**工作目录**。但是在不同平台的**工作目录变量**的名字可能不一样，所以这里使用了`$INIT_CWD`这个变量。`$INIT_CWD`指的是**npm指令运行时的工作目录**。
6. 当我尝试做组件的**Data Prefetch**时，使用了`'/topNews'`这个相对的url，在client端是没问题的，会带上host和port，但是在server端，他没有这个context，如果是用相对的url，host会是localhost（这个没有问题），但是**port会是默认的80**，所以需要在axios那里根据是否是server环境，去加上如`http://localhost:8080`的前缀。

### 写在最后
项目放在[github](https://github.com/Sociosarbis/vue-ssr-demo)，大部分参考自官方的demo，已完成项目框架的搭建。后面假如说真的有需要的话，再进一步完善本项目。
后面可做的有:
1. 做成vue-cli的preset，一件生成目录结构。
2. 添加server的proxy和cache功能。
3. 配置作为业务模块分发的路由。

