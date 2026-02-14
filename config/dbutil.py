from configparser import ConfigParser
from logging import exception
import psycopg2
import psycopg2.extras as extras
from sqlalchemy import create_engine


def config(filename='./config/database.ini', section='nse'):
    # create a parser
    parser = ConfigParser()
    # read config filepip
    parser.read(filename)

    # get section, default to postgresql
    db = {}
    if parser.has_section(section):
        params = parser.items(section)
        for param in params:
            db[param[0]] = param[1]
    else:
        raise Exception(
            'Section {0} not found in the {1} file'.format(section, filename))
    return db


def db_conn_for_sqlalchemy():
    try:
        dbparams = config()
        conn_string = f"postgresql://{dbparams['user']}:{dbparams['password']}@{dbparams['host']}:{dbparams['port']}/{dbparams['database']}"
        print(conn_string)
        # connect to PostgreSQL server
        engine = create_engine(conn_string)
        connection = engine.connect()
        return connection
    except:
        return print("Connection failed.")


def dbconn_for_psycopg2():
    dbparams = config()
    conn = psycopg2.connect(**dbparams)
    print(conn)
    return conn


def execute_values(conn, df, table):
    tuples = [tuple(x) for x in df.to_numpy()]
    cols = ','.join(list(df.columns))
    # SQL query to execute
    query = "INSERT INTO %s(%s) VALUES %%s" % (table, cols)
    cursor = conn.cursor()
    try:
        extras.execute_values(cursor, query, tuples)
        conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        print("Error: %s" % error)
        conn.rollback()
        cursor.close()
        raise exception % error
    print("the dataframe is inserted")
    cursor.close()


def insert_df_to_table(conn, df, tablename):
    try:
        df.to_sql(tablename, con=conn, if_exists='replace',
                  index=False)
        conn.autocommit = True
        print('Insert successful')
    except:
        print('Error')


'''
conn = connect()
res = execute_query(conn, "SELECT * from equity_master")
print(res)
conn.close()
'''

'''
conn = connect()
res = is_table_exists(conn, 'equity_master')
print(res)
conn.close()
db_conn_for_sqlalchemy()
'''


# if __name__ == "__main__":
#    dbconn_for_psycopg2()