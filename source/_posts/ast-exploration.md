---
title: 探索抽象语法树
tags:
  - AST
date: 2018-10-20 23:52:14
---

**源起:**
前段时间通过一篇关于开发者他介绍自己开发的 web 应用的文章知道了这名开发者。觉得他很厉害，要向他学习。所以呢，就学习一下他之前做过的项目。虽然是想认真研究完的，一来是代码没有什么注释，二来我认真看过的部分某些其实可参考意义不是很大。所以这个计划的执行就暂停了。不过呢，在其中我也找到了一个我想了解的方向，就是 AST（抽象语法树），这个其实会挺有用的。
原因我暂时想到的有两点:
一、通过解析代码，能够拿到代码结构化的信息，这样可以应用于一些代码自动化生成，解析模块依赖等（这种可以自动化的东西就是我辈所向往的）
二、单纯自己通过正则去实现这样的解析还是一个比较麻烦的工程，暂时非自己能力所及。
**实践:**
JS 的 AST 的解析主要会用到 Babel 这个库。其中需要了解到的主要有这三个个包@babel/parser(babylon)、@babel/traverse、@babel/type。
下面以官方的一个插件说明 AST 中的一些概念和使用流程:

```javascript
/* 以下为babel-plugin-transform-remove-console的部分源码
    插件export的是一个接收当前babel对象的函数，这里他取这个对象的types属性，这个types属性出自于@babel/types，
    在这里用于创建AST节点替换原来的节点。
    函数返回一个对象，对象比较重要的属性是visitor。用来定义当遍历访问到某类节点时，需要进行的用户自定义的操作。
    节点的类型可以很简单地在AST Explorer中书写代码，通过显示的解析后的AST树中获知。
*/
module.exports = function({ types: t }) {
  return {
    name: "transform-remove-console",
    visitor: {
      // CallExpression表示函数调用，这些vistor的函数接收两个参数第一个是NodePath的对象
      // 另一个是用于缓存遍历数据的参数state
      // 便于用户在访问节点时存储自己需要的信息
      CallExpression(path, state) {
        const callee = path.get("callee");
        // NodePath通过get方法，获得对应的子Path，注意返回的也是一个NodePath的对象，并非是节点本身
        // Node可以通过NodePath.node获取，NodePath除了存储当前的Node以外,还保存节点的层级结构
        // 如通过Path.getSibling(index) 获取nth的当前层级的NodePath;
        // path.parentPath 获父NodePath
        // 另外所有替换删除的操作都是在NodePath上进行

        // NodePath有一系列is开头的方法，用于确认Path是否为某种类型
        if (!callee.isMemberExpression()) return;

        if (isIncludedConsole(callee, state.opts.exclude)) {
          // console.log()
          if (path.parentPath.isExpressionStatement()) {
            path.remove(); // 删除Path
          } else {
            path.replaceWith(createVoid0());
            // 用一个新的NodePath代替原来的NodePath
            // NodePath一般用上面的types参数以types.UnaryExpression等
            // types后接NodePath type的构造方法创建
            // 如这里的createVoid0就是以types.UnaryExpression('void', [0])构造的
          }
        } else if (isIncludedConsoleBind(callee, state.opts.exclude)) {
          // console.log.bind()
          path.replaceWith(createNoop());
        }
      },
      MemberExpression: {
        // 访问节点有两个阶段一个是enter、一个exit，默认是enter
        // 访问结束发生该节点下的子节点遍历完返回时
        exit(path, state) {
          if (
            isIncludedConsole(path, state.opts.exclude) &&
            !path.parentPath.isMemberExpression()
          ) {
            if (
              path.parentPath.isAssignmentExpression() &&
              path.parentKey === "left"
            ) {
              path.parentPath.get("right").replaceWith(createNoop());
            } else {
              path.replaceWith(createNoop());
            }
          }
        }
      }
    }
  };
  // 值得一提的是在这个插件加了一个验证console是否为全局的操作
    function isGlobalConsoleId(id) {
    const name = "console";
    // 首先通过scope.getBinding确认console是否是为用户定义的，其次再验证在全局作用域中是否有console定义
    return (
      id.isIdentifier({ name }) &&
      !id.scope.getBinding(name) &&
      id.scope.hasGlobal(name)
    );
  }
  //ps: 一个小的发现在visitor函数中this等于参数state
```

**结语：**
我这里写的只是 AST 的冰山一粒，上述内容其实在 babel handbook 上都有，把自己心得体会记录下来，一是要是以后忘记了，看自己的文字更加容易唤醒自己的记忆，二是为自己的学习留下痕迹，再者有新的发现再到新文章中再叙吧。
