---
title: nginx location指令配置的误解
tags:
  - nginx
  - location指令
date: 2020-08-16 15:26:59
---

### 源起
可能因为nginx轻量，功能齐全，跨平台，高性能（由C编写）的原因，在不同语言编写的web应用中，都能看到它的身影。

最近因为想用docker配置php服务器，最后的目标是放在线下的服务器中，为测试人员提供多个测试环境。

在这个过程中，由于我对nginx的location指令的理解有误，导致在转发资源的路由配置上卡了许久。

后面经过经过自己的调试和重读nginx的手册，终于弄明白了。

### 误区

1. `location指令`是类似`express（node.js）`的中间件， 请求会在各个匹配的location中进行传递。

产生这个误解是因为看到这个配置：
```bash
# 这里只看到添加Expires的响应头，没看到返回响应主体的指令
location ~ .*\.(js|css|mp4)?$ {
  expires 1h;
}

# 因为上面指令的存在，导致后面的这个指令一直未能匹配到
location ~ ^/resource/(.*) {
  if (!-f $request_filename) {
    rewrite ^/(.*?)/(.*?)/(.*?)/(.*)$ /code/mapi/$2/$3/$1/$4 last;
  }
}
```
**正解**：对于每个请求，所有的处理都只会在一个location指令内完成所有的处理，上面第一条指令没有显式设置返回主体是因为默认是返回请求路径的静态文件。这一点类似`webpack`的`output`设置`public path`和`path`，默认是一个静态资源的转发服务器。

1. `location指令`匹配的优先顺序，主要是看规则的匹配字符串的长度。不管规则是不是正则表达式，都会当成正则表达式处理（类似`javascript`的`String.prototype.replace`的第一个参数可以是字符串）。

但如果按照上述的逻辑看的，感觉有点与事实相悖，因为`^/resource/(.*)`和`.*\.(js|css|mp4)?$`，如果请求是`/resource/teacher/3.0/areaSwitch.js`，理论上两个规则都能匹配全部字符，那这时是按照怎样的规则呢？

在某个博客的文章中找到了如下的文字说明：

![nginx location配置优先级](/study-memo/assets/images/nginx-location-priority.jpg)

说是优先用正则表达式最长的那个。那把`^/resource/(.*)`改成`/resource/teacher/3.0/(.*)`是不是就可以了呢？发现也是不行。

最后只能在权威的资料（官方手册）中找答案了。

匹配逻辑只有简单的一段：
>A location can either be defined by a prefix string, or by a regular expression. Regular expressions are specified with the preceding “~*” modifier (for case-insensitive matching), or the “~” modifier (for case-sensitive matching). **To find location matching a given request, nginx first checks locations defined using the prefix strings (prefix locations). Among them, the location with the longest matching prefix is selected and remembered. Then regular expressions are checked, in the order of their appearance in the configuration file. The search of regular expressions terminates on the first match, and the corresponding configuration is used. If no match with a regular expression is found then the configuration of the prefix location remembered earlier is used.**

最重要的是加粗的那段，翻译过来整个流程是：

1. 首先遍历各个前缀匹配规则（所谓的前缀匹配，简单来说就是**开头字符串匹配**， 如`/resource/teacher`）， 然后记下匹配到的最长的前缀。
2. 然后进入到正则匹配阶段（遍历各个正则表达式的规则），只要发现有一个匹配则会停止遍历。
3. 假如第2步找不到匹配，则应用第1步记下的那个最长的规则。
4. 整个流程有两个特例，分别是规则中的`=`和`^~`两个修饰符。`^~`表示假如当前规则是最长前缀，则跳过正则匹配阶段，直接应用当前规则；`=`则表示请求路径与规则字符相同，就直接应用当前规则。

### 总结
之前我一直被location的修饰符吸引注意力，而没留意整个匹配过程的细节，现在已豁然开朗。另外一点是查资料最好还是通过英文材料。



