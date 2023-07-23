---
title: 案例学习MySQL死锁之1
tags:
  - mysql
  - deadlock
date: 2023-19-36 19:37:01
---
## 前言
在满心欢喜把手头的工作做完，预想可以度过一个美好周末的周五夜晚，手机突然弹出消息通知，一看竟是同事转告我业务用的数据库的`CPU`负载告警，日志里赫然显示着这样的一些关键词：`Deadlock found when trying to get lock; try restarting transaction`和`WE ROLL BACK TRANSACTION(1)`。`deadlock`听起来很可怕，仿佛死循环把程序无止境地阻塞住一样。关于数据库锁，我可以说是一无所知，所以为了解决实际的工作问题和补全相关知识，开始了这次学习。

## 正文

### 现在回过头来看，其实应该提出的一个疑问是导致`CPU`负载暴增是因为`deadlock`吗？

按常识判断**锁管理**以及**事务的多次重试**，毫无疑问都会增加`CPU`的工作。在`Google Cloud`的文档中，提到的`CPU`降低利用率的方案就有检查**记录锁争用**一项。以下是原文:
> An increase in Threads_running would contribute to an increase in CPU usage.
> When transactions hold locks on popular index records, they block other transactions requesting the same locks. This might get into a chained effect and cause a number of requests being stuck and an increase in the value of Threads_running. 
至少可以看出**锁争用**会增加线程运行数，增加原因是线程因阻塞而一直被占用，另一方面又有新的请求进来，需要创建新线程来处理，而线程运行数也会影响`CPU`使用率。

所以可能请求不多的情况下，**锁争用**可能都不会提升太多`CPU`使用率，但当量多的时候就不是这样了。
而`deadlock`其实是**锁争用**无法解决时的现象，`MySQL`内部会有`deadlock detection`，检测到的时候会先让某个争用方先回滚，释放持有的锁。而`deadlock detection`在高并发场景下又会影响效率，下面是`MySQL`文档的原文：
>On high concurrency systems, deadlock detection can cause a slowdown when numerous threads wait for the same lock.

所以可能的答案是`deadlock`不是问题的元凶，大量的**锁争用**才是。

### 锁是怎么产生的（以这个案例来研究）？

先假定有3个表：
```sql
CREATE TABLE `a` (
  id int UNSIGNED PRIMARY KEY,
  bId int DEFAULT NULL,
  cId int DEFAULT NULL
);
CREATE TABLE `b` (
  id int UNSIGNED PRIMARY KEY,
);
CREATE TABLE `c` (
  id int UNSIGNED PRIMARY KEY,
);
ALTER TABLE `a` ADD CONSTRAINT `fk_a_b` FOREIGN KEY (`bId`) REFERENCES `b` (`id`);
ALTER TABLE `a` ADD CONSTRAINT `fk_a_c` FOREIGN KEY (`cId`) REFERENCES `c` (`id`);
```
`a`跟`b`和`c`都是`manyToOne`的关系。
