---
title: Leetcode 84 Largest Rectangle in Histogram分析
tags:
  - leetcode
  - algorithm
  - stack
date: 2019-11-10 23:18:39
---
[题目链接](https://leetcode-cn.com/problems/largest-rectangle-in-histogram/)

根据题解得到的思路：
1. 矩形大小等于区间内最低柱形高度乘以区间的大小
2. 最大矩形等于**以各柱形为最低高度时**围绕它形成的最大区间的矩形大小的最大值
3. 每个柱形形成的区间的**左右边界**为**小于它高度且最靠近**的矩形或者**柱形数组的边界**

**为了求出这些区间，题解中使用了一个栈结构**

**栈具有如下性质**
1. 每个柱形的index都会压入栈中
2. 柱形A的index入栈前先把栈中高度小于A的index出栈，保证栈中index所指向的高度**保持依次增大**的性质。

**换句话说栈中的上一个元素其实是当前元素的左界（因为是依次增大），**
**当元素出栈时（大于新加入的元素），就是右界确定的时候，左右界确定后，区间矩形大小就能求出了**

**参考解法**
```c++
class Solution {
public:
    int largestRectangleArea(vector<int>& heights) {
        vector<int> stack = { -1 };
        int heightsLength = heights.size();
        int maxArea = 0;
        int backIndex = -1;
        for (int i = 0;i < heightsLength;i++)
        {
          backIndex = stack.back();
          while(backIndex != -1 && heights[backIndex] > heights[i])
          {
            maxArea = max((i - stack[stack.size() - 2] - 1) * heights[backIndex], maxArea);
            stack.pop_back();
            backIndex = stack.back();
          }
          stack.push_back(i);
        }
        backIndex = stack.back();
        while(backIndex != -1)
        {
          maxArea = max(maxArea, (heightsLength - stack[stack.size() - 2] - 1) * heights[backIndex]);
          stack.pop_back();
          backIndex = stack.back();
        }
        return maxArea;
    }
};
```