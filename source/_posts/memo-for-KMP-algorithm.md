---
title: KMP算法笔记
tags:
 - KMP
 - algorithm
date: 2020-08-30 23:15:14
---
## 前言
最近一个月，坚持每天上Leetcode做一道算法题。这周每天推送的算法题，大部份都跟字符串有关且有两天的较困难的题目都用到了KMP算法，KMP算法步骤不算复杂，但也需要我花了点时间去理解，下面对我的理解进行记述。

## 主文
结合代码讲解：
```java
String s = "babbbabbaba";
Integer len = s.length();
Integer fail[] = new Integer[len];
Arrays.fill(fail, 0);
Integer j = 0;
for (Integer i = 1;i < len;i++) {
    j = fail[i - 1];
    while (j != 0 && s.charAt(j + 1) != s.charAt(i)) {
        j = fail[j];
    }
    if (s.charAt(j + 1) == s.charAt(i)) {
        fail[i] = j + 1;
    }
}
```
对于字符串`s`，KMP的核心任务是先对查找的`pattern`构建一个`fail`数组，`fail`数组成员`fail[i]`的值`k`表示`s[0:k - 1] == s[i + 1 - k:i]`(以`i`为末位的长度为`k`的子字符串等于`s`的`k`长前缀)，第`9`行的回退操作也是基于这个性质。

上面`12~13`行比较好理解，由于上一次比较的结果是`j  = fail[i - 1]`，那假如这次比较也相等，自然`fail[i] = fail[i - 1] + 1 = j + 1`

