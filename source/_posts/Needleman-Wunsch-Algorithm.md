---
title: 学习Needleman-Wunsch-algorithm
tags:
  - Needleman-Wunsch
  - algorithm
date: 2018-12-22 20:52:56
---

**_前言_**
最近一段时间，有位同事被分配开发一个基于对象树的类 git 的功能。其中需要做对象列表的插入删除的 diff 实现，在她分享中她提到是通过改编过的 Needleman-Wunsch 算法实现的，能够返回插入或删除的具体对象。感觉这个算法是挺有用的，于是乎这个周末就找资料了解了一下。
**_具体算法说明_**
一开始这个算法是为了比较两个蛋白质的氨基酸序列的相似性而提出的。后来也推广应用到文本比对。
具体来讲，设我们有两个字符串。

```javascript
const a = 'nowyouseeme'
const b = 'cuzletitbe'
const lenA = a.length
const lenB = b.length
```

1.首先需要构造一个(lenA + 1) \* (lenB + 1)大小的矩阵

```javascript
const matrix = Array.from({
  length: lenB + 1
}).map(() => new Array(lenA + 1).fill(0))
```

2.给第一行和第一列设置初始值

```javascript
let i
for (i = 1; i < lenB + 1; i++) {
  matrix[i][0] = -1 * i
}
let j
for (j = 1; j < lenA + 1; j++) {
  matrix[0][j] = -1 * j
}
```

**一开始我就有一个疑问，为什么初始值是-1 \* 序号呢？-1 是什么含义？**
其实这里的-1 表示的是当前格的分数是从左一格或者从上一格的求出的时候的得分。
然后这里就要说明一下这个矩阵的格子除了初始的行列以外其余格的数值是怎么算出来的了。
这些格子的取是左上格，上格，左格这三个前面的格子的值分别加上当前格得分后的最大值。
当前格的得分定义

```javascript
let match = 1 // 当前行对应的字符等于当前列对应的字符时的得分，这个值只能与左上格数值相加
let dismatch = -3 // 当前行对应的字符不等于当前列对应的字符时的得分， 这个值只能与左上格数值相加
let gap = -1 // 不管相等还是不相等，默认都加在上格或者左格进行最大值判定
/*
例如比较上面两个字符串的第一个字符
|   |   | n |
-------------
|   | 0 |-1 |
-------------
| c |-1 |-1 |
因为第一个字符不相等所以 
matrix[1][1] = Math.max(matrix[0][0] - 3, matrix[0][1] -1, matrix[1][0] -1) // 1
*/
```

计算格子值代码

```javascript
for (i = 1; i < lenB + 1; i++) {
  for (j = 1; j < lenA + 1; j++) {
    const scoreFromTopLeft = a[j - 1] === b[i - 1] ? match : dismatch
    matrix[i][j] = Math.max(
      matrix[i - 1][j - 1] + scoreFromTopLeft,
      matrix[i - 1][j] + gap,
      matrix[i][j - 1] - gap
    )
    //下面这个链接的会把这个最大值是取自哪个这个信息给存到traceback_type_status这个二维数组里面
    //方便回溯的时候知道上一步来自哪个方向,当然也可以不存，在回溯的时候再判断
    // const intermediate_scores = [matrix[i - 1][j - 1] + scoreFromTopLeft, matrix[i - 1][j] + gap,matrix[i][j - 1] - gap]
    // const tracebackTypeStatus = intermediate_scores.map((e, i) => e === score);
  }
}
```

得分计算有人做了一个动态计算表格生动展示了其机制，地址:[needle-wunsch]https://blievrouw.github.io/needleman-wunsch/

**回溯的方法：** 
1.像上面提到的，根据当前格子的值是取自哪里来确定回溯方向的
2.上面这个在线 demo 他取目标字符串为列， 原字符串为行，删除添加字符操作的记录方法为：
**如果是添加（值取自左格）**，给原字符串的 alignment 添加'-'字符，目标字符串的 alignment 添加目标字符串的对应字符
**如果是删除（值取自上格）**，给目标字符串的 alignment 添加'-'字符，原字符串的 alignment 添加原字符串的对应字符
**如果是一致或者不一致（值取自左上格）**，则同时添加对应字符 3.重复 1，2 的步骤没有可回溯的方向
但是上面这个方法，稍稍一想可能会注意到，假如是 dismatch（不一致）的情况，那么按照上面的方法就不会添加'-'字符表示操作了，
当然也可以在这种情况下默认是添加新字符，删除旧字符两个操作，但是这样就比较生硬。所以为了排除当 dismatch 时，会取左上格的情况，
**我们需要让 dismatch 的 penalty 小于 gap_penalty \* 2，这样最大值就不会取自左上了。**

最后要提一点的是demo里的回溯代码，他没有用递归实现，而是**把下一步要进入的路径，保存到上一条路径的next里**，当上一条路径走完，
会把next变成current，因为这个我不会太会用这种方法，同时这种方法效率也会比较高，所以觉得比较有趣就提一下吧。
```javascript
while (current) {
  pos = current.pos
  alignment = current.alignment
  // Get children alignments
  children = this.alignmentChildren(current.pos)
  // Store completed alignments
  if (!children.length) {
    final_alignments.push(alignment)
  }
  current = current.next
  for (t = 0, len = children.length; t < len; t++) {
    child = children[t]
    child.alignment = {
      seq1: alignment.seq1.concat(
        child.tracebackType === 0 ? '-' : this.seq1[pos[0] - 1]
      ), // -1 refers to offset between  scoring matrix and the sequence
      seq2: alignment.seq2.concat(
        child.tracebackType === 2 ? '-' : this.seq2[pos[1] - 1]
      )
    }
    // Move down a layer
    child.next = current
    current = child
  }
}
```
