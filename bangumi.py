# -*- coding: utf-8 -*-
from urllib import request,parse
import re
req=request.Request('http://bangumi.tv/anime/browser',method='GET')
req.add_header('User-agent','Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.75 Safari/537.36')
if req.get_method() is 'GET':
	req.full_url+='?%s'%parse.urlencode({'sort':'rank'})
elif req.get_method() is 'POST':
	req.data=parse.urlencode({'sort':'rank'}).encode('utf-8')
print(req.get_full_url())
with request.urlopen(req) as f:
	pattern=re.compile(r'(?#<li\s+?id="item_\d+?"\s+?class="item.*?">[\w\W]+?<h3>[\w\W]+?<a\s+?href="/subject/\d+?"\s+?class="l">)[a-zA-Z0-9\u4E00-\u9FA5\uf900-\ufa2d]+?</a>',re.M)
	html=f.read().decode('utf-8')
	print(pattern.findall(html))