import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import Navbar from "./Navbar";
import * as faceMesh from "@mediapipe/face_mesh";
import * as cam from "@mediapipe/camera_utils";

const FaceRecognition: React.FC = () => {
    const webcamRef = useRef<Webcam | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [empNo, setEmpNo] = useState<string>("");
    const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
    const [logType, setLogType] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
    // Phases: "side" (expect left/right), then "center"
    const [phase, setPhase] = useState<"side" | "center">("side");
    const [expectedDirection, setExpectedDirection] = useState<"center" | "left" | "right" | null>(null);
    const [directionMatch, setDirectionMatch] = useState<boolean>(false);
    const sideDirections: ("left" | "right")[] = ["left", "right"];

    useEffect(() => {
        const storedEmpNo = localStorage.getItem("emp");
        if (storedEmpNo) {
            setEmpNo(storedEmpNo);
            fetchLastLog(storedEmpNo);
        } else {
            setMessage("No employee number found in local storage.");
            setIsLoading(false);
        }
    }, []);

    const fetchLastLog = async (empNo: string) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/fetch_last_log/?emp_no=${empNo}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            const data = await response.json();
            if (response.ok) {
                setLogType(data.log_type);
            } else {
                setLogType(null);
            }
        } catch (error) {
            setMessage("Error fetching log data.");
        } finally {
            setIsLoading(false);
        }
    };

    const setRandomDirection = (phaseParam: "side" | "center") => {
        if (phaseParam === "side") {
            const newDirection = sideDirections[Math.floor(Math.random() * sideDirections.length)];
            setExpectedDirection(newDirection);
            setDirectionMatch(false);
        } else if (phaseParam === "center") {
            setExpectedDirection("center");
            setDirectionMatch(false);
        }
    };

    const handleStartRecognition = (type: "I" | "O") => {
        if (logType === type) return;
        setIsCameraOn(true);
        setMessage(null);
        setLogType(type);
        setPhase("side");
        setRandomDirection("side");
    };

    const captureAndSend = async (log: string) => {
        if (isProcessing || !directionMatch) return;

        if (!isCameraReady) {
            setMessage("Camera not ready yet. Please wait...");
            return;
        }

        if (!empNo) {
            setMessage("Employee number not available.");
            return;
        }

        if (!webcamRef.current?.getScreenshot) {
            setMessage("Webcam not initialized.");
            return;
        }

        try {
            setIsProcessing(true);
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) {
                setMessage("Failed to capture image.");
                setIsProcessing(false);
                return;
            }

            const response = await fetch(imageSrc);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append("file", blob, "face.jpg");
            formData.append("log", log);

            const apiResponse = await fetch("http://127.0.0.1:8000/recognize_face/", {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                body: formData,
            });

            const data = await apiResponse.json();
            if (apiResponse.ok) {
                setMessage(`✅ ${data.message}`);
                setIsCameraOn(false);
                setLogType(log);
            } else {
                setMessage(`${data.detail}`);
                if (data.detail.includes("Access denied from this IP address")) {
                    setIsCameraOn(false);
                    setLogType(null);
                }
            }
        } catch (error) {
            setMessage("Error connecting to server.");
            setIsCameraOn(false);
            setLogType(null);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (!isCameraOn) return;

        const faceMeshInstance = new faceMesh.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMeshInstance.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMeshInstance.onResults((results) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                setDirectionMatch(false);
                return;
            }

            const landmarks = results.multiFaceLandmarks[0];
            const noseTipX = landmarks[1].x;

            let currentDirection: "center" | "left" | "right";
            if (noseTipX < 0.40) currentDirection = "left";
            else if (noseTipX > 0.60) currentDirection = "right";
            else currentDirection = "center";

            if (phase === "side") {
                if (currentDirection === expectedDirection) {
                    setDirectionMatch(true);
                    setPhase("center");
                    setRandomDirection("center");
                } else {
                    setDirectionMatch(false);
                }
            } else if (phase === "center") {
                if (currentDirection === "center") {
                    setDirectionMatch(true);
                } else {
                    setDirectionMatch(false);
                }
            }
        });

        if (videoRef.current) {
            const camInstance = new cam.Camera(videoRef.current, {
                onFrame: async () => {
                    await faceMeshInstance.send({ image: videoRef.current! });
                },
                width: 640,
                height: 480,
            });
            camInstance.start();
        }

        const interval = setInterval(() => {
            if (!directionMatch && phase === "side") setRandomDirection("side");
        }, 3000);

        return () => {
            clearInterval(interval);
            faceMeshInstance.close();
        };
    }, [isCameraOn, expectedDirection, phase, directionMatch]);

    useEffect(() => {
        if (!isCameraOn || !directionMatch || !logType) return;

        let timeoutId: NodeJS.Timeout;

        const runRecognition = async () => {
            if (phase === "center") {
                await captureAndSend(logType);
            }
            if (isCameraOn) {
                timeoutId = setTimeout(runRecognition, 2000);
            }
        };

        if (phase === "center") {
            runRecognition();
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isCameraOn, directionMatch, phase, logType]);

    useEffect(() => {
        const checkMidnight = () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                setLogType(null);
            }
        };

        const midnightInterval = setInterval(checkMidnight, 60000);
        return () => clearInterval(midnightInterval);
    }, []);

    const LivenessIndicator: React.FC<{ direction: "center" | "left" | "right" | null; matched: boolean }> = ({ direction }) => {
        const arrowStyles = "text-5xl font-bold select-none";
        const highlightClass = "text-green-500 animate-pulse";

        return (
            <div className="flex justify-center items-center gap-10 mb-4">
                <span className={`${arrowStyles} ${direction === "left" ? highlightClass : "text-gray-400"}`} title="Turn Left">
                    ←
                </span>
                <span className={`${arrowStyles} ${direction === "center" ? highlightClass : "text-gray-400"}`} title="Face Center">
                    ●
                </span>
                <span className={`${arrowStyles} ${direction === "right" ? highlightClass : "text-gray-400"}`} title="Turn Right">
                    →
                </span>
            </div>
        );
    };

    useEffect(() => {
        if (isCameraOn) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => {
                    console.log("Camera permission granted");
                })
                .catch((err) => {
                    console.error("Camera error:", err);
                    setMessage("Camera access denied. Please allow camera access.");
                    setIsCameraOn(false);
                });
        }
    }, [isCameraOn]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p className="text-lg text-gray-600">🔄 Loading...</p>
            </div>
        );
    }

    return (
        <div>
            <Navbar />
            <div className="min-h-screen bg-gray-100 py-30 px-4">
                <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
                        Face Recognition
                    </h1>

                    {!isCameraOn ? (
                        <div className="flex gap-4 justify-center mb-6">
                            <button
                                onClick={() => handleStartRecognition("I")}
                                disabled={logType === "I"}
                                className={`px-6 py-2 rounded-lg ${
                                    logType === "I"
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : "bg-green-500 hover:bg-green-600"
                                } text-white font-medium transition-colors`}
                            >
                                📥 Time In
                            </button>
                            <button
                                onClick={() => handleStartRecognition("O")}
                                disabled={logType === "O"}
                                className={`px-6 py-2 rounded-lg ${
                                    logType === "O"
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : "bg-red-500 hover:bg-red-600"
                                } text-white font-medium transition-colors`}
                            >
                                📤 Time Out
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <LivenessIndicator direction={expectedDirection} matched={directionMatch} />
                            <p className="text-center text-gray-700 font-medium">
                                🎯 Please turn your face <strong>{expectedDirection?.toUpperCase()}</strong>
                            </p>
                            <div className="overflow-hidden rounded-lg">
                                <Webcam
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    mirrored
                                    className="w-full rounded-lg"
                                    videoConstraints={{
                                        facingMode: "user",
                                        width: 640,  // Add explicit width
                                        height: 480  // Add explicit height
                                    }}
                                    onUserMedia={() => setIsCameraReady(true)}
                                />
                                <video
                                    ref={videoRef}
                                    className="hidden"
                                    autoPlay
                                    playsInline
                                    muted
                                />
                            </div>
                        </div>
                    )}

                    {message && (
                        <div
                            className={`mt-4 p-4 rounded-lg ${
                                message.includes("✅")
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-700"
                            }`}
                        >
                            <p className="text-center">{message}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FaceRecognition;