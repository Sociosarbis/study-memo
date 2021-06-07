---
title: 使用rust & webAssembly开发导出excel文件功能后的感想
tags:
  - rust
  - webAssembly
  - excel
date: 2021-04-05 21:38:14
---
## 前言

已经超过半年没写过文章了，原因除了肯定会有的懒以外，主要还是因为，
其一，根据过去的经验，写一篇文章要花比较长的时间，要先透彻地明白自己所讲的问题；
其二，部分学习和总结是已经写成代码了，再写成文字似乎就重复了；
其三，只想写一些自觉有新意的内容。

说回这次的要实现的功能。在以前公司做导出excel文件是放在后端做的，所以当数据量和使用人数过多的时候就出现了接口超时的问题。为了减轻后端的压力，所以这次打算后端提供必要的数据，excel文件由前端生成。

说到文件生成，我第一时间就想到了`web worker`和`webAssembly`的使用，加上之前学了下`rust`，正好可以学以致用。

这个功能做完以后，粗略地测试了下，导出一个`263KB`文件，`webAssembly`和`js`的实现的导出速度。
webAssembly|js
-----------|---
62ms| 52ms

所以从效果上来说，`webAssembly`实现完全是白做了。查了些资料，我觉得原因主要是：
1. 生成Excel的计算量不大，数据的传送反而占了比较多的时间
2. 数据要传给`webAssembly`，需要先转成`JSON`，再`encode`为`Uint8Array`，这个是与`JS`的实现相比额外的消耗。

