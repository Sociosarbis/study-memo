---
title: web前端知识学习笔记-JS篇(2)
tags:
  - interview
  - javascript
  - 立即执行函数
  - IIFE
date: 2019-11-02 21:56:06
---
## 立即执行函数（immediatly invoked function expression）
从题目总结其性质

1. 
```javascript
const a = 1;
const b = 30;
(function a(b) {
     a = 10;
     b = 20;
     console.log(a)
     console.log(b);
}(10))
```
总结：这里会输出a函数定义和20。
1. 性质一，IIFE的函数名，不会在括号外出现声明，所以不会与`const a`产生冲突错误。
2. IIFE的函数名可看作是`const`，对其再赋值会无效，在严格模式下会报错。
