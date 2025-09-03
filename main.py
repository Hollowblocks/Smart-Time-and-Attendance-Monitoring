import re
from time import sleep
import cv2
from fastapi import FastAPI, HTTPException, File, Request, UploadFile, Depends, status, Header, Form
import pymysql
from datetime import datetime, timedelta
import jwt
from jwt import ExpiredSignatureError
import bcrypt
import os
from deepface import DeepFace
from typing import Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import numpy as np
import logging
import base64
from pymysql.cursors import DictCursor
import boto3
from io import BytesIO
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
app = FastAPI(root_path="/stamp-backend")

# Frontend to Backend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https:/172.16.200.127"], #test server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secret key for signing tokens (for testing purposes)
SECRET_KEY = "b1c0f7a9e92d4c41b54a0d674c6f5d8f76a497d1e2d3f0"
ALGORITHM = "HS256"

# Model for login request
class LoginRequest(BaseModel):
    email: str
    password: str
    
# Load environment variables
load_dotenv()

# Database connection function
def dbconnect():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )

# create JWT token
def create_token(emp_no: str):
    payload = {
        "emp_no": emp_no,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=12)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Extract and verify JWT token from headers
def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token format"
        )
    token = authorization.split("Bearer ")[1]
    db = dbconnect()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM blacklisted_tokens WHERE token = %s", (token,))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=401, detail="Token has been blacklisted")
    finally:
        cursor.close()
        db.close()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        emp_no: str = payload.get("emp_no")
        if not emp_no:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        return emp_no
    except ExpiredSignatureError:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
async def detect_faces(image_data: bytes) -> int:
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    face_objs = DeepFace.extract_faces(img, detector_backend="opencv")
    return len(face_objs)
@app.post("/logout/")
async def logout(emp_no: str = Depends(get_current_user), authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expires_at = datetime.fromtimestamp(payload.get("exp"))
        db = dbconnect()
        cursor = db.cursor()
        cursor.execute("""
                INSERT INTO blacklisted_tokens (token, emp_no, expires_at) 
                VALUES (%s, %s, %s)   m
            """, (token, emp_no, expires_at))
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "Logout successful"}
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token format"
    )

# testing AWS face rekognition
'''
session = boto3.Session(profile_name="aws-user")

#
rekognition = session.client("rekognition", region_name="ap-southeast-1", config=Config(region_name="ap-southeast-1"))

@app.post("/test_amazon/")
async def test_amazon():
    print("✅ Endpoint triggered")

    try:
        with open("src/assets/source.jpg", "rb") as source_image:
            print("Source image loadeds")
            source_bytes = source_image.read()

        with open("src/assets/target.jpg", "rb") as target_image:
            print("Target image loaded")
            target_bytes = target_image.read()

        response = rekognition.compare_faces(
            SourceImage={'Bytes': source_bytes},
            TargetImage={'Bytes': target_bytes},
            SimilarityThreshold=90
        )

        if response['FaceMatches']:
            print("Face match found")
            results = []
            for match in response['FaceMatches']:
                similarity = match['Similarity']
                print(f"Match found with {similarity:.2f}% similarity")
                results.append(f"{similarity:.2f}% similarity")
            return {"matches": results}
        else:
            print("No face match found")
            return {"matches": []}

    except (BotoCoreError, ClientError) as e:
        print("AWS Rekognition error:", e)
        return {"error": str(e)}
'''

@app.post("/register_face/")
async def register_face(
    file: UploadFile = File(...),
    emp_no: str = Form(None),
    current_user: str = Depends(get_current_user)
):
    emp_no = emp_no or current_user
    # Placeholder implementation - complete as needed
    return {"message": f"Face registration initiated for {emp_no}"}

