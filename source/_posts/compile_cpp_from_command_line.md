---
title: 使用命令行编译C++
tags:
  - C++
  - Clang++
  - CLI
  - windows
---
最近这几个月都有在看C++的知识，由于之前一直都在用VSCode写代码，所以也想在编写C++代码时也尽量不需要换IDE。但是本身VSCode在辅助编译上没有等提供UI的支持，所以需要知道一些原始的命令行编译方面的配置。
VSCode的改作C++IDE，可以按照这个网页的说明进行配置[VSCode的C++配置]https://www.zhihu.com/question/30315894/answer/154979413
1.上面的配置适用于单文件的无第三方库的编译，从里面的参数来看， 命令行只需要
```bash
clang++ $fileName -o $fileNameWithoutExt.exe就可以生成可执行文件
```
2.如果需要编译多个.cpp文件则需要,注意头文件不能放在命令行中直接引入
```bash
clang++ $fileName1 $fileName2 ...(表示省略第二文件以后的文件名) -o $fileNameWithoutExt.exe
```
3.如果我在文件中用了第三方库e.g.Boost的话,下面是Boost的入门demo
```cpp
#include <boost/lambda/lambda.hpp>
#include <iostream>
#include <iterator>
#include <algorithm>

int main()
{
    using namespace boost::lambda;
    typedef std::istream_iterator<int> in;

    std::for_each(
        in(std::cin), in(), std::cout << (_1 * 3) << " " );
}
```
如果我们直接进行编译，编译器会显示**fatal error: 'boost/lambda/lambda.hpp' file not found**错误，说编译器找不到头文件，如果是我们编写的头文件在include的时候会使用double quote（双引），编译器默认会在文件的当前目录下进行查找这个头文件。但是如果是尖括号的&lt;**boost/lambda/lambda.hpp**&gt;,则需要把库文件的目录加入到命令行中，供编译器进行查找。则需要用到-I&lt;dir&gt;参数，如：
```bash
clang++ -I "C:/Program Files/boost_1_69_0" $fileName -o $fileNameWithoutExt.exe
```
4.虽然上面这个简单的用例可以不报错了，但是对于以下这个例子不适用
```cpp
#include <iostream>
#include <boost/array.hpp>
#include <boost/asio.hpp>

using boost::asio::ip::tcp;

int main(int argc, char* argv[])
{
    try
    {
        if (argc != 2)
        {
            std::cerr << "Usage: client <host>" << std::endl;
            return 1;
        }

        boost::asio::io_context io_context;

        tcp::resolver resolver(io_context);
        tcp::resolver::results_type endpoints = resolver.resolve(argv[1], "daytime");
        tcp::socket socket(io_context);
        boost::asio::connect(socket, endpoints);

        for (;;)
        {
            boost::array<char, 128> buf;
            boost::system::error_code error;
            size_t len = socket.read_some(boost::asio::buffer(buf), error);

            if (error == boost::asio::error::eof)
                break;
            else if (error)
                throw boost::system::system_error(error);
            std::cout.write(buf.data(), len);
        }
    }
    catch (std::exception& e)
    {
        std::cerr << e.what() << std::endl;
    }
    return 0;
}
```
因为boost::asio会需要用到windows的动态库wsock32等，直接编译会报```undefined reference to `__imp_WSAStartup'```等错误，
这时候需要加上-lwsock32 -lWs2_32这个option**（-l指定某个文件）**，导入wsock32和Ws2_32这两个dll才能成功编译。其实dll也有类似头文件的搜索路径，
windows默认在C:\Windows\System32，如果要添加搜索路径可以通过-L&lt;dir&gt;添加。

在写这篇记录的时候知道两个小知识，第一个是如果cpp中用到了标准库，则需要指定--target=x86_64-w64-mingw这个option，默认在windows的target是x86_64-pc-windows-msvc，由于本机没有安装visual studio，如果不改target的话会找不到头文件。
另外获取编译时编译器查找library的search path的方法为在编译的命令行语句后加上-v这个flag

***待续***
总结有些仓促，如果有新的发现，会进行更新。