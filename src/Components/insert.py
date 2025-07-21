import bcrypt
import mysql.connector
db = mysql.connector.connect(
  host= "172.16.200.95",
  user="stamp-admin",
  password="mVTgEpypdHyQzQ0j",
  database = "stamp_db"
)
curr = db.cursor()
regpassword = input("Enter Password: ")
salt = bcrypt.gensalt()
hashedreg = bcrypt.hashpw(regpassword.encode(), salt)

query2 = "INSERT INTO `users` VALUES ('dc07fc55-7b43-4f99-a9be-09802a34d22a','OSEC-REG-30102019-003','luci',%s,0,NULL,'luci@gmail.com','CO','Richard Reynald','B','Guevarra','N/A','09275047149','01','DEPARTMENT OF AGRICULTURE','00','OFFICE OF THE SECRETARY (OSEC)','11','INFORMATION AND COMMUNICATIONS TECHNOLOGY SERVICE (ICTS)','03','SYSTEMS AND APPLICATION DEVELOPMENT DIVISION (SADD)','00','N/A','00','COMPUTER PROGRAMMER I','0','2022-09-23 00:44:57',0,'1','Tim Carlo C Tapia','1','0','0','1','2022-09-23 00:44:57','0100110300')"
curr.execute(query2, (hashedreg,))
db.commit()

