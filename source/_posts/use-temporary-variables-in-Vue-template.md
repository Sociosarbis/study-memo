---
title: 在Vue的template里面使用临时变量
tags:
  - vue
  - template
  - temporary variable
date: 2019-04-01 01:36:41
---

**前言**
实际上很久以前就发现了这样的问题了，在 vue 的 template 中不能使用临时变量，而使用 render 函数就不存在这样的问题了。这周五因为在重构项目里某个方法，而在 UI 方面使用的是 vue，里面就有需要使用临时变量的情况。
某个部分的 template 大概是这样的

```html
<div v-if="hasNextParams"><div v-for="getNextParams"></div></div>
```

他用到的两个方法其实逻辑是差不多的，实际上可以都用 getNextParams 的结果作为 v-if 的判断。但问题是由于需要在两个地方需要引用到这个临时的结果，导致没修改前需要重复调用一个方法，正常来说，我们应该只做一次运算，缓存这个结果就好了。于是，我下班后就查了一下，在 stackOverflow 里找到了 scope-slot 的方案。（其实这个假如是熟悉 vue 的同学应该一下就想出来了，惭愧）
这个方案结合我自己的实际情况，修改后做了一个这样的组件，代码如下：

```html
<template>
  <div><slot v-bind="passedProps" /></div>
</template>
<script>
  export default {
    name: 'Pass',
    props: {
      passedProps: Object,
      default() {
        return {}
      }
    }
  }
</script>
<!--组件调用-->
<template>
  <Pass style="color:#c00;" :passedProps="{params: [1, 2, 3]}">
    <!--这里的slot-scope拿到的是上面bind到slot上的值，这里还用了解构取到里面的params参数-->
    <template slot-scope="{params}">
      <div v-if="params.length >= 0"><div>{{ params }}</div></div>
    </template>
  </Pass>
</template>
```
**后记**
在我实践过程中发现实际上```<template><div/></template>```组件跟React里面```{[<div/>]}```代表的意思是一样的，他返回的是一个数组，实际他不是一个根，由于是一个数组，会报错跟你说需要提供一个单根而不能是multi-root，所以也就能理解为什么Vue文件里的template下不能直接加template标签作为他的根了。

