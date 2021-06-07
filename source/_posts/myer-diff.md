---
title: Myer's Diff algorithm
tags:
  - diff
  - algorithm
date: 2019-10-21 22:48:18
---
## 前言
本文主要参考自[Myers' Diff Algorithm(1)](http://simplygenius.net/Article/DiffTutorial1)（算法原理）和

[Myers' Diff Algorithm(2)](http://simplygenius.net/Article/DiffTutorial2)（优化后的算法）这两篇文章，

根据自己的理解对算法步骤进行说明。原论文（http://www.grantjenks.com/wiki/_media/ideas:diffalgorithmlcs.pdf）。
**在本文中出现的名词如：**
  * **snake**
  * **diagonal k（对角线k）**
  * **edit graph（编辑图）**
  * **furthest reaching point（最远到达点，实则为编辑图的横坐标）**
  * **V\[k\]（记录对角线k的最远到达点）**
  * **edit script（编辑路径）**
可在上述的参考文章中找到说明。
**算法的思想建基于:**
  1. 最短编辑距离的路径会包含一条有最远到达点的对角线
  2. 编辑路径D（D表示编辑长度）与对角线k的关系为![](https://latex.codecogs.com/gif.latex?k%20%5Cin%20%5B-D%2C-D%20&plus;%202%2C...%2CD%5D)
**注意编辑图的（0, 0）点不表示字符串A和B各自的第一个字符, 而是表示没有任何字符编辑的出发点**

### algorithm1
初步的算法**（在文章1中）**就是从0开始到最大D循环，从每个D中拿到对角线k的序列，进行INSERT（B向前一步）或DELETE（A向前一步）的编辑。

看看后面的字符是否相同，如果相同则A和B的各向前一步；

如果不同则把当前的横坐标记回到V[k]中。如当前坐标到达边界，则当前的D就为最短编辑路径。

### algorithm2
2. 在文章2中介绍了1中的算法的优化，它包含了分治的思想。
概括地说是
  1. 记A B长度的差delta为N - M
  2. 从起始点正向执行1中的算法和从终点反向执行，它们的V[k]分别记为VForward[k]和VBackward[k]
  3. 当VForward[k] > VBackward[k]时停止迭代，同时需要满足当delta为奇数时，![](https://latex.codecogs.com/gif.latex?D_%7Bbackward%7D%20%3D%20D_%7Bforward%7D%20-%201),迭代要在Forward处结束；
  当delta为偶数时![](https://latex.codecogs.com/gif.latex?D_%7Bbackward%7D%20%3D%20D_%7Bforward%7D%20)，迭代要在Backward时结束。
  4. 结束3中的最后一次迭代的路径称为middle snake，在原论文中证明middle snake为最短编辑路径的子路径
  5. 根据middle snake（左上角和上一次的出发点）和（右下角和上一次的终点）把编辑图分成左上和右下两个子图，这两个子问题。

  再重复执行这个这个算法，直到子问题的D不大于1，或者任意子字符串的长度等于0为止。

3. 下面是应用算法2以求出从A到B字符串编辑操作的代码。
```javascript
// 操作类型
const RETAIN = 'retain' // 保留A和B的字符
const INSERT = 'insert' // 插入B字符，在图中表示为垂直移动
const DELETE = 'delete' // 删除A字符，在途中表示为水平移动

function calcMiddleSnake(A, a0, N, B, b0, M, VForward, VBackward) {
  const delta = N - M
  const maxD = Math.floor((N + M + 1) / 2)
  //初始化V序列
  VForward[1] = 0
  //初始的时候从delta - 1的对角线开始
  VBackward[N - M - 1] = N
  const isOdd = Boolean(delta & 1)
  for (let d = 0; d <= maxD; d++) {
    for (let k = -d; k <= d; k += 2) {
      // k为-d时必为向下，k为d时必为向右，其余情况选择V序列较大的方向，这里的方向表示从Kprev到K
      const down = k === -d || (k !== d && VForward[k - 1] < VForward[k + 1])
      const kPrev = down ? k + 1 : k - 1
      const startX = VForward[kPrev]
      const startY = startX - kPrev
      const midX = down ? startX : startX + 1
      const midY = midX - k
      let endX = midX
      let endY = midY
      while (endX < N && endY < M && A[a0 + endX] === B[b0 + endY]) {
        endX++
        endY++
      }
      VForward[k] = endX
      // 当delta为奇数时，运行到这里才有反向d = 正向d - 1，才需要返回middleSnake，
      // k < delta - (d - 1) || k > delta + (d - 1)是保证正向k没有超出上一轮反向k的范围
      if (!isOdd || k < delta - (d - 1) || k > delta + (d - 1)) continue
      if (VForward[k] < VBackward[k]) continue
      return [2 * d - 1, down, startX, startY, midX, midY, endX, endY]
    }
    // 正向是以k = 0为中心，反向是以k = delta为中心
    for (let k = -d + delta; k <= d + delta; k += 2) {
      // 方向选择逻辑与正向相近
      const up = k === d + delta || (k !== -d + delta && VBackward[k - 1] < VBackward[k + 1])
      const kPrev = up ? k - 1 : k + 1
      const startX = VBackward[kPrev]
      const startY = startX - kPrev
      const midX = up ? startX : startX - 1
      const midY = midX - k
      let endX = midX
      let endY = midY
      while (endX > 0 && endY > 0 && A[a0 + endX - 1] === B[b0 + endY - 1]) {
        endX--
        endY--
      }
      VBackward[k] = endX
      // 当delta为偶数时，运行到这里才有反向d = 正向，才需要返回middleSnake，
      // k < -d || k > d是保证反向k没有超出这一轮正向k的范围
      if (isOdd || k < -d || k > d) continue
      if (VBackward[k] > VForward[k]) continue
      return [2 * d, up, endX, endY, midX, midY, startX, startY]
    }
  }
}

function innerDiff(A, a0, N, B, b0, M, VForward, VBackward) {
  let newOps = []
  if (M === 0 && N > 0) newOps = [[DELETE, N]]
  if (N === 0 && M > 0) newOps = [[INSERT, M]]
  if (M === 0 || N === 0) return newOps
  const middleSnake = calcMiddleSnake(A, a0, N, B, b0, M, VForward, VBackward)
  const startX = middleSnake[2]
  const startY = middleSnake[3]
  const midX = middleSnake[4]
  const midY = middleSnake[5]
  const endX = middleSnake[6]
  const endY = middleSnake[7]
  const D = middleSnake[0]
  const isVertical = middleSnake[1]
  const editOp = isVertical ? INSERT : DELETE
  const middleEditOps = []
  //确保点坐标的位置符合x:[0, N],y:[0, M]，才去添加middle snake的edit script
  if (midY <= M && startX >= 0 && midX <= N && startY >= 0) {
    let editLength1 = isVertical ? midY - startY : midX - startX
    if (editLength1) middleEditOps.push([(midY - startY === midX - startX) ? RETAIN : editOp, editLength1])
  }
  if (midY >= 0 && endX <= N && midX >= 0 && endY <= M) {
    let editLength2 = isVertical ? endY - midY : endX - midX
    if (editLength2) middleEditOps.push([(endY - midY === endX - midX) ? RETAIN : editOp, editLength2])
  }
  if (D > 1) {
    // diff左上角的编辑图
    newOps = innerDiff(A, a0, startX, B, b0, startY, VForward, VBackward)
    newOps.push(...middleEditOps)
    // diff右下角角的编辑图
    newOps.push(...innerDiff(A, a0 + endX, N - endX, B, b0 + endY, M - endY, VForward, VBackward))
  }
  else if (D === 0) newOps.push(...middleEditOps)
  else {
    if (startX) newOps.push([RETAIN, startX])
    newOps.push(...middleEditOps)
  }
  return newOps
}

function diff(A, B) {
  return innerDiff(A, 0, A.length, B, 0, B.length, [], [])
}

// test
diff('react is the best framework', 'preact is the best library')
/*
output:
0: ["insert", 1] insert 'p'
1: ["retain", 18] retain 'react is the best '
2: ["insert", 1] insert 'l'
3: ["insert", 1] insert 'i'
4: ["insert", 1] insert 'b'
5: ["delete", 1] delete 'f'
6: ["retain", 2] retain 'ra'
7: ["delete", 1] delete 'm'
8: ["delete", 2] delete 'ew'
9: ["delete", 1] delete 'o'
10: ["retain", 1] retain 'r'
11: ["insert", 1] insert 'y'
12: ["delete", 1] delete 'k'
*/
```