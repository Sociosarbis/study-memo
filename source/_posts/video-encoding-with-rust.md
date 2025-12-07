---
title: 使用rust做视频编码
tags:
  - rust
  - ffmpeg
  - valgrind
  - lld
date: 2025-12-06 17:53:00
---
## 前言
最近部门有个需求是对视频流做**5秒**的录制，并且需要对原视频画面做部分截取（`crop`）。在前些时候已经使用过`rust`的`ffmpeg`的`binding`做视频流的解码，并将解码出来的`AVFrame`输出为一张`jpg`。所以这次需要接触的新功能只有录制视频文件以及截取画面这两个。

## 本文
### 视频编码的大体流程
1. 创建`AVCodecContext`
2. 创建`AVFormatContext`
3. 为`AVCodeContext`在`AVFormatContext`中创建一个`AVStream`
4. 将`AVFrame`发送给`AVCodecContext`，转成`AVPacket`
5. 将`AVPacket`交给`AVFormatContext`写入，`AVFormatContext`负责将各个`AVStream`的`AVPacket`以某种容器格式合并并进行输出
**ps**：`mp4`跟编码`jpg`不一样的是，`mp4`可以既有视频也可以有音频，多个`stream`，`jpg`只要`AVCodecContext`将`AVFrame`转成`AVPacket`，`AVPacket`的`data`就是`jpg`的数据了，当不需要输出成文件的时候并不需要用到`AVFormatContext`。


### 视频裁剪
我们的输入是解码出来的一个个`AVFrame`，这些`AVFrame`本身就是一帧帧的图片，所以只是对它进行裁剪，其实跟在`canvas`使用`x`,`y`,`w`,`h`做`clip`是差不多的，编码也不会对数据做改动，所以并不需要`SwsContext`拷贝出一个新的`AVFrame`，只需要对`AVFrame`的`data`做地址偏移，实现数据视图即可。虽然不需要做拷贝，但我们依然需要使用`av_frame_ref`，在创建完**裁剪后**的`AVFrame`以后，增加对原`AVFrame`的引用，这样当我们对原`AVFrame`做`av_frame_free`的时候，不会使得裁剪后的`AVFrame`的数据被一起释放。
**ps**：`AVFrame`的`buf`字段才是实际的底层数据，`data`其实是`buf`的视图。

### Pixel Format
虽然通过`x`,`y`,`w`,`h`好像就可以做裁剪的，但还得考虑`Pixel Format`，因为`AVFrame`上的像素不一定像`canvas`那样按照`['r','g','b','a','r','g'...]`这样的方式存储的。`canvas`的这种方式叫做`RGBA packed`，四个通道在同一个数组（也叫做平面）上一个挨一个地进行保存，但也有像`YUV`（每个通道放在不同数组）和`NV12`（`Y`通道放在一个数组，`UV`通道`pack`在一个数组）的像素格式。
以`YUV`为例，每个像素一个`Y`，对于`4:2:0`和`4:2:2`，在水平方向上，两个`Y`对应一个`U`和`V`，在垂直方向上，`4:2:0`两个`Y`对应一个`U`和`V`，`4:2:2`一个`Y`对应一个`U`和`V`。

**色度**`Y`在水平和垂直的与`UV`的数量关系，可以通过`AVPixFmtDescriptor`的`log2_chroma_w`和`log2_chroma_h`获得，当是`2:1`时`log2_chroma_w`和`log2_chroma_h`都会是1，因为为`log2(2) = 1`。
所以当是`4:2:0`时，`y[6][5]`对应的是`u[3][2]`和`v[3][2]`。

**ps**：当是`rgba`的时候，因为是`packed`格式，所以一个像素在平面1，会占用4个字节，而`YUV`则是在每个平面各占一个字节。因为`色度`比较常见`2:1`的情况，所以在裁剪时，建议`x`,`y`,`w`,`h`是2的倍数。

### 内存自动释放
除了按照示例调用`binding`的方法以外，还需要注意异常处理中止的时候去释放`alloc`的内存。但是如果按照类`C`的方式，手动做内存释放的话，随着需要释放的对象变多，存在可能漏掉以及重复代码过多的问题。如果是`go`的话，我们可以使用`defer`自动做回收，而在`rust`里我们则需要使用`Drop Trait`。

