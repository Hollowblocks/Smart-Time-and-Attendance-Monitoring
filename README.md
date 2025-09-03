# da-employee-face-log
FACIAL RECOGNITION TIME LOG SYSTEM 
# STAMP (DA)

## Overview

This system leverages facial recognition technology (AWS Face Rekognition/ DeepFace) to accurately and efficiently track employee time and attendance for the Department of Agriculture. It integrates with a camera system or webcam to capture images, processes these images to identify individuals, and logs their clock-in/clock-out times. It also automatically saves all necessary data (image data, time logs, account updates, image paths, etc.) into a database.

## Modules and Features

* **Facial Recognition:**
    * Processes camera images.
    * Identifies faces and matches them against an employee database.
    * Returns employee IDs for recognized individuals.
    * Indicates if a face is unrecognized.
    * Saves verified captured image of employee during time log.
    * Labels the verified image using the date and time when the image was taken.
    * Creates a directory named after the employee number for an organized log of employee attendance images.
* **Time Logging Module:**
    * Records employee clock-in and clock-out times.
    * Provides a user-friendly interface for viewing time logs.
* **Database Management:**
    * Stores employee information (names, IDs, etc.).
    * Stores facial recognition data (BLOB).
    * Stores employee time logs.
* **Authentication:**
    * Takes e-mail and password input for user logins
    * Secure user logins using bcrypt for password hashing.
    * Compares password input to the hashed password in the database.

## Technologies Used

* **FrontEnd:**
    * Python 3.12
    * PyQt 5 (for the graphical user interface)
* **BackEnd:**
    * Python 3.12
    * MySQL (for database management)
    * OpenCV (for model)
    * AWS Face Rekognition (for facial recognition)
* **Authentication:**
    * Bcrypt
