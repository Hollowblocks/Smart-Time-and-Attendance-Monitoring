import pymysql

def connect():
    local = "172.16.200.127"
    user = "stamp_user"
    password = "_Qwlc)Qv;505{$L!"
    dbname = "stamp_db"

    try:
        db = pymysql.connect(
            host=local,
            user=user,
            password=password,
            database=dbname
        )
        return db
    except pymysql.MySQLError as e:
        print(f"Error connecting to MySQL: {e}")
        return None