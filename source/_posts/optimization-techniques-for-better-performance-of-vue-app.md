---
title: 提高Vue应用性能的技巧
tags:
  - Vue
  - performance
---
## 前言
这星期发现开发的某个页面的复选框的点击反馈比较的慢，为了给用户提供更好交互体验的信念，同时也为了验证积累的Vue框架的知识，决定改善这个部分的代码写法。而这个页面最开始是其他同事开发的，可能团队中一直都没有意识到这个问题，所以趁此机会分享这次调优的过程。

## 案例分析
原案例我把它稍简化以后放到codepen进行展示。

<p class="codepen" data-height="265" data-theme-id="light" data-default-tab="js,result" data-user="sociosarbis" data-slug-hash="ExVyppE" style="height: 265px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid; margin: 1em 0; padding: 1em;" data-pen-title="speed up the interaction of a view with many checkboxes">
  <span>See the Pen <a href="https://codepen.io/sociosarbis/pen/ExVyppE">
  speed up the interaction of a view with many checkboxes</a> by Sociosarbis (<a href="https://codepen.io/sociosarbis">@sociosarbis</a>)
  on <a href="https://codepen.io">CodePen</a>.</span>
</p>
<script async src="https://static.codepen.io/assets/embed/ei.js"></script>

**经过一些实验以后，有以下的发现**
* 性能的瓶颈其实大部分都来自于DOM操作和渲染
* 依据视图依赖的数据，拆分独立组件，可以减少diff次数（这点其实之前已经有了解）

**这次调优技巧涉及到3点**
1. 把复选框的每个组做成一个独立的组件。

vue更新的大致机制是：
1. 在运行时或者编译时最终都会把template，转换成组件的render函数
2. 执行render函数时返回虚拟DOM，在这过程中会收集render函数中的数据依赖（收集原理可参考[通过简化版的Observer的实现来说明vue的watch的工作原理](https://sociosarbis.github.io/study-memo/2018/11/11/simple-implementation-of-observer-to-illustrate-how-vue-watcher-works/)), 当依赖数据改变时，再次执行render函数得到新的虚拟DOM，与旧虚拟DOM进行diff更新。
3. 假如render函数中出现的自定义组件的props不发生改变，是不会去执行自定义组件的render函数，意思是不会diff更深一层，这样就能减少diff的次数。

示例：

```js
Vue.extend({
  template: `<el-tabs v-model="activeTab">
  <el-tab-pane class="tab__pane" v-for="tab in tabs" :key="tab.name" :name="tab.name" :label="tab.name + '(' + tabCount(tab) +')'">
    ` + /*<div v-for="group in tab.groups" :key="group.name">
    <div><el-checkbox :value="group.selectedMembers.length === group.members.length" @input="group.selectedMembers = $event ? group.members : []" @click.native="startInteraction"/>{{group.name + '(' + group.selectedMembers.length + ')'}}</div>
      <el-checkbox-group v-model="group.selectedMembers" @click.native="startInteraction">
        <el-checkbox v-for="(member, index) in group.members" :label="member" :key="index" />
      </el-checkbox-group>
    </div> */ + `
  </el-tab-pane>
</el-tabs>`,
  // ...
});
```
把注释掉的部分抽出改成`select-group`组件
```js
Vue.component("select-group", {
  template: `<div><div><el-checkbox :value="group.selectedMembers.length === group.members.length" @input="group.selectedMembers = $event ? group.members : []" @click.native="$emit('click')"/>{{group.name + '(' + group.selectedMembers.length + ')'}}</div>
      <el-checkbox-group v-model="group.selectedMembers" @click.native="$emit('click')">
        <el-checkbox v-for="(member, index) in group.members" :label="member" :key="index" />
      </el-checkbox-group></div>`,
  props: {
    group: Object
  }
});
```

2. 取消复选框的过渡动画

* 取消动画的原因是在全选/取消全选的时候，大量的复选框（大量的DOM对象）会影响渲染速度，过渡动画会变慢，取消以后，视觉上的反馈速度会快许多。
```css
.el-checkbox__input.is-checked .el-checkbox__inner, .el-checkbox__input.is-indeterminate .el-checkbox__inner {
  transition: none !important;
}

.el-checkbox__inner::after {
  transition: none !important;
}
```
3. 对tab使用v-if和keep-alive
* v-if控制不生成无需显示的虚拟DOM，这样在点击全局全选/取消全选（会影响所有tab的数据）的时候，不用去做其他tab的diff。
* 使用keep-alive的原因是使用v-if以后，切换tab会有较大的延迟（原因是有大量的DOM的创建），所以使用keep-alive缓存DOM，除了第一次由于无缓存而比较迟缓外，后续的切换速度还是可以的。
* 这个方案不太具通用性，但Vue没有`shouldComponentUpdate`的更新控制，不过也算是个可考虑的技巧。

## 写在最后
前端框架虽然减少了开发者的工作量，但也有执行效率不那么高效的一面（需要遍历diff而不是直接命令式的指定某个DOM更新），为了给用户更好的用户体验，成为更好的开发者，需要在调优上多花点心思。

附：
* 其实DOM的渲染也是影响性能的一个重要因素。这个论点的根据时，当我把所有tab的`display`设为`none`后，发现切换的速度会有很大的提升。