### 项目介绍
[项目地址](https://github.com/Sociosarbis/json2excel)

这个项目是一个fork项目，除去原有的核心的文件构建逻辑，我做的改动主要有：
1. 对`verticalAlign`的支持
2. 支持数字类型的单元格数据
3. 添加作为回退方案的`js`实现

* 改动1其实只是按照原来的做法，增加对`verticalAlign`的处理。

* 改动2的问题是对既可能是字符串又可能是数字的数值处理，处理的方法是改成枚举类型，然后还要增加两行宏`#[derive(Deserialize)]`，`#[serde(untagged)]`,前者是支持`serde`库进行反序列化，后者是让`serde`自动判断反序列转化的类型。详细可以在这里[查阅](https://serde.rs/enum-representations.html)
```rust
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Value {
    Number(f64),
    String(String)
}
```

* 改动3是因为webAssembly只有在17年后的浏览器有支持，所以需要`js`方案作兼容，此方案用到了`exceljs`这个库，由于是运行在`worker`环境，不可通过`script`标签加载，另一方面第三方库是希望作为外部引用的，所以需要给打包生成的`worker`文件头部增加`importScript`方法。经过一些资料的查找，只需要设置`rollup`的`output.banner`即可

### 对WebAssembly的认识

下面讲述自己阅读`WebAssembly`相关的材料后，梳理出的对`WebAssembly`的认识。

1. `WebAssembly`从名字中能看出其两个性质，第一是它有着与汇编语言相似的格式，其指令易于机器执行；第二是它是被设计为面向网络应用的，包括客户端和服务端。
    
    * 它有两种格式：
        
        1. `.wat`（WebAssembly text format file），因为它是文本格式，所以我们可以阅读和编辑，但它不能直接被执行，需要转换为`.wasm`文件。
        2. `.wasm`，真正的WebAssembly程序文件，由二进制编码。由于`WebAssembly`是类汇编的初级语言，所以它可以被如`C++`和`rust`等高级语言作为编译对象而生成出来，从这个意义上，它有着不区分开发语言，通用跨平台的特点，就像我们系统中的可执行文件一样。

2. `WebAssembly`的开发方式：

    1. 直接编写`.wat`文件。
    2. 编写高级语言后进行编译。

    * 由于`.wat`的数据类型目前只有`i32 | i64 | f32 | f64`4种，虽然可以定义函数，但运算操作是基于栈式虚拟机，比较初级，相比高级语言，编写代码量过大并且与实际业务逻辑的编写习惯相差甚远，所以生产开发是选择**方式2**

    * 不过为了理解栈式虚拟机和`WebAssembly`的执行机制，下面通过某个网络安全题目提供的`.wasm`转译成的`.wat`内容进行简单说明。

```js
(module
  // wat中 ;; 相当于 js的 //注释， (;;)相当于 /**/注释
  // 定义 (func (param i32 i32) (result i32)) 参数为2个i32类型的值，返回值为i32类型的函数为按顺序为type 0，即第一个type
  (type (;0;) (func (param i32 i32) (result i32)))
  // 从JS运行时中import Math.min 和 Math.max，分别按顺序为func 0 和 func1 并且指明它们都为type 0，
  // 这里import为使用WebAssembly.instantiateStreaming(response, imports)或WebAssembly.instantiate(buffer, imports)实例化WebAssembly时的第二个参数。
  //　此例中可以为{ Math: { min: Math.min, max: Math.max } }，同时也可以看出在`.wat`中是以空格分隔imports中的引用层级的
  (import "Math" "min" (func (;0;) (type 0)))
  (import "Math" "max" (func (;1;) (type 0)))
  // 定义 func 2 并指明其为 type 0
  (func (;2;) (type 0) (param i32 i32) (result i32)
    // 声明6个局部变量
    (local i32 i32 i32 i32 i32 i32)
    // 从局部变量中取索引为0的变量值，放到栈顶，此时栈表示为 [var0]，注意局部变量是根据声明顺序分配索引值的，除了手动定义的6个局部变量，2个参数亦为局部变量，分别为0，1，而手动定义的局部变量则是索引2 - 7
    local.get 0
    // 栈顶出栈，并把值赋给var2，此时栈为[]
    local.set 2
    // 栈为[var1]
    local.get 1
    // 表示将i32类型的数值1进栈，所以此时栈为[var1, 1]
    i32.const 1
    // sub表示substract，即相减，出栈两个值作为操作数，并把结果放到栈顶，此时为[var1 - 1]
    i32.sub
    // tee除了有set的作用，还有把值放回栈顶的效果，所以除了把var1 - 1的值赋值给var4，同时var1 - 1的值依然在栈顶，所以此时依然为[var1 - 1]
    local.tee 4
    if  ;; label = @1
      loop  ;; label = @2
        local.get 2
        local.set 3
        i32.const 0
        local.set 6
        i32.const 10
        local.set 7
        loop  ;; label = @3
          local.get 3
          i32.const 10
          // 将var3 % 10 的值放到栈顶
          i32.rem_u
          local.set 5
          local.get 3
          i32.const 10
          // 将var3 / 10向下取整的值放到栈顶
          i32.div_u
          local.set 3
          local.get 5
          local.get 6
          // 取出栈顶头两个数执行 func 1，并把func1 调用的结果放到栈顶
          call 1
          local.set 6
          local.get 5
          local.get 7
          call 0
          local.set 7
          local.get 3
          i32.const 0
          i32.gt_u
          // 这里的意思是当栈顶数，var3 > 0的结果为0，（即false）时 跳出当前循环，br_if的 0 表示块的深度，以此类推0表示当前块，1 表示 上一块
          br_if 0 (;@3;)
        end
        local.get 2
        local.get 6
        local.get 7
        i32.mul
        i32.add
        local.set 2
        local.get 4
        i32.const 1
        i32.sub
        local.tee 4
        // 如果栈顶数，即var4 - 1 == 0则跳出当前循环
        br_if 0 (;@2;)
      end
    end
    local.get 2)
  // 把func2导出为Run，可以通过module.exports.Run获取
  (export "Run" (func 2)))
```
以下为`Run`函数的`JS`版本
```js
function Run($0, $1) {
  let $2;
  let $3;
  let $4;
  let $5;
  let $6;
  let $7;
  let delta;

  $2 = $0;
  $4 = $1 - 1;

  {
    do {
      $3 = $2;
      $6 = 0;
      $7 = 10;
      do {
        $5 = $3 % 10;
        $3 = Math.floor($3 / 10);
        $6 = Math.max($5, $6);
        $7 = Math.min($5, $7);
      } while ($3 > 0);
      $2 += $6 * $7;
      $4 -= 1;
    } while ($4 != 0);
  }
  return $2;
}
```


3. `WebAssembly`和`JS`之间的通信

    1. `JS`和`WebAssembly`之间较常见的是互传`function`和`WebAssembly.Memory`，通过上面说到的`imports`（`JS`传给`WebAssembly`）和`WebAssembly.Instance.exports`（`WebAssembly`传给`JS`） 。
    2. 限制：函数的传参在这里的限制只能是使用上面提到的`4种`数据类型。那怎么去传递复杂的数据类型呢？方法是通过`memory buffer`，其可以`JS`端通过`WebAssembly.Memory`创建，或者`WebAssembly`端通过`exports`导出自己的内存，而这里关键是这个`Memory`是共享的，两端都可以进行操作。
      * 具体做法，通过`wasm-bindgen`生成`js glue code`里的工具方法说明：
        
        ```js
        // 用Uint8Array来表示wasm的buffer
        function getUint8Memory0() {
          if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
              cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
          }
          return cachegetUint8Memory0;
        }
        //设置字符串到`buffer`（可以把对象`stringify`以后作为字符串传入）
        function passStringToWasm0(arg, malloc, realloc) {
          // ....
          // 通过TextEncoder将字符串编码为UTF-8编码的Uint8Array
          const buf = cachedTextEncoder.encode(arg);
          // malloc为rust vm exports的方法，为字符串分配空间，分配空间的逻辑由rust完成
          const ptr = malloc(buf.length);
          // 返回ptr是Uint8Array的整数索引。相当于指针，这里把buf的值设置到wasm内存的这个区间里[ptr, ptr + buf.length]
          getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
          WASM_VECTOR_LEN = buf.length;
          return ptr;
           // ....
        }
        // 如果是Uint8Array就更简单了，直接把数组的值设置到buffer即可
        function passArray8ToWasm0(arg, malloc) {
          const ptr = malloc(arg.length * 1);
          getUint8Memory0().set(arg, ptr / 1);
          WASM_VECTOR_LEN = arg.length;
          return ptr;
        }
        ```
        上面两个传递数据的工具函数都有两个关键的值，那就是`ptr`和`WASM_VECTOR_LEN`，毫无疑问，这两个值都是整数类型，都可以通过函数进行传递，而实际数据就以`Memory`为介质，通过这种方法就解决了复杂数据传递的问题了。

## 后记
以上就是通过开发导出Excel需求后，对开发过程和`WebAssembly`学习的总结，可能`WebAssembly`在一般的前端开发里，比较少应用场景。但基于知识储备的考虑和兴趣，自然而然地就会去学习这个在**2019年12月**被`W3C`认定为既`html`, `css`, `js`的第四种开发语言。

上面记述的内容主要是面向我自己的总结，可能并不那么详尽，不过至少理解了上面的内容以后，我大概明白了`WebAssembly`的工作机制。

下面是每周邮件中推荐的文章，同时亦时本文的参考，感兴趣的可以一读
1. [practical-guide-to-wasm-memory](https://radu-matei.com/blog/practical-guide-to-wasm-memory)

2. [Learning WebAssembly Series](https://blog.ttulka.com/learning-webassembly-series)         