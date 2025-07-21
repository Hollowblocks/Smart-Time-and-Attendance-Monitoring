import Webcam from "react-webcam";
import Navbar from "./Navbar";
import React, { useRef, useState } from "react";
import Loading from "./loading";
import { useNavigate } from 'react-router-dom'; // Add this import at the top
import axios from 'axios'; // Add this import

const LiveFeed = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalType, setModalType] = useState<'success' | 'error'>('error');
    const webcamRef = useRef<Webcam | null>(null);
    const [image, setImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Add this function to handle showing the modal
    const showModal = (message: string, type: 'success' | 'error' = 'error') => {
        setModalMessage(message);
        setModalType(type);
        setIsModalOpen(true);
    };

    // Add Modal component
    const MessageModal = () => {
        if (!isModalOpen) return null;

        return (
            <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl">
                    <h2 className={`text-xl font-bold mb-4 ${modalType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                        {modalType === 'error' ? 'Error' : 'Success'}
                    </h2>
                    <p className="mb-6">{modalMessage}</p>
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    };

    // Add this before making the request
    const checkAndRefreshToken = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            showModal("Please login again");
            navigate('/login');
            return false;
        }
        try {
            // Optional: Add a token validation check here
            return true;
        } catch (error) {
            localStorage.removeItem("token");
            navigate('/login');
            return false;
        }
    };

    // Function to capture an image
    const captureImage = () => {
        if (webcamRef.current) {
            const capturedImage = webcamRef.current.getScreenshot();
            setImage(capturedImage);
        } else {
            showModal("Webcam not ready yet!");
        }
    };

    // Function to upload the captured image
    const uploadImage = async () => {
        if (!await checkAndRefreshToken()) {
            return;
        }

        if (!image) {
            showModal("No image captured!");
            return;
        }

        const token = localStorage.getItem("token");
        const emp = localStorage.getItem("emp");

        if (!token || !emp) {
            showModal("User not authenticated! Please log in.");
            return;
        }

        setIsLoading(true);

        try {
            const blob = await fetch(image).then(res => res.blob());
            const formData = new FormData();
            formData.append("file", blob, "face.jpg");
            formData.append("emp_no", emp);

            // Change from fetch to axios for consistent header handling
            const response = await axios.post(
                "http://127.0.0.1:8000/request_face_update/",
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            console.log("Server Response:", response.data);

            if (response.data.message) {
                showModal("Your face update request has been submitted! Please wait for personnel approval.", 'success');
                setImage(null);
            } else if (response.data.error) {
                showModal(response.data.error, 'error');
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                showModal("Session expired. Please login again.");
                navigate('/login');
            } else {
                showModal("Failed to upload image. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <Loading />;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar />
            <div className="container mx-auto px-4 py-30">
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                        Face Registration
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Webcam Section */}
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <Webcam
                                    ref={webcamRef}
                                    width={400}
                                    height={400}
                                    screenshotFormat="image/jpeg"
                                    className="w-full object-cover"
                                    videoConstraints={{
                                        facingMode: "user",
                                        deviceId: undefined  // This will use the default camera
                                    }}
                                />
                            </div>
                            <button
                                onClick={captureImage}
                                className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                            >
                                📸 Capture Image
                            </button>
                        </div>

                        {/* Preview Section */}
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg overflow-hidden h-[225px] flex items-center justify-center">
                                {image ? (
                                    <img
                                        src={image}
                                        alt="Captured face"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <p className="text-gray-500 text-center">
                                        No image captured
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={uploadImage}
                                disabled={!image}
                                className={`w-full py-2 px-4 rounded-lg font-medium
                                    ${image 
                                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    } transition-colors`}
                            >
                                📤 Upload Image
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <MessageModal />
        </div>
    );
};

export default LiveFeed;