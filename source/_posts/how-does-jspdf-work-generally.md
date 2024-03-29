---
title: jspdf大概的工作原理
tags:
  - pdf
  - ttf
  - glyph
  - html2canvas
date: 2022-02-23 22:24:51
---
## 前言
因为在自己的简历上写了用过`jspdf`来生成`pdf`格式的纸质试卷，所以前两天面试的时候就被问到了是否对其有了解。

当时确实很无助呀，因为对于这类文件规范编码的库，是不太感兴趣的，因为无非就是根据文档所约定的方式进行编解码，它的内容还是挺无趣的。

但既然会在面试中被问到，同时也在这次面试中明白了提升技术深度的一个方式就是要对用到的开源库的原理也应有一定的了解，所以就写下探索的过程吧。

## 正文

### 谈谈`PDF`格式
在没看`spec`前，我一直以为`pdf`大概跟`xlsx`那样是`xml`加`gzip`的二进制文件。

但在开发者工具的`network`里看到，请求返回的结果竟然是一个**带有一点二进制的纯文本文件**。

先说说文件中常见的语法：
1. **结构**：由`<< ... >>`所包裹。
      ```
      <<
      /Type /XObject
      /Subtype /Image
      /Width 213
      /Height 256
      /BitsPerComponent 8
      /ColorSpace /DeviceRGB
      /Length 11 0 R
      /Filter /DCTDecode
      >>
      ```
      像上面这个用`YAML`表示就是
      ```yaml
      Type: XObject
      Subtype: Image
      Width: 213
      ...
      Length: '11 0 R'
      ...
      ```
      `key`和`value`用空格分开，如果是嵌套的结构，那`value`那里可以用`<< ... >>`包裹

2. **数组**：用`[]`包裹，空格隔开各个元素，元素也可以是一个数组或者结构
    ```
    <<
    /MediaBox [0 0 595 842]
    >>
    ```

3. `obj`**声明**：`index`和`generation`都是`number`，`index`表示`obj`的序号（**唯一**），`generation`一般是版本，通常为`0`。

    下面`...`省略的部分可以为任何数据类型，结构，数组，数字等等，所以有点像是变量声明。

    ```
    index generation obj
    ...
    endobj
    ```

4. `obj`**引用**：在结构的例子中，可以看到这串（`11 0 R`）字符，其实前面两个数字就代表了`obj`声明的两个数字，最后的字母`R`则是`reference`的意思。


5. **stream**：在`pdf`中是为`content stream`，用来表示`pdf`实际渲染的数据（如**图片数据**）或者生成内容的指令（**普通或二进制文本**），放在`obj`声明中，所以stream存在于`obj`声明中时，如果其上方有结构，那该结构可看作是`stream`的属性定义。
    ```
    stream
    ...
    endstream
    ```

### 插入图片（`jspdf.addImage`）
1. 需先定义一个图片`obj`，如：

        ```
        19 0 obj
        <<
        /Type /XObject
        /Subtype /Image
        /Width 184
        /Height 60
        /ColorSpace /DeviceRGB
        /BitsPerComponent 8
        /DecodeParms <</Colors 3 /BitsPerComponent 8 /Columns 184>>
        /SMask 20 0 R
        /Length 33120
        >>
        stream
        ...
        endstream
        endobj
        ```
2. 把图片`obj`注册到资源`obj`上，如下面的`I0`：

        ```
        2 0 obj
        <<
        /ProcSet [/PDF /Text /ImageB /ImageC /ImageI]
        /Font <<
        /F1 5 0 R
        /F2 6 0 R
        /F3 7 0 R
        ...
        >>
        /XObject <<
        /I0 19 0 R
        >>
        >>
        endobj
        ```
3. 资源`obj`会被`page obj`的`Resources`属性引用，而`Contents`属性，这里是`4 0 obj`则是`page`实际要渲染的内容了：
        
        ```
        3 0 obj
        <</Type /Page
        /Parent 1 0 R
        /Resources 2 0 R
        /MediaBox [0 0 793.3333333333332575 1122.6666666666665151]
        /Contents 4 0 R
        >>
        ...
        endobj
        ```

4. 当`page`有对应的图片资源后，就可以在绘图操作中引用，`q`对应`context.save`，`Q`对应`context.restore`，`cm`是`current matrix`表示位置大小变换，`Do`则是展示图片的操作：
    ```
    4 0 obj
    ...
    stream
    ...
    q
    245.3333333333333144 0 0 80. 274. 1042.6666666666665151 cm
    /I0 Do
    Q
    endstream
    endobj
    ```

### 插入文字
插入文字首先需要添加字体，如果是英文字符，则无需添加额外的字体，因为`pdf`本身已经内置一些标准字体，但如果是中文字符，则需要通过`addFont`来添加字体资源，性质跟图片资源是一致的，同样是在`Resources`注册和`Contents`引用。

#### 添加文字的操作
`BT`: begin text

`EF`: end text

`Td`: 文字的位置偏移，相对于当前行

`Tj`: 显示文字

`Tf`: 文字大小

`TL`: 行高

`Tj`左边的操作数为`hex`格式的字符在字体文件中的序号，如果不是自定义字体，则是实际的字符如`(hello) Tj`

```
BT
/F15 21 Tf
24.1499999999999986 TL
0. 0. 0. rg
322. 990.9333292643227651 Td
<036b> Tj
ET
```

字符到`unicode`的映射：如下就表示序号为3的字符对应的`unicode`为
`0x0020`，也就是空格。`beginbfchar`左边的数字，表示映射的数量。
`begincodespacerange`表示映射的序号范围。
```
1 begincodespacerange
<0000><ffff>
endcodespacerange
19 beginbfchar
<0003><0020>
...
endbfchar
```

### 字体文件过大
虽然`jspdf`支持添加字体，但字体文件实在太大了，在浏览器中生成的`pdf`的时候再去加载完整的字体文件不太现实。

实际上字体文件可以动态生成，只保留有限字符的字形（`glyph`）数据来缩小字体文件和生成的`pdf`的大小。

动态生成的方案：
1. 客户端发送所需的文字请求服务器即时生成
2. 浏览器在闲时缓存完整的字体文件，再用`fonteditor-core`库去筛出所需的字形

在实际使用自定义字体时，发现`pdf`是不能像`html`那样自行切换`font-weight`和`font-style`，而是需要分别提供各个变形的字体。

#### 生产中的解决办法
直接把`html`转成图片，这样就不用考虑字体的问题了，但问题是`pdf`的体积会偏大，而且会缺失文字的信息（**因为是图片**）

**误解**：一开始我是看到`jspdf`有`html`这个方法，来把`html`转成`pdf`，粗看源码发现它其实用的是`html2canvas`这个库，于是以为它是先把`html`转成图片后再添加到`pdf`上的，所以我就没去使用该方法，而是手动使用`html2canvas`来转换成图片。

现在重新看源码后，发现`jspdf`是在`context2d`模块中模拟了`canvas`的`api`，所以它能够接入`html2canvas`，把绘制转换成相应的`pdf`操作。


## 结语
以上便是我对`pdf`和`jspdf`的大概认识，其实关于`pdf`和字体文件（`ttf`）还有很多问题没有了解，例如`ttf`里面包含的各个`table`，将来再去把这部分的知识补上b吧。