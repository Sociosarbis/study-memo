---
title: web前端知识学习笔记-网络篇(1)
tags:
  - interview
  - HTTP
date: 2019-11-03 22:59:38
---
### HTTP处于TCP/IP（互联网协议套件）的应用层，是一种无状态的协议。
**（我的理解是无状态协议表示，每次请求应答都是独立的，不需要保证是否按顺序收发，不会维护client和server的状态，单次请求应答完成以后自动结束）**

### 一次HTTP操作简化流程
1. 发送HTTP请求（浏览器输入地址或XHR等方式）
2. 通过DNS获取请求地址对应的IP地址
3. 通过TCP/IP，与目标地址建立起TCP连接
4. TCP连接发送客户端的HTTP请求报文
5. 客户端通过TCP连接发送HTTP应答报文
6. TCP连接关闭，如果HTTP请求报头中设置了`Connection:keep-alive`，则TCP会继续保持连接

**值得注意的是keep-alive虽然是通过HTTP的报头设置的，但是实际执行的是在TCP中，所以不与HTTP是无状态的冲突**

**短连接**是无`keep-alive`，请求完成以后，TCP自动关闭；
**长连接**则相反。

**管线化（with pipelining）**是指长连接中客户端无需等待上一次请求完成，再去做第二次请求，**非管线化（without pipelining）**则需要做这样的等待。
*但实际上没有看过非管线化的情况（如果有，还请热心告诉我）*

### 格式示意图
请求报文：
![](http-request-format.png)

响应报文：
![](http-response-format.png)
[图片来源](https://juejin.im/post/5ad4465d6fb9a028da7d0117)

### 常见的响应的状态码

**200**(OK) **客户端发过来的数据被正常处理**

**204**(Not Content) **正常响应，没有实体**

**206**(Partial Content) **范围请求，返回部分数据，响应报文中由Content-Range指定实体内容**

-------------------------------------------------------------------

**301**(Moved Permanently) **永久重定向**

**302**(Found) **临时重定向，重定向后的请求方法可作改变**

**303**(See Other) **重定向后的请求方法变为GET**

**304**(Not Modified) **状态未改变， 配合(If-Match、If-Modified-Since、If-None_Match、If-Range、If-Unmodified-Since)，与*HTTP缓存*相关**

**307**(Temporary Redirect) **临时重定向，不应改变其请求方法**

-----------------------------------------------------------
**400**(Bad Request) **请求报文语法错误**

**401**(unauthorized) **需要认证**

**403**(Forbidden) **服务器拒绝访问对应的资源**

**404**(Not Found) **服务器上无法找到资源**

***401跟403不同的地方是，401可能是因为你没有登录，而403表示可能你没有相关的权限，有一次我通过npm发布包，错误提示403，我还错误地想是不是因为我没有登录呢，实际上是我的包名含有private scope，而我没有权限导致的***

------------------------------------------------------------
**500**(Internal Server Error)**服务器故障**

**503**(Service Unavailable) **服务器处于超负载或正在停机维护**

#### 从维基百科的配图中，虽然是说明UDP的，但也可以看出在TCP/IP层间传输中，大致存在这样的迭代关系

(**n**表示层序)

![](https://latex.codecogs.com/png.latex?packet_%7Bn%20-%201%7D%20%3D%20header_%7Bn%20-%201%7D%20&plus;%20packet_%7Bn%7D)

![](UDP_encapsulation.png)

*本文内容大部分基于[5分钟让你明白HTTP协议]()https://juejin.im/post/5ad4465d6fb9a028da7d0117*