实现也比较简单，只需要如下代码：
```rust
trait CallDrop {
  fn call_drop(self);
}

struct Pointer<T>
where 
  *mut T: CallDrop
{
  ptr: *mut T,
}

impl <T> Drop for Pointer<T>
where
  *mut T: CallDrop
{
  fn drop(&mut self) {
    <*mut T>::call_drop(self.ptr);
  }
}

// 当要实现比如AVFrame的自动释放时就可以
impl CallDrop for *mut AVFrame {
  fn call_drop(mut self) {
    unsafe {
      av_frame_free(&mut self as *mut _);
    }
  }
}
```
我们需要一个`CallDrop`的`trait`是因为`Drop`不支持`impl Drop for Pointer<实际类型>`的方式进行实现。

这样就可以不用手写内存回收代码，使得代码更简洁，减少自身代码造成内存泄露的问题。

### 检查程序是否有内存泄露
虽然我们已经做了内存自动释放，理论上已经减少了内存泄漏的可能，但是我们还不能确定我们的编码实现是否还是存在，之前做解码的时候就碰到过，服务器`OOM`了。这个时候就需要`valgrind`这个工具了。

使用也比较简单，举个例子，比如我在一个名为`foo`的项目里，写了一个叫做`test_foo`的测试，只要执行`valgrind --leak-check=full cargo test --package foo -- test_foo`即可。如果输出`All heap blocks were freed`则表示没有内存泄露了。

值得注意的是，使用`valgrind`执行程序会很大影响原本的执行速度，所以测试程序需要尽可能地小。看网上的资料是说，原理是将程序机器码转为自己`IR`表示，对内存访问代码进行插桩，然后再将`IR`重新生成机器码执行，达到监视内存操作的目的，而且这个翻译过程是动态的，并不是把整个程序进行翻译。

通过使用`valgrind`发现了`x265`的视频编码存在内存泄漏的问题，而这个问题也在`x265`的仓库上提了[issue](https://bitbucket.org/multicoreware/x265_git/issues/995/ffmpeg-use-x265-memory-leak)。所以最后改用`x264`了，虽然压缩效果不如`x265`。

### 静态链接/动态链接
`x264`是一个第三方库，原来我是直接通过`apt install libx264-dev`安装，但没想到这样编译默认是使用动态链接的。动态链接的问题是，其他同事即便不需要做这个包的开发，也需要在系统中安装，感觉这样会影响开发体验，所以还是决定使用静态链接。
做法也是比较粗暴的，把`.so`文件去掉只留下`.a`文件，这样他就只能使用静态链接了。然后通过`lld`也确认了这样处理以后，二进制产物已经不再依赖`libx264`了。

满心欢喜以为这样就没问题了，但没想到执行的时候就报错了，看资料说是系统安装的`libx264-dev`一般是不带`--enable-pic`编译出来的，通常编译为可执行文件是没有问题的，因为可执行文件的加载地址在进程启动的时候就已经确定了，而动态链接库需要在进程运行加载它的时候才能确定，所以不能是一个固定的地址。

`PIC`是`Position-Independent Code`的缩写，原理可以暂时简单理解为全局变量改到`got`（`Global Offset Table`）里查询实际的地址，而外部函数则使用`plt`（`Procedure Linkage Table`）进行延迟加载。变量和函数的地址都是在运行时往表里填入。

函数延迟加载机制可以通过下面的指令说明：
```wasm
printf@plt:
  jmp *GOT[printf] ;; 首次执行时，GOT[printf]存在的pushq $0这条指令的地址 
  pushq $0 ;; 后面这两条指令的作用实际是通过动态链接器
           ;; 将printf函数的指令地址存入GOT[printf]中，然后再次执行跳转GOT[printf]的地址执行真实函数
           ;; 因为第二次执行时已经有真实函数的地址了，所以就不会重复resolve
  jump .plt
```
非`pic`的好处就是所有地址都在编译时确定，不需要通过`GOT`做二次跳转，执行速度会更快。虽然静态链接库也可以是`pic`，但跟动态链接库的区别是代码是会被编译进最终的产物里，不同进程间不能共享代码段`.text`，而动态链接库则可以共享代码段`.text`，虽然数据段`.data`都是不共享的。

## 总结
以上就是我在做这个需求的时候，对于**视频编码**以及**程序编译**上的一些浅显的探索，对于程序执行底层的机制，因为之前没有系统学过，基本是一知半解的。当然现在也有挺多没有理解透的点，希望接下来可以专心学习，成为更称职的程序员。