---
title: web前端知识学习笔记-JS篇(1)
tags:
  - interview
  - javascript
  - eventloop
  - setTimeout
  - promise
date: 2019-11-02 21:56:06
---

一条关于setTimeout和promise的执行顺序的题目。
```javascript

console.log('1');

setTimeout(function() {
     console.log('2');
     new Promise(function(resolve) {
          console.log('3');
          resolve();
     }).then(function() {
           console.log('4')
})
}, 1)
new Promise(function(resolve) {
     console.log('5');
     resolve();
}).then(function() {
      console.log('6')
})

setTimeout(function() {
     console.log('7');
     new Promise(function(resolve) {
          console.log('8');
          resolve();
     }).then(function() {
      console.log('9')
     })
}, 2)
```
在浏览器中，其正确顺序是1,5,6,2,3,4,7,8,9
相关知识可以参照[Understanding Event Loop, Call Stack, Event & Job Queue in Javascript](https://medium.com/@Rahulx1/understanding-event-loop-call-stack-event-job-queue-in-javascript-63dcd2c71ecd)

简单总结就是
1. 先执行所有的同步代码，异步代码会放到eventloop执行, setTimeout会放到callback queue, promise会放到job queue
2. 进入事件循环
3. 执行job queue的代码，当promise是一个立刻resolve的promise，then产生的promise会在此时放到job queue，由于job queue中有这一步放置的task，所以会继续执行job queue，而不是跳到callback queue中
4. 再执行callback queue的代码