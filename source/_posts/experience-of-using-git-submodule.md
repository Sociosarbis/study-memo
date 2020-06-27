---
title: git submodule的使用经验
tags:
  - git
  - submodule
---
### 前言
上两周开始，我开始在实际项目中使用之前同事提到过的`git submodule`的代码管理方式。

最开始我引入这个命令的原因是前端的各Vue项目之间，目录结构和代码内容相似，甚至于有时候新开一个项目会直接复制旧项目的代码。一言而蔽之，那就是项目之间有着可共用的代码模块。

假如把其中的一些子目录抽出来作为一个独立仓库，主项目只进行引用，就可以避免这些可共用的代码不可靠地进行人工复制，代码分散管理更新的问题。

### 常用命令解释及易误解的地方

以下**常用命令**部分基本来自于[官方指南](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

克隆远程仓库作子模块
```shell
git submodule add <remote-repo-url> [local-path=.]
```
显示子模块的diff信息
```shell
git diff --cached --submodule
```
克隆（`git clone`）带有子模块的项目后，需要初始化并拉取子模块
```shell
git submodule init
git submodule update
# 上面两命令的组合，一般直接用组合命令
git submodule update --init
# 又或者加上 --recursive 拉取嵌套的子模块（子模块本身又有子模块）
git submodule update --init --recursive
# 或者在clone时加上 --recurse-submodules选项自动完成拉取
git clone --recurse-submodules <main-project-repo-url>
```
当需要更新子模块时，切换到子模块的目录，使用常规的拉取上游更新的命令`git fetch`和`git merge`（或直接`git pull`）
或直接使用`git submodule update --remote [submodule-path]`就不用切目录进行手动更新。

上面快捷命令默认拉取的是master分支，如果想默认拉取其他分支，则进行如下配置
```bash
 # -f <git-modules-config-path> 表示指定.gitmodules文件路径
 git config -f .gitmodules submodule.<submodule-name>.branch <branch-name>
```
进行下面的配置，可以让git status显示子模块的status
```bash
git config status.submodulesummary 1
```

当不想每次diff更新时都要添加submodule选项，可以进行如下配置
```bash
git config --global diff.submodule log
```
类似于`git clone`，`git pull`如果要同时拉取子模块，也需要添加相关的选项
```bash
git pull --recurse-submodules
# 或者分开进行
git pull
git submodule update --init --recursive
```
使用merge选项可以合并远程更新，如果不添加`--merge`，默认使用`--checkout`，直接检出commit。
```bash
# --remote 选项的作用是假如子模块有追踪远程的分支，那将会拉取该上游分支进行同步，否则会检出主模块当前commit对应的子模块的commit
 git submodule update --remote --merge
```
如果发生冲突，可以跟普通仓库一样，到对应的子模块目录处理冲突，然后提交。由于子模块有新的提交（commit），回到主模块目录输入`git status`也会提示需要`git add`子模块的目录。

当在主仓库推送更新时可以使用`recurse-submodules`选项，避免没有推送子模块更新的情况。**假如子模块更新没有推送到子模块的远程仓库，那么当其他成员，拉取主仓库时将会报错，提示不能从远程拉取对应的子模块的版本。**
```bash
# 这个只会提示你有子模块还没推送
git push --recurse-submodules=check
# or
git push --recurse-submodules=on-demand
```
#### 在实践中出现的疑问
Q1： `git submodule`跟直接`clone`子模块到子目录的区别在哪里。

A1：直接`clone`不能与主模块产生关联，而`git submodule`会在工程目录下添加`.gitsubmoules`文件，声明所有的子模块所在的目录及它们的远程仓库地址等相关信息。第二点，其实是理解`submodule`机制的关键，子模块不论因什么原因（未staged的change、untracked的文件、checkout到其他版本等）产生内容变化，在主模块目录输入`git status`都会显示子模块目录有更改。主模块在判断子模块是否有更改是与**主模块当前版本对应的子模块版本**进行比较。

主模块在`git add`文件时是不会添加子模块目录下的内容，而是直接`add`子模块目录。子模块目录以主模块的角度来看，是一个记录版本号的`.txt`文件，记录的版本号与子模块当前版本同步。

这一点可以在主模块拉取远程更新，子模块目录发生冲突的时候可以体现。显示的冲突会显示成类似下面的形式，下面的英文字符是commit的SHA:
```diff
<<< a/src/components (Current Change)
+++ abcdefghijklmnopqrst
>>> b/src/components (Incoming Change)
+++ ghijklmnopqrstuvwxyz
```

Q2：怎么把分支B的子目录变成子模块，假设分支A的该子目录已经是子模块了。

A2：切到分支B，然后checkout 分支A的`.gitmodules`文件（注意这里如果直接初始化(`git submodule update --init`)子模块是无效的，道理可参见上一个问题的解释，因为此时子模块没有指定一个版本）。切到分支B后，有两种方式完成这个任务：
1. 删除子目录的内容，通过 `git submodule add` 克隆远程仓库到指定子目录
2. `checkout`分支A的`.gitmodules`文件（注意这里如果直接初始化(`git submodule update --init`)子模块是无效的，道理可参见上一个问题的解释，因为此时子模块所在目录没有任何记录为子模块的历史，没有版本绑定）。然后checkout 分支A的对应子目录即可。

### 小提示
* submodule下有一个`foreach`的子命令挺实用的，它的机制类似于`cd`到每个子模块目录，然后执行一段shell脚本。

  * example：
  ```bash
  # 显示各个子模块的status
  git submodule foreach 'git status'
  ```
* 官方指南上记载了三个`git alias`的配置，可以使用缩写执行一些常用命令。
```bash
# ! 表示命令可以是普通的shell命令而不用是git 的子命令
# 在windows中需要把'!'"git diff ..." 改成 "! git diff ..."
git config alias.sdiff '!'"git diff && git submodule foreach 'git diff'"
git config alias.spush 'push --recurse-submodules=on-demand'
git config alias.supdate 'submodule update --remote --merge'
```

### 附记
最开始公司里提出用`submodule`并不是为了共用代码，而是为了在前后端代码并存的项目中，对前后端代码分别使用子模块管理，进行分隔，互不干涉。

对于共用代码的方案，git还有一个好像在某些版本不是内置的命令`subtree`，稍微了解了一下，好像`subtree`会把子模块的内的文件更改也记录到主模块中。个人觉得`submodule`的对于各模块的分割功能更好，而且是`git`内置的，算是标准功能吧。

虽然`submodule`的使用需要一点额外的学习成本，但只要了解了它的机制，用起来也能得心应手的。
