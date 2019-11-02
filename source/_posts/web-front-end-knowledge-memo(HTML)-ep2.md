---
title: web前端知识学习笔记-HTML篇(2)
tags:
  - interview
  - HTML
  - meta
  - viewport
---
移动端的适配离不开meta标签的viewport设置，比较常见的设置
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
属性：
  1. width表示将document内容宽度设为width制定的数值，可填具体数值，如640，或device-width（表示device indepent pixel,简称DIP）
  2. intial-scale, minimum-scale, maximum-scale，表示将可视窗口或者简单理解window.innerWidth，设为`DIP / scale`，例如当width设为640，而intial-scale设为2.0，那么`window.innerWidth === 320`，那么窗口内只能看到所有内容的一半。
  3. 关于刘海屏的适配，最开始由ios提出增加一个叫做viewport-fit的属性，一般可用contain 和 cover两个值，
  具体效果可以看下面的示意图:
    
    1. **contain**

    ![contain](css/images/viewport-fit-contain.png)
    
    2. **cover**

    ![cover](css/images/viewport-fit-contain.png)

    [图片来源](https://medium.com/@bobtung/%E9%9D%A2%E5%B0%8Diphone-x-web%E8%A8%AD%E8%A8%88%E5%B8%AB%E9%9C%80%E8%A6%81%E7%9F%A5%E9%81%93%E7%9A%84%E5%B9%BE%E5%80%8Bcss%E5%B1%AC%E6%80%A7-b7c03b314c6a)
