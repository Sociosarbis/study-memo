---
title: web前端知识学习笔记-CSS篇(1)
tags:
  - interview
  - CSS
---
1. 一列自适应，一列固定的两列布局实现。
```css
/* 浮动脱离文档流 */
.left {
  margin-right: 20px;
}
.right {
  float: right;
}
```
```html
<!--注意right要放在left前，float不占用空间的效果只对其后
的一个元素有效
-->
<div class="right"></div>
<div class="left"></div>
```
```css
/* 或使用flex */
.container {
  display: flex;
  height: 100%;
}
.left {
  flex: 1;
  height: 100%;
}
.right {
  width: 20px;
  height: 100%;
}
```
2. 宽度为相对数值的正方形
```css
/* 如果相对的是window可用 */
.square {
  width: 45vw;
  height: 45vw;
}
/* 更通用的是使用padding来填充高度，因为padding的相对的是width*/
.square {
  width: 45%;
  padding-bottom: 100%;
}
```