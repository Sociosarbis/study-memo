---
title: 像redux这样的状态管理库是用来做什么的
tags:
  - redux
  - store
  - react
  - performance
---
### 前言
在这的很长一段之前，我一直都没有理解到为什么大型项目会需要redux这样状态管理库。因为我以前一直在觉得，redux做的无非只是把祖先的state无需通过一层层parent to child的props传递提供便利（这个功能react的context就可以做到了）和让改变数据的动作更加清晰而已。加上redux那一堆麻烦的定义文件，所以造成一直以来都不太愿意把数据放到store里面去。但是我的认识在这周发生了转变。
### 正文
这个转变源自于我需要做一个在同一个父组件下跟随子组件B进行view更新的子组件A。不使用store的情况就是父组件得到子组件B的变化，然后通过props传给子组件A，让子组件进行更新。可是，问题出现在，父组件也有因为涉及不当的原因，其render函数里包含了许许多多的子组件（许许多多是一个抽象的数字）。假如通过props传给子组件A，那么必然触发父组件的render方法，那么就需要一个个地去diff其下的这些子组件。这无疑是会损耗大量的性能。那么怎么解决呢。

**一个直觉的类比，我们可以像直接控制DOM一样直接让子组件A更新**
具体的做法，可以是通过ref获取到子组件A的实例，直接通过子组件A.setState的方式更新。虽然这种方法简单高效，但是这在react文档中是不推荐的，因为他让组件的关系变得复杂且难以预测，用某个学到的词来概括（反模式的），其实我的感觉就是这样子不够一般化，因为需要修改组件内部（这个跟react不提倡使用extends的方法创建组件的理由可能是一致的），添加ref。正确的模式其实还是应该通过传递props来引起更新。但是就会出现上面说的性能问题。这时候就要redux(准确上来讲是react-redux)的出场了。

**connect组件**
connect组件是react-redux提供的一个wrapper，包裹我们设计的组件形成一个高阶组件。这个wrapper主要的工作是监听store的变化，当store变化时，触发onStateUpate方法，通过用户定义好的mapStateToProps和mapDispatchToProps的方法从store中提取需要的数据设置到wrapper的state上，并在render时与非从store推导的props进行merge作为最终的props传到我们设计的组件中(如上面的子组件A)

**另一个启示**
上面的（暂且叫做）精准更新的需要的一个原因是避免有大量子Element的父组件，进行重新渲染。注意到大量这个词，也就是说，我们也可以通过减少父组件下子Element的数量，来提高性能。一个立刻能想到的可行性方案是，当父组件render的vdom间，所依赖的数据项有明显分解时，例如有分别依赖state.mails和state.friends产生列表项的，这时我们可以封装这两个列表项为两个组件并作为pureComponent，这样例如我们更新mails的时候就可以不进入friends列表项的render和HTMLElement diff阶段了了。
