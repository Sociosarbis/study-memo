---
title: https的tls握手过程
tags:
  - https
  - tls
  - handshake
date: 2021-06-06 00:33:25
---
`https`是在`http`的基础上加入`tls`对数据进行加密，增加安全度的协议。

`tls`所做的工作可以简单概括为，通过非对称加密的数据交换，双方生成相同的对称加密的密钥来对后面的数据进行加密解密。下面再稍微详细的说明其握手阶段的步骤。

`tls`会将所有信息封装，对信息进行分类。而握手信息也有它对应的类型为`Handshake`。而`Handshake`同时也是一种协议规范。在这种协议下也会对握手信息进行类型区分。握手过程涉及到的主要类型如下：

1. Client Hello

它会携带以下这些信息：
  1. Random：
      1. 4字节的`UTC`信息
      2. 28字节的随机码
  2. Session ID：之前连接的会话ID，如果失效或者未连接过，则为空
  3. 客户端支持的加密方式列表
  4. server_name_extension：可简单认为是为了告诉服务器客户端需要哪个`Host`（域名）的证书
  
收到`Client Hello`后，服务器会回应三种信息：

2. Server Hello
    1. Random，意义同`Client Hello`
    2. Session ID，意义同`Client Hello`
    3. 服务器在客户端支持的加密方式中，选择其同意使用的方式
3. Certificate（证书）
4. Server Hello Done：标志双方`Hello`阶段完成

客户端会：
1. 验证证书的有效期 
2. 验证证书的颁发机构是否受信任（已在本机中内置），
3. 利用该证书颁发机构的公钥对证书的签名进行解密（数字签名是私钥加密，公钥解密），再检查是否与证书的哈希一致（确认是否是该`CA`的颁发的）
4. 确认证书中的域名是否正确

验证成功后，进行密钥交换。
5. Client Key Exchange
客户端将自己的经过随机数据`padding`后的`pre-master secret`（固定，保存在应用程序中），使用证书提供的`public key`加密后发送给服务器。

然后发一条`Change Cipher Spec`信息，表示之后的消息都将会按合意的方式加密。

此时客户端和服务器都有`per-master secret`, `client random`和 `server random`的信息，那么双方会根据这些信息生成相同的`master secret`。`PRF`是`Pseudo-Random Function`，伪随机函数
```c#
master_secret = PRF(pre_master_secret, "master secret", ClientHello.random + ServerHello.random)
```

有了`master secret`以后，会使用它再衍生出4个`key`
    1. client_write_MAC_secret 客户端为信息生成16字节的完整性校验码，服务端对信息解密后，按同样的方式生成校验码，判断是否与信息的后16字节是否一致
    2. server_write_MAC_secret 服务为信息生成16字节的完整性校验码，客户端对信息解密后，按同样的方式生成校验码，判断是否与信息的后16字节是否一致
    3. client_write_key 客户端加密数据，服务端解密来自客户端的数据
    4. server_write_key 服务端解密数据，客户端解密来自服务端的数据


6. Finished

客户端会发送所有之前的`handshake messages`，并对使用`master secret`对`handshake messages`生成验证数据来确认之前的密钥交换和验证步骤是否成功。
```c#
verify_data = PRF(master_secret, "client finished", MD5(handshake_messages) + SHA-1(handshake_messages))
```

当以上步骤都完成后，HTTP应用层的数据传输会用`client_write_key`和`server_write_key`进行对称性的加密解密。

本文引用：
1. [The First Few Milliseconds of an HTTPS Connection](http://www.moserware.com/2009/06/first-few-milliseconds-of-https.html#)


