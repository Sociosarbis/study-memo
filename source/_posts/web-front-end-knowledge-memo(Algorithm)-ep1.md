---
title: web前端知识学习笔记-算法篇(1)
tags:
  - interview
  - algorithm
  - sorting
---
## 下面的内容为排序算法逻辑的摘要，主要目的是方便本人记忆
**1. 归并排序（merge sort）**
```javascript
sort(originalArray) {
     // 当array的规模小于等于1时结束分治
     if (originalArray.length <= 1) {
      return originalArray;
    }
    // 从中间分开左右两个子数组
     const leftArray = originalArray.slice(0, middleIndex);
     const rightArray = originalArray.slice(middleIndex, originalArray.length);
     
     const leftSortedArray = sort(leftArray);
     const rightSortedArray = sort(rightArray);

     // 每次从左右两个已排好序的数组选取出一个最小的元素，加入结果数组
     while (leftArray.length && rightArray.length) {
      if (leftArray[0] < rightArray[0]) {
        minimumElement = leftArray.shift();
      } else {
        minimumElement = rightArray.shift();
      }
      sortedArray.push(minimumElement);
    }
}
```
**2. 快速排序（quick sort）**
1. 非原地
```javascript
sort(array) {
     const pivotElement = array.shift();
     // 根据与基准的大小关系，把元素归入到左，中，右三个子数组
     while (array.length) {
          const currentElement = array.shift();
          if ((currentElement === pivotElement)) {
          centerArray.push(currentElement);
          } else if (currentElement < pivotElement)) {
          leftArray.push(currentElement);
          } else {
          rightArray.push(currentElement);
          }
     }

     // 左右两数组在其内部进行排序
     const leftArraySorted = sort(leftArray);
     const rightArraySorted = sort(rightArray);

     // 合并左中右三个子数组
     leftArraySorted.concat(centerArray, rightArraySorted);
}
```
2. 原地
```javascript
sort(array, inputLowIndex = 0, inputHighIndex = array.length - 1) {
     if (inputLowIndex < inputHighIndex) {
      let partitionIndex = inputLowIndex;
      const pivot = array[highIndex];
      // 把小于最右元素的元素与partitionIndex指向的元素交换位置
      for (let currentIndex = lowIndex; currentIndex < highIndex; currentIndex += 1) {
        if (array[currentIndex] < pivot) {
          swap(partitionIndex, currentIndex);
          partitionIndex += 1;
        }
      }
      swap(partitionIndex, highIndex);
      // 以partitionIndex作为分界点，分开左右范围进行排序
      sort(array, inputLowIndex, partitionIndex - 1);
      sort(array, partitionIndex + 1, inputHighIndex);
    }
}
```
**3. 堆排序**
```javascript
// 构建最小堆
// 每次取出堆顶元素，然后把堆中最后的元素放到堆顶，根据规则，重新建立最小堆
leftChildIndex(parentIndex) {
     return (2 * parentIndex) + 1;
}
rightChildIndex(parentIndex) {
     return (2 * parentIndex) + 2;
}
parentIndex(childIndex) {
     return Math.floor((childIndex - 1) / 2);
}

// 从最后一个元素开始确认父元素是否小于子元素
heapifyUp() {
     let currentIndex = heapContainer.length - 1
     while(hasParent(currentIndex) && heapContainer[parentIndex] > heapContainer[currentIndex]) {
          swap(heapContainer, currentIndex, parentIndex);
          currentIndex = parentIndex
     }
}

// 从第一个元素开始确认父元素是否小于子元素
heapifyDown() {
    let currentIndex = 0;
    let nextIndex = null;

    while (this.hasLeftChild(currentIndex)) {
      if (
        this.hasRightChild(currentIndex)
        && rightChild > leftChild)
      ) {
        nextIndex = getRightChildIndex(currentIndex);
      } else {
        nextIndex = getLeftChildIndex(currentIndex);
      }

      if (heapContainer[currentIndex] < heapContainer[nextIndex]) {
        break;
      }

      swap(heapContainer, currentIndex, nextIndex);
      currentIndex = nextIndex;
    }
}

add(item) {
     heapContainer.push(item)
     heapifyUp()
}

// 从最小堆中取出堆顶，就是poll这个操作
poll() {
     const item = heapContainer[0]
     heapContainer[0] = heapContainer.pop()
     heapifyDown()
     return item
}
```
***奇怪的是根据下面代码来源的资料，heap sort的空间复杂度是O(1)，可是上面的实现方式是需要创建两个数组的，***
***按上面的实现应该是O(n)才对。后面经过搜索，得知heap sort实际上是可以原地实现的。实现如下：***
```javascript
add() {
  for (let i = 1;i < arr.length;i++) {
    // 从i到0构建**最大堆**
    heapifyUp(i)
  }
}
poll() {
  for (let i = arr.length - 1;i >= 0;i++) {
    // 让i与0交换
    swap(i, 0)
    // 调整堆至i - 1处，交换以后的i排除在heapifyDown的操作范围内
    heapifyDown(i - 1)
  }
}
// 注意上面的是最大堆，因为这样取出的时候可以把堆顶的这个最大值与末尾的元素进行交换
// 最后结果能够从小到大排列
// 上面写的都是伪代码，力求把逻辑简洁地表述出来
```
[代码来源](https://github.com/trekhleb/javascript-algorithms)
