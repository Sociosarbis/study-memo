---
title: 从whistle热重载插件到websocket工作原理
tags:
  - whistle
  - hot-reload
  - plugin
  - websocket
  - stream
---

### 前言
* 工作上有些需求是需要去改后端渲染的文件的，但是由于不是通过webpack开发，没有修改完立刻更新页面的功能，所以显得不是太方便。要实时更新页面可以通过热重载或热更新，热重载比较简单，其实就是页面自动reload，热更新则需要重新打包已更改的文件，然后通过websoket发送新的补丁，完成更改。 

### 需要实现的功能
* 先不谈复杂的热更新，对于后端渲染的这类比较简单的页面，热重载已经能够很好地方便我们的开发了。
* 要做热重载，需要做以下两个功能：
    1. 监听文件的更改
    2. 通知页面进行reload
* 第一点比较简单，可以使用[`fs.watch`]()或者跨平台的库[`chokidar`](https://www.npmjs.com/package/chokidar)，都可以进行对文件更改的监听。
* 第二点对页面进行通知，我们平时用webpack开发的时候自然会发现页面会打开一个websocket的连接，而这个连接就是起服务器与页面客户端间通信的作用。

### websocket的工作流程

* 下一步就是怎么创建一个websokcet的连接的问题，分为两个部分，server和client
* client：
    * 对于比较简单的应用，例如这种通知更新的，可以简单地使用浏览器提供的[`Websocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)的api
* sever：
    * 首先node没有提供直接的api，可以用第三方库或者自己实现。对于第三方库，比较著名的有`socket.io`，不过需要在页面中使用客户端对应的库，所以不作考虑。而留意到webpack-dev-server用到的库是`sockjs-node`， 使用浏览器的api就可完成连接，所以这里就选用该库。
    * 先来看一下简单用例①:
    ```javascript
    const http = require('http');
    const sockjs = require('sockjs');

    const echo = sockjs.createServer({ prefix:'/echo' });
    echo.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
    conn.on('close', function() {});
    });

    const server = http.createServer();
    echo.attach(server);
    server.listen(9999, '0.0.0.0');
    ```
    如果了解过node.js，`http.createServer`的作用是创建一个http的服务器，那为什么又有一个类似的`sockjs.createServer`的方法，难道真的是创建多一个服务器吗？
    带着这个疑问，翻看源码：
    ```javascript
    class Server extends events.EventEmitter {
        constructor(user_options) {
            super();
            this.options = Object.assign(
            {
                prefix: '',
                transports: [
                'eventsource',
                'htmlfile',
                'jsonp-polling',
                'websocket',
                'websocket-raw',
                'xhr-polling',
                'xhr-streaming'
                ],
                response_limit: 128 * 1024,
                faye_server_options: null,
                jsessionid: false,
                heartbeat_delay: 25000,
                disconnect_delay: 5000,
                log() {},
                sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js'
            },
            user_options
            );
            ...
            this.handler = webjs.generateHandler(this, listener.generateDispatcher(this.options));
        }
    }
    ```
    可以看到它并没有做任何与连接相关的工作。然后再看到用例①中对于sockjs创建的这个**"server"** ，还有一步是`echo.attach(server)`，看来这里才是**"sockjs sever"**工作的入口。源码如下：
    ```javascript
    ...
    attach(server) {
        this._rlisteners = this._installListener(server, 'request');
        this._ulisteners = this._installListener(server, 'upgrade');
    }
    ...
    ```
    原来是对**http server**的**request**和**upgrade**事件做监听。
    **request**是收到http请求时触发的，那**upgrade**呢？
    
    #### 根据node的文档所述：
    >Emitted each time a server responds to a **request with an upgrade**. 
    
    这里的**request with an upgrade**，通过后面的example，粗浅地可以认为是**Connection** header为`'Upgrade'`，并且还有一个`Upgrade`header的**request**。
    ```javascript
    const options = {
        ...
        headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket'
        }
    };
    const req = http.request(options);
    ```
    * request事件的callback参数为**request和response**，而upgrade事件则是**request，socket和head**。第二个参数由**response变为socket**，而这个socket参数就是client和server间的TCP连接，而**websocket**就是对这个**TCP连接的socket对象**进行操作，根据**websocket**协议的规则，对**socket**对象中通信的数据进行解析读入和封装用户的消息进行写入。
    * 顺带一提，对于要upgrade为websocket的请求，服务端也会写入符合http规则的响应报文（而这个过程称作建立websocket连接的握手），并且不会调用`response.end或者说socket.end`去结束服务端和客户端的连接。
    ```javascript
    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
        'Upgrade: WebSocket\r\n' +
        'Connection: Upgrade\r\n' +
        '\r\n');
    ```
    **ps：**建立websocket的request还会有`sec-websocket-version`和`sec-websocket-key`等headers，而response还会有`sec-webSocket-accept`等headers，由于本文主旨在于建立websocket的通信流程的概念，所以具体的协议标准等知识，可自行search。
    
    * 建立了websocket的连接，下面就是要知道是怎么从socket收到消息和写消息到socket中。这两个步骤对应于这两行来自**faye-websocket\lib\faye\websocket\api.js**的代码(**faye-websocket**是**sockjs-node**的依赖库)
    ```javascript
    this._stream.pipe(this._driver.io);
    this._driver.io.pipe(this._stream);
    ```
    `this._stream`就是TCP的`socket`（也是流对象），而`this._driver.io`是一个双工(Duplex, 意为可读可写)的流。
    **ps:**流就是nodejs的Stream类。
    * 之前我看到pipe这个方法，对他的机制有点摸不着头脑，不知道他是在什么时候才会把数据传到**可写流（Stream.Writable）**中。要解决这个疑问，只需要看到这一步，就知道触发**可读流(Stream.Readable)**的`data`事件时，就会把数据写到可写流中。而data事件的其中一个触发时机，就在Readable的read方法中。而pipe方法在最后，会通过resume方法，让流进入**flowing** mode，这个mode简单来讲就是假如Readable的**Internal buffer(内部缓存)**，就会通过循环不断地调用read。
    ##### 最后一个疑问他内部缓存地数据又是从哪里来的呢？
    答案是在`read`方法中，会调用`_read`方法。`_read`方法的作用是调用`Readable.push`方法，把数据放到**Internal buffer**里。可能这也是为什么在继承或者实现Readable的时候，需要去实现一个`_read`方法来获取自定义数据。
    ```javascript
    // https://github.com/nodejs/node/blob/master/lib/_stream_readable.js
    src.on('data', ondata);
    function ondata(chunk) {
        ...
        const ret = dest.write(chunk);
        ...
    }
    ...
    if (!state.flowing) {
        debug('pipe resume');
        src.resume();
    }

    return dest;
    ```
#### websocket的内容就介绍到这里，下面是要讲的是完成热重载需求的whistle插件的开发。
为了更好地理解下面的内容，可先阅读whistle文档中[**插件开发**](https://wproxy.org/whistle/plugins.html)的部分。

如下是我在看过文档，github上的demo和whistle的源码后的几点所得。
1. whistle的插件实际上就是让插件export一个接收**server对象的函数**, 然后自己编写对**server对象**事件响应的callback，事件主要是request和connect，request就是普通的http请求，connect可以是websocket或者tunnel请求(*ps:没了解过tunnel请求*)
2. **每个插件都会创建一个监听本地新端口的入口server，其主要的作用是把请求分发给它其下的子server，而这些server虽然都是真的http server，但它们不会监听端口，在请求的不同阶段，入口server会把请求分发到对应的子server**，子server有如下这些：
    1. uiServer
    2. reqRead
    3. reqWrite
    4. resRead
    5. resRulesServer
    6. resStatsServer
    7. resWrite
    8. rulesServer
    9. server
    10. statsServer
    11. tunnelReqRead
    12. tunnelReqWrite
    13. tunnelResRead
    14. tunnelResWrite
    15. tunnelRulesServer
    16. wsReqRead
    17. wsReqWrite
    18. wsResRead
    19. wsResWrite
    但问题是具体需要怎么响应对这些server的请求事件，文档里没有说明。只能在提供的demo中找到，某些server具体需要response什么东西。
    例如`'rulesServer'`结尾的server，需要response如下的JSON数据来动态地去添加whistle的规则。
    ```javascript
    JSON.stringify({
        rules: `${req.headers.host}/sw-register.js file://{sw-register}
        ${req.headers.host}/sw.js file://{sw-content}`,
        values: {
            'sw-register': registerContent,
            'sw-content': content
        }
    }, null, 4)
    ```
    **rules**是whisle规则的文本，**values**则是用于替换规则中的变量。
    所以如果我们需要给我页面注入，websocket client的代码的话就在ruleServer中`response.end(rules)`就可以实现了。
3. 规则的值，如`www.ifeng.com method://post`中的`post`，可通过`req.originalReq.ruleValue`获取。
4. server当中有两个比较特别的，一个是**uiServer**，需要写一个完整的有前端页面的web应用，让用户修改插件的配置，给其他server去获取使用。另外一个是上面**No.9的"server"**，这个相当于一个代理的服务器，他的response会成为最后whistle传回来的那个response，其他的如ruleServer，就只是像上面说的只是通过resposne来增加一些临时的新规则。
5. \*Read,\*Write这两种结尾的server，本人到目前为止还不清楚到底要怎么用。

### 下面是这个插件简单的实现代码：
[whistle.hot-reload-plugin](https://github.com/Sociosarbis/whistle.hot-reload-plugin)

### 总结
1. 虽然这个功能很简单，但是它涉及到的知识还是很多的，而且还没有完全弄明白， 后面继续学习。
2. whistle的代码目前对我来说还是比较复杂的，涉及到协议的不同规则，请求转发， stream pipe等web后端的知识。 