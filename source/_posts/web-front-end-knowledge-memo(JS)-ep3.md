---
title: web前端知识学习笔记-JS篇(3)
tags:
  - interview
  - javascript
  - hoisting
date: 2019-11-02 21:56:06
---
## 变量提升与函数提升
```javascript
function outter () {
    return inner;
    function inner () {}
    var inner;
    inner = 9;
}
typeof outter() // 'function';
```
变量提升和函数提升指的是JS预编译的一个操作。

首先对于`var`声明的变量，只存在全局作用域和函数作用域，不像`let`和`const`还有块作用域。


1. 变量提升（指`var`声明的变量）指的是作用域内出现的变量声明会把声明放到作用域的开头
2. 函数提升是指除了1外的操作，还会把函数提前赋值给变量

根据上面两个规则，上面的代码经预编译会变成如下形式：
```javascript
function outter () {
    var inner;
    inner = function inner() {}
    return inner;
    inner = 9;
}
```