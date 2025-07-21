import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "./Navbar";
import React from "react";
import Loading from "./loading";

interface EmployeeData {
  full_name: string;
  division_desc: string;
  position_desc: string;
  email: string;
  image?: string;
}

interface LogData {
  LOG_DATE: string;
  LOG_TIME: string;
  LOG_MODE: string;
}

const Timelog = () => {
  const [empNo, setEmpNo] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [logData, setLogData] = useState<LogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 8;

  // Add fetch log data function
  const fetchLogData = async (token: string, emp: string) => {
    try {
        console.log('Fetching logs for emp:', emp);
        
        const response = await axios.get(`http://127.0.0.1:8000/get_log_data/`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Log Response:', response.data);

        if (response.data.res) {
            // Sort the logs in reverse chronological order
            const sortedLogs = response.data.res.sort((a: LogData, b: LogData) => {
                // Compare dates first
                const dateComparison = new Date(b.LOG_DATE).getTime() - new Date(a.LOG_DATE).getTime();
                if (dateComparison !== 0) return dateComparison;
                
                // If dates are the same, compare times
                return b.LOG_TIME.localeCompare(a.LOG_TIME);
            });
            
            setLogData(sortedLogs);
        } else {
            setLogData([]);
        }
    } catch (error) {
        console.error("Error fetching log data:", error);
        setLogData([]);
    }
};

  // Add this new useEffect for real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    // Cleanup on component unmount
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    const storedEmp = localStorage.getItem('emp');

    if (token && storedEmp) {
      setEmpNo(storedEmp);
      
      // Set default authorization header for all axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Fetch employee data
      const fetchEmployeeData = async () => {
        try {
          const response = await axios.get(`http://127.0.0.1:8000/fetch_user_details/?emp_no=${storedEmp}`);
          setEmployeeData(response.data);
        } catch (error) {
          console.error("Error fetching employee data:", error);
          setEmployeeData({ 
            full_name: "Error fetching name", 
            division_desc: "Error fetching division", 
            email: "Error fetching email",
            position_desc: "Error fetching position"
          });
        }
      };

      // Fetch employee image
      const fetchEmployeeImage = async () => {
        try {
          const response = await axios.get(
            `http://127.0.0.1:8000/get_latest_approved_request/`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (response.data.image) {
            // Convert base64 to blob
            const byteCharacters = atob(response.data.image);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            const imageObjectUrl = URL.createObjectURL(blob);
            setImageUrl(imageObjectUrl);
          }
        } catch (error) {
          console.error("Error fetching employee image:", error);
        }
      };

      // Fetch all data
      const fetchAllData = async () => {
        try {
          await Promise.all([
            fetchEmployeeData(),
            fetchEmployeeImage(),
            fetchLogData(token, storedEmp)
          ]);
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      };

      fetchAllData();
    }

    return () => {
      // Cleanup the object URL when component unmounts
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  // Change dependency array to empty to run only on mount
  }, []);

  // Add loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer); // Cleanup timer
  }, []);

  useEffect(() => {
    const refreshData = async () => {
      const token = localStorage.getItem('token');
      const storedEmp = localStorage.getItem('emp');

      if (token && storedEmp) {
        try {
          const response = await axios.get(
            `http://127.0.0.1:8000/get_latest_approved_request/`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (response.data.image) {
            const byteCharacters = atob(response.data.image);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            const imageObjectUrl = URL.createObjectURL(blob);
            setImageUrl(imageObjectUrl);
          }
        } catch (error) {
          console.error("Error refreshing image:", error);
        }
      }
    };

    // Refresh data every 30 seconds
    const interval = setInterval(refreshData, 30000);
    refreshData(); // Initial fetch

    return () => {
      clearInterval(interval);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, []);

  // Pagination calculation
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = logData.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logData.length / logsPerPage);

  // Rest of your component remains the same
  return (
    <div className="w-full h-screen flex flex-col overflow-hidden pt-20"> {/* Add overflow-hidden */}
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Navbar />
          <div className="flex p-8 h-[calc(100vh-160px)]"> {/* Add fixed height calculation */}
            {/* Time Log Table */}
            <div className="w-2/3 bg-gray-100 p-6 rounded-lg flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-300">
                    <tr>
                      <th className="p-2 border">DATE LOG</th>
                      <th className="p-2 border">TIME LOG</th>
                      <th className="p-2 border">IN/OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-2 border">{log.LOG_DATE}</td>
                        <td className="p-2 border">{log.LOG_TIME}</td>
                        <td className="p-2 border">{log.LOG_MODE}</td>
                      </tr>
                    ))}
                    {logData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-2 border text-center text-gray-500">
                          No logs available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {logData.length > 0 && (
                <div className="flex justify-center items-center mt-4 space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded ${
                      currentPage === 1 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    Previous
                  </button>
                  <span className="text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded ${
                      currentPage === totalPages 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Employee Info */}
            <div className="w-1/3 flex flex-col items-center ml-8">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Employee" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                  onError={(e) => {
                    e.currentTarget.onerror = null; // Prevent infinite loop
                    e.currentTarget.src = 'default-avatar.png'; // Optional: Set a default image
                  }}
                />
              ) : (
                <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-500">No Image</span>
                </div>
              )}
              <h2 className="mt-4 text-lg font-bold">
                {employeeData?.full_name ? employeeData.full_name : "No name available"}
              </h2>
              <p className="text-gray-600">
                {employeeData?.position_desc || "Loading..."}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {employeeData?.division_desc || "Loading..."}
              </p>
              <p className="mt-4">Current Time: {currentTime}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Timelog;