@app.get("/get_validation_data/")
async def get_validation_data():
    try:
        db = dbconnect()
        cursor = db.cursor(cursor=DictCursor)
        
        # Use CTE to get only the latest pending request per employee
        cursor.execute("""
            WITH LatestRequests AS (
                SELECT 
                    emp_no,
                    MAX(date_requested) as latest_request
                FROM approval_requests
                WHERE approval_status = 'pending'
                GROUP BY emp_no
            )
            SELECT 
                ar.request_id,
                ar.emp_no,
                ar.image,
                ar.date_requested,
                ar.approval_status,
                u.first_name,
                u.middle_name,
                u.last_name
            FROM approval_requests ar
            INNER JOIN LatestRequests lr ON 
                ar.emp_no = lr.emp_no AND 
                ar.date_requested = lr.latest_request
            JOIN users u ON ar.emp_no = u.emp_no
            WHERE ar.approval_status = 'pending'
            ORDER BY ar.date_requested DESC
        """)
        
        results = cursor.fetchall()
        formatted_results = []
        
        for row in results:
            if row['image']:
                row['image'] = base64.b64encode(row['image']).decode('utf-8')
            formatted_results.append(row)
            
        return formatted_results
        
    except Exception as e:
        print(f"Error in get_validation_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.post("/request_face_update/")
async def request_face_update(
    file: UploadFile = File(...),
    emp_no: str = Form(None),
    current_user: str = Depends(get_current_user)
):
    try:
        emp_no = emp_no or current_user
        print(f"Processing request for emp_no: {emp_no}")
        
        binary_data = await file.read()
        num_faces = await detect_faces(binary_data)

        if num_faces == 0:
            return {"error": "No face detected in the image."}
        elif num_faces > 1:
            return {"error": "Multiple faces detected."}

        db = dbconnect()
        cursor = db.cursor()

        cursor.execute(
            """INSERT INTO approval_requests 
               (emp_no, image, date_requested, approval_status) 
               VALUES (%s, %s, %s, 'pending')""",
            (emp_no, binary_data, datetime.now())
        )
        
        print(f"Inserted request for emp_no: {emp_no}")
        cursor.execute("SELECT * FROM approval_requests WHERE emp_no = %s ORDER BY date_requested DESC LIMIT 1", (emp_no,))
        inserted = cursor.fetchone()
        print(f"Inserted record: {inserted}")
        
        db.commit()
        return {"message": f"Face update request submitted successfully"}
        
    except Exception as e:
        print(f"Error in request_face_update: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.post("/update_approval_status/")
async def update_approval_status(
    emp_no: str = Form(...),
    currstatus: str = Form(...),
    approval_date: str = Form(...)
):
    try:
        db = dbconnect()
        cursor = db.cursor()

        # Update approval status and date
        cursor.execute(
            """UPDATE approval_requests 
               SET approval_status = %s, 
                   approval_date = %s 
               WHERE emp_no = %s
               AND request_id = (
                   SELECT request_id 
                   FROM (
                       SELECT request_id 
                       FROM approval_requests 
                       WHERE emp_no = %s 
                       ORDER BY date_requested DESC 
                       LIMIT 1
                   ) as latest
               )""",
            (currstatus, datetime.now(), emp_no, emp_no)
        )
        db.commit()

        if currstatus == "Approved":
            # Get the pending image from approval_requests
            cursor.execute(
                """SELECT image 
                   FROM approval_requests 
                   WHERE emp_no = %s 
                   AND approval_status = 'Approved'""",
                (emp_no,)
            )
            image_data = cursor.fetchone()
            
            if image_data:
                # Save image locally
                image_path = f"stored_image_{emp_no}.jpg"
                with open(image_path, "wb") as fh:
                    fh.write(image_data[0])
                
                # Update face_image table
                cursor.execute(
                    """UPDATE face_image 
                       SET image = %s, last_update = %s 
                       WHERE emp_no = %s""",
                    (image_data[0], datetime.now(), emp_no)
                )
                db.commit()
                print(f"Stored new face image for employee {emp_no}")

        return {"message": f"Request for employee {emp_no} has been marked as {currstatus}."}
    except Exception as e:
        print(f"Error in update_approval_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.get("/get_ip_address_data/")
async def get_ip_address_data(emp_no: str = Depends(get_current_user)):
    try:
        db = dbconnect()
        cursor = db.cursor(cursor=DictCursor)
        # Join with users table to get names
        cursor.execute("""
            SELECT 
                v.ip,
                v.date_added,
                CONCAT(u1.first_name, ' ', u1.middle_name, ' ', u1.last_name) as employee_name,
                CONCAT(u2.first_name, ' ', u2.middle_name, ' ', u2.last_name) as added_by_name
            FROM valid_ip v
            JOIN users u1 ON v.emp_no = u1.emp_no
            JOIN users u2 ON v.added_by = u2.emp_no
            WHERE v.emp_no = %s
            ORDER BY v.date_added DESC
        """, (emp_no,))
        results = cursor.fetchall()
        return [
            {
                "employee_name": row["employee_name"],
                "ip": row["ip"],
                "added_by_name": row["added_by_name"],
                "date_added": row["date_added"].isoformat()
            }
            for row in results
        ]
    except Exception as e:
        logging.error(f"Error fetching IP address data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.post("/add_ip_address/")
async def add_ip_address(
    ip: str = Form(...),
    emp_no: str = Depends(get_current_user)
):
    try:
        if not re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', ip):
            raise HTTPException(status_code=400, detail="Invalid IP address format")

        db = dbconnect()
        cursor = db.cursor()

        # Insert into valid_ip table with the correct column names
        cursor.execute(
            """INSERT INTO valid_ip (ip, emp_no, added_by, date_added)
               VALUES (%s, %s, %s, %s)""",
            (ip, emp_no, emp_no, datetime.now())  # using emp_no as added_by
        )
        db.commit()

        # Fetch the inserted record
        cursor.execute(
            """SELECT valid_id, emp_no, ip, added_by, date_added
               FROM valid_ip
               WHERE emp_no = %s AND ip = %s
               ORDER BY date_added DESC LIMIT 1""",
            (emp_no, ip)
        )
        result = cursor.fetchone()

        return {
            "message": "IP address added successfully",
            "data": {
                "valid_id": result[0],
                "emp_no": result[1],
                "ip": result[2],
                "added_by": result[3],
                "date_added": result[4].isoformat()
            }
        }
    except Exception as e:
        logging.error(f"Error adding IP address: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error adding IP address: {str(e)}")
    finally:
        cursor.close()
        db.close()

@app.delete("/delete_ip_address/")
async def delete_ip_address(
    ip: str,  # This expects a query parameter
    emp_no: str = Depends(get_current_user)
):
    try:
        db = dbconnect()
        cursor = db.cursor()

        cursor.execute(
            """DELETE FROM valid_ip 
               WHERE ip = %s AND emp_no = %s""",
            (ip, emp_no)
        )
        db.commit()

        if cursor.rowcount > 0:
            return {"message": "IP address deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="IP address not found")
    except Exception as e:
        logging.error(f"Error deleting IP address: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting IP address: {str(e)}")
    finally:
        cursor.close()
        db.close()

@app.get("/")
def index():
    return {"name": "b-b-b-beatbox"}

#ALLOWED_IP = "127.0.0.1"

@app.post("/login/")
async def login(data: LoginRequest, request: Request):
    email = data.email
    password = data.password

    db = dbconnect()
    cursor = db.cursor()
    
    try:
        cursor.execute("SELECT password, emp_no FROM users WHERE email = %s", (email,))
        result = cursor.fetchone()

        if result and bcrypt.checkpw(password.encode(), result[0].encode()):
            token = create_token(result[1])
            cursor.execute("SELECT role_id FROM system_access WHERE emp_no = %s", (result[1],))
            role = cursor.fetchone()
            return {"message": "Login successful", "token": token, "emp": result[1], "role": role[0]}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    finally:
        cursor.close()
        db.close()



@app.post("/recognize_face/")
async def recognize_face(
    file: UploadFile = File(...),
    emp_no: str = Depends(get_current_user),
    log: str = Form(...),
    request: Request = None
):
    db = dbconnect()
    cursor = db.cursor()

    try:
        # ✅ Validate IP address
        client_ip = request.client.host
        cursor.execute("SELECT COUNT(*) FROM valid_ip WHERE ip = %s", (client_ip,))
        if cursor.fetchone()[0] == 0:
            raise HTTPException(status_code=403, detail="Access denied from this IP address")

        # ✅ Save uploaded image to temp file
        file_location = f"temp_{emp_no}.jpg"
        with open(file_location, "wb") as buffer:
            buffer.write(await file.read())

        # ✅ Get stored face image from DB
        cursor.execute("SELECT image FROM face_image WHERE emp_no = %s", (emp_no,))
        stored_image = cursor.fetchone()

        if not stored_image or not stored_image[0]:
            os.remove(file_location)
            logging.error(f"No stored image for emp_no {emp_no}")
            raise HTTPException(status_code=404, detail="No stored image found for this employee")

        #  Save stored image to temp file
        stored_image_path = f"stored_{emp_no}.jpg"
        with open(stored_image_path, "wb") as f:
            f.write(stored_image[0])

        #  Run DeepFace face verification
        result = DeepFace.verify(
            img1_path=file_location,
            img2_path=stored_image_path,
            model_name="Facenet",    #"VGG-Face", "ArcFace"
            enforce_detection=True,
            detector_backend="opencv",  
            distance_metric="cosine",
            threshold=0.6  
        )

        #  Clean up temp files
        os.remove(file_location)
        os.remove(stored_image_path)

        if result["verified"]:
            similarity = result["distance"]
            logging.info(f"✅ DeepFace matched for {emp_no}, distance: {similarity:.4f}")

            now = datetime.now()
            formatted_date = now.strftime('%Y-%m-%d_%Hh%Mm%Ss')
            date, time_str = now.strftime('%Y-%m-%d'), now.strftime('%H:%M:%S %p')
            filename = os.path.join(emp_no, f"{formatted_date}.jpg")

            #  Log successful match
            cursor.execute(
                "INSERT INTO tbl_extracted_logs (EMP_NO, LOG_DATE, LOG_TIME, LOG_MODE, LOG_IMG_PATH) VALUES (%s, %s, %s, %s, %s)",
                (emp_no, date, time_str, log, filename)
            )
            db.commit()

            return {"message": "Face recognized successfully", "data": emp_no}
        else:
            logging.warning(f"⚠️ Face not recognized for {emp_no}")
            raise HTTPException(status_code=401, detail="Face not recognized")

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Recognition error: {str(e)}")
    finally:
        cursor.close()
        db.close()

@app.get("/fetch_last_log/")
async def fetch_last_log(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor()
    try:
        cursor.execute('''
            SELECT LOG_MODE FROM tbl_extracted_logs 
            WHERE emp_no = %s 
            ORDER BY log_date DESC, log_time DESC 
            LIMIT 1
        ''', (emp_no,))
        log_type = cursor.fetchone()
        now = datetime.now()
        time = now.strftime('%H:%M:%S %p')
        if log_type:
            logging.info(f"result: {log_type[0]}")
            return {"log_type": log_type[0], "time": time}
        else:
            return {"log_type": None, "time": time}
    finally:
        cursor.close()
        db.close()

@app.get("/get_log_data/")
async def get_log_data(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor(cursor=DictCursor)
    try:
        #debug log
        print(f"Fetching logs for employee: {emp_no}")
        
        cursor.execute(
            """SELECT LOG_DATE, LOG_TIME, LOG_MODE 
               FROM tbl_extracted_logs 
               WHERE emp_no = %s
               ORDER BY LOG_DATE DESC, LOG_TIME DESC""", 
            (emp_no,)
        )
        res = cursor.fetchall()
        
        #debug log
        print(f"Found {len(res) if res else 0} logs")
        
        if res:
            logging.info(f"Log data: {res}")
            return {"res": res}
        else:
            return {"res": []}
    finally:
        cursor.close()
        db.close()

@app.get("/fetch_user_details/")
async def fetch_user_details(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor(cursor=DictCursor)
    try:
        cursor.execute("SELECT emp_no, division_desc, first_name, middle_name, last_name, ext_name, position_desc FROM users WHERE emp_no = %s", (emp_no,))
        user_data = cursor.fetchone()

        if user_data:
            name_parts = [
                part for part in [user_data['first_name'], user_data['middle_name'], user_data['last_name'], user_data['ext_name']]
                if part and part.strip() and part.strip().upper() != 'N/A'
            ]
            full_name = " ".join(name_parts) if name_parts else None

            return {
                "emp_no": user_data['emp_no'],
                "division_desc": user_data['division_desc'],
                "first_name": user_data['first_name'],
                "middle_name": user_data['middle_name'],
                "last_name": user_data['last_name'],
                "ext_name": user_data['ext_name'],
                "position_desc": user_data['position_desc'],
                "full_name": full_name
            }
        else:
            raise HTTPException(status_code=404, detail="User not found")
    finally:
        cursor.close()
        db.close()

@app.get("/get_stored_image/")
async def get_stored_image(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT image FROM face_image WHERE emp_no = %s", (emp_no,))
        image_data = cursor.fetchone()

        if image_data and image_data[0]:
            image_path = f"stored_image_{emp_no}.jpg"
            with open(image_path, "wb") as fh:
                fh.write(image_data[0])
            return FileResponse(image_path, media_type="image/jpeg", filename=image_path)
        else:
            raise HTTPException(status_code=404, detail=f"No existing image for employee {emp_no}")
    finally:
        cursor.close()
        db.close()

@app.get("/get_validation_history/")
async def get_validation_history():
    try:
        db = dbconnect()
        cursor = db.cursor()
        
        #only the latest request per employee
        cursor.execute("""
            WITH LatestRequests AS (
                SELECT 
                    emp_no,
                    MAX(request_id) as latest_request
                FROM approval_requests
                WHERE approval_status IN ('Approved', 'Rejected')
                GROUP BY emp_no
            )
            SELECT 
                ar.request_id,
                ar.emp_no,
                ar.image,
                ar.date_requested,
                ar.approval_status,
                ar.approval_date,
                u.first_name,
                u.middle_name,
                u.last_name
            FROM approval_requests ar
            INNER JOIN LatestRequests lr ON 
                ar.emp_no = lr.emp_no AND 
                ar.request_id = lr.latest_request
            JOIN users u ON ar.emp_no = u.emp_no
            WHERE ar.approval_status IN ('Approved', 'Rejected')
            ORDER BY ar.approval_date DESC
        """)
        
        results = cursor.fetchall()
        formatted_results = []
        
        for row in results:
            result_dict = {
                'request_id': row[0],
                'emp_no': row[1],
                'image': base64.b64encode(row[2]).decode('utf-8') if row[2] else None,
                'date_requested': row[3].isoformat() if row[3] else None,
                'approval_status': row[4],
                'approval_date': row[5].isoformat() if row[5] else None,
                'first_name': row[6],
                'middle_name': row[7],
                'last_name': row[8]
            }
            formatted_results.append(result_dict)
            
        return formatted_results
        
    except Exception as e:
        print(f"Error fetching history data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.get("/get_approved_image/")
async def get_approved_image(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor()
    try:
        # Get the latest approved image from approval_requests
        cursor.execute("""
            SELECT image 
            FROM approval_requests 
            WHERE emp_no = %s 
            AND approval_status = 'Approved'
            ORDER BY approval_date DESC 
            LIMIT 1
        """, (emp_no,))
        image_data = cursor.fetchone()

        if image_data and image_data[0]:
            image_path = f"stored_image_{emp_no}.jpg"
            with open(image_path, "wb") as fh:
                fh.write(image_data[0])
            return FileResponse(
                image_path, 
                media_type="image/jpeg", 
                filename=image_path
            )
        else:
            raise HTTPException(
                status_code=404, 
                detail=f"No approved image found for employee {emp_no}"
            )
    finally:
        cursor.close()
        db.close()

@app.get("/get_latest_approved_request/")
async def get_latest_approved_request(emp_no: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor(cursor=DictCursor)
    try:
        # Get the latest approved image
        cursor.execute("""
            SELECT image 
            FROM approval_requests 
            WHERE emp_no = %s 
            AND approval_status = 'Approved'
            ORDER BY approval_date DESC 
            LIMIT 1
        """, (emp_no,))
        
        result = cursor.fetchone()
        if result and result['image']:
            return {
                "image": base64.b64encode(result['image']).decode('utf-8')
            }
        else:
            raise HTTPException(
                status_code=404,
                detail="No approved image found"
            )
    finally:
        cursor.close()
        db.close()

@app.get("/get_all_timelogs/")
async def get_all_timelogs(current_user: str = Depends(get_current_user)):
    db = dbconnect()
    cursor = db.cursor(cursor=DictCursor)
    try:
        # Join with users table to get employee names
        cursor.execute("""
            SELECT 
                t.LOG_DATE,
                t.LOG_TIME,
                t.LOG_MODE,
                t.emp_no,
                CONCAT(u.first_name, ' ', u.middle_name, ' ', u.last_name) as employee_name
            FROM tbl_extracted_logs t
            JOIN users u ON t.emp_no = u.emp_no
            ORDER BY t.LOG_DATE DESC, t.LOG_TIME DESC
        """)
        
        results = cursor.fetchall()
        return results
    except Exception as e:
        logging.error(f"Error fetching all timelogs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
