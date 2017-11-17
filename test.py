# -*- coding: utf-8 -*-
import sqlite3
from contextlib import closing
def get_db():
	db=sqlite3.connect('bangumi.db')
	db.row_factory=sqlite3.Row
	return db
def query_db(query,args=(),one=False):
	with closing(get_db()) as db:
		cur=db.execute(query,args)
		db.commit()
		rv=cur.fetchall()
	return (rv[0] if rv else None) if one else rv
def update_db(obj,cond):
	with closing(get_db()) as db:
		query='UPDATE bangumi SET %s WHERE %s'%(\
			','.join(['%s=%s'%(k,(v if type(v) is float else "'%s'"%v))for k,v in obj.items()])\
			,'AND'.join(['%s=%s'%(k,(v if type(v) is float else "'%s'"%v))for k,v in cond.items()]))
		cur=db.execute(query)
		db.commit()
update_db({'score':9.1},{'title':'星际牛仔'})
print([row['summary'] for row in query_db('SELECT * FROM bangumi')])