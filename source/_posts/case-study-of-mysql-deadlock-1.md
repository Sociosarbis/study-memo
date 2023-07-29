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
  id int UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bId int DEFAULT NULL,
  cId int DEFAULT NULL
);
CREATE TABLE `b` (
  id int UNSIGNED AUTO_INCREMENT PRIMARY KEY,
);
CREATE TABLE `c` (
  id int UNSIGNED AUTO_INCREMENT PRIMARY KEY,
);
ALTER TABLE `a` ADD CONSTRAINT `fk_a_b` FOREIGN KEY (`bId`) REFERENCES `b` (`id`);
ALTER TABLE `a` ADD CONSTRAINT `fk_a_c` FOREIGN KEY (`cId`) REFERENCES `c` (`id`);

INSERT INTO `b` (`id`) VALUES (DEFAULT);
INSERT INTO `b` (`id`) VALUES (DEFAULT);
INSERT INTO `c` (`id`) VALUES (DEFAULT);
INSERT INTO `c` (`id`) VALUES (DEFAULT);

INSERT INTO `a` (`id`,`bId`,`cId`) VALUES(DEFAULT,1,1);
```
`a`跟`b`和`c`都是`manyToOne`的关系，这时表数据分别是：
* `a`

  id|bId|cId
  -|-|-
  1|1|1

* b

  id|
  -|
  1
  2

* c 

  id|
  -|
  1
  2


#### 复现步骤

如果使用`mysql`的命令行工具，可以加上`--init-command='SET autocommit = 0;'`来禁用自动提交。

事务一|事务二|事务三
-|-|-
START TRANSACTION;(1)|START TRANSACTION;(1)|START TRANSACTION;(1)
INSERT INTO `a` (`id`,`bId`,`cId`) VALUES (DEFAULT,2,1);(2)|-|-
-|SELECT `a`.`id` AS `a_id`, `a`.`bId` AS `a_bId`, `a`.`cId` AS `a_cId`, `b`.`id` AS `b_id`, `c`.`id` AS `c_id` FROM `a` LEFT JOIN `c` ON `c`.`id` = `a`.`cId` LEFT JOIN `b` ON `b`.`id` = `a`.`bId` WHERE `a`.`id` = 1 FOR UPDATE;（3）|-
-|-|INSERT INTO `a` (`id`,`bId`,`cId`) VALUES (DEFAULT,1,1);(4)
ROLLBACK;(5)|-|-

执行`(3)`和`(4)`步都会发生阻塞，在`MySQL 5.7`中，只有出现阻塞才能通过以下查询看到锁列表和等待授予的锁列表。
```sql
SELECT * FROM `infomation_schema`.`innodb_locks`;
SELECT * FROM `infomation_schema`.`innodb_lock_waits`;
```
在执行`(3)`步时，可以从`innodb_locks`看到`lock_mode`为`S`和`X`的两个锁，分别记为`A`，`B`，`B`锁还会出现在`innodb_lock_waits`表中表示还在等待授予。当执行`(4)`步时这两个表还会多出一个`lock_mode`为`S`的锁。

* 注：
`innodb_locks`.`lock_table`表示锁所处的表，`innodb_locks`.`lock_index`表示锁使用的索引，`innodb_locks`.`lock_data`如果是**记录锁**则表示锁住的索引值，在这个示例中使用的索引是`PRIMARY`表示主键索引，所以`lock_data`的值为`id`。虽然上述三个锁的`lock_type`都为`RECORD`但单这个值并不能表明是**记录锁**，如果要分辨，**间隙锁**的`lock_data`会是逗号分隔的两个值；而在日志中**记录锁**会有`locks rec but not gap`关键语，而**间隙锁**会有`locks gap`关键语，而**Next-key锁**则不带这样的词语。

经过试验，得出了下面的分析：
1. `INSERT`语句如果带外键，则会使用`共享锁（S）`锁住，外键对应表的表记录
2. `SELECT`如果有`JOIN`，相当于执行了多表的查询，所以加上`FOR UPDATE`是会锁住各个表里符合条件的记录的。
3. 对于一条语句需要的锁，并不是同时一并获取的，而是按顺序分别获取的，`（2)（4）`步都是先获取`b`表的锁，再获取`c`表的锁，`(3)`步是先获取`c`表的锁，再获取`b`表的锁，假如把`(3)`步的`LEFT JOIN`顺序对调，则不会出现`deadlock`。

>通过源码里[INSERT添加共享锁](https://github.com/mysql/mysql-server/blob/ea1efa9822d81044b726aab20c857d5e1b7e046a/storage/innobase/row/row0ins.cc#L1367)的实现，可以印证到一条语句的锁是按一定顺序逐个添加的，所以存在部分未获取的情况，而且`INSERT`语句外键锁的获取顺序是`table`本身决定的，跟`INSERT`语句里的顺序无关。

4. 锁是在队列中逐个授予的，如果要获取的锁的`lock_mode`与当前已有的锁不兼容，则会`block`住，也就是说当执行到`(4)`步时已授予的锁是`S`，队列里按顺序是`XS`，因为`X`与`S`不兼容，所以要等待事务一释放锁，而队列中的`S`不是第一个，它只能跟着`X`在队列等待，假如`(3)`跟`(4)`顺序对调是`(4)`是不会阻塞的。

#### 死锁原因
到了`(4)`步执行后，事务三获取了`b.id=1`的锁，但在等`c.id=1`的锁，而事务二也在等`c.id=1`的锁，但没有获取`b.id=1`的锁。当事务一释放锁后，根据队列顺序，事务二先获取`c.id=1`的锁，但在等`b.id=1`的锁，这时候事务三跟事务二的等待的锁循环依赖了，于是造成了死锁。

## 总结
通过这个案例的研究，对`MySQL`增加了对锁在插入和查询场景的获取机制的认识。另一方面可以看出一条语句`JOIN`多个表还加排他锁，会增加不必要的锁获取，感觉会是我这类使用`ORM`的小白常犯的无意识错误。
在学习过程中，有看到这个[仓库](https://github.com/aneasystone/mysql-deadlocks)收集的死锁案例，看出死锁比较容易出现在事务有多条语句以及多个事务并发的场景，所以在并发数不多作限制的情况下，减少事务的执行时间和复杂度是必要的。
