import sqlite3
from contextlib import closing
with closing(sqlite3.connect('bangumi.db')) as conn:
	c=conn.cursor()
	c.execute('DROP TABLE IF EXISTS bangumi')
	c.execute('''CREATE TABLE bangumi(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			score REAL NOT NULL,
			summary TEXT,
			released_date TEXT NOT NULL)''')
	conn.commit()