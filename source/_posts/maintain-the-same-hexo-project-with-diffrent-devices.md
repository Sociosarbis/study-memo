---
title: 使用不用终端维护同一个hexo博客
---
### 初步不合理的尝试
  这个问题来自于今天在公司我尝试使用hexo去生成个人博客，hexo的deploy只会生成页面build好的文件并推送到远程仓库，
这样远程仓库就没有hexo项目的source了。因此，回家以后就没有项目的文件进行下一步的维护。只好重新创建一次项目，并推送
远程仓库分支上，这样不同在不同终端上都能获取到这些文件了。
  于是我凭着直觉和对git微薄的认知，进行了一下两次不同的错误尝试。
  尝试一：
    1.git clone github的repo
    2.git checkout -b hexo 创建并切换到hexo分支上
    3.hexo init 初始化hexo项目，然后问题来了，hexo提示需要当前文件夹是一个空文件夹，只能把所有文件夹的都删，包括.git文件夹。
     这样一来就相当于重头来过
  尝试二:
    1.既然需要一个空文件夹，那么就从刚才的空文件夹开始hexo init
    2.git checkout -b hexo 创建并切换到hexo分支上
    3.git remote add origin git@github.com:Sociosarbis/study-memo.git, 自觉这一步是会关联所有的本地分支和远程分支
    4.直接git push origin/hexo,然后提示远程并没有这个仓库
    5.好吧，既然这样就手动在github上创建hexo的分支，但是这个分支完完全全是master的复制
    6.创建完以后再尝试push，然后提示需要pull一次
    7.然后直接git pull，错误提示没有指定需要从哪个远程分支pull
    8.那我就用这个命令把两个分支关联起来 git branch --set-upstream-to=origin/hexo hexo，然后再pull一次
     再次错误提示refusing to merge unrelated histories
    9.网上search过后在git pull 后面加上 --allow-unrelated-histories，终于pull成功了
    10.接下来就是我比较熟悉的过程了，删除pull下来的生成的页面文件，commit以后再push上去，成功解决
### 正确做法
  虽然最后成功完成了任务，但是这样明显是不够优雅的。
  再去网上查找，找到了两个能很好地解决这次问题的或者说关于本地与远程仓库关联的两个命令。
  分别是:
   1.git push --set-upstream origin branch_name 在远程创建一个与本地branch_name 分支同名的分支并跟踪
   2.git checkout --track orgin/branch_name 在本地创建一个与 branch_name 同名分支跟踪远程